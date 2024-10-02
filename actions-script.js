const parser = new DOMParser();
const { host, pathname } = window.location;
const path = pathname.replace(/\/$/, "");
const dataStorageKey = `image-checker::${host}${path}::data`;
const failedButtonText = "Mark as failed";
const unmarkFailedButtonText = "Unmark as failed";
const loaderOverlayId = "loader-overlay-image-checker";

const action = document
  .querySelector("script[data-action]")
  ?.getAttribute("data-action");

let data = [];
let links = [];
let currentPage = 1;
let pageIndex = currentPage - 1;
let backgroundFetchPromise = null;
let changePagePromise = null;

const chunkArray = (array, chunkSize = 10) =>
  array.reduce((result, item, index) => {
    const chunkIndex = Math.floor(index / chunkSize);

    if (!result[chunkIndex]) {
      result[chunkIndex] = [];
    }

    result[chunkIndex].push(item);

    return result;
  }, []);

const getHtmlFromString = (htmlString) =>
  parser.parseFromString(htmlString, "text/html");

const delay = async (time) =>
  new Promise((resolve) => setTimeout(resolve, time));

const createArrayFromRange = (start, end) => {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const dispatchCustomEvent = (detail, eventName) => {
  const dataFromExternalScript = new CustomEvent(eventName, {
    detail,
  });

  document.dispatchEvent(dataFromExternalScript);
};

const dispatchTableRendered = () => {
  dispatchCustomEvent({ action }, "onTableRendered");
};

const dispatchTableDataChange = () => {
  dispatchCustomEvent({ tableData: data }, "onTableDataChange");
};

const dispatchChangePage = (page) => {
  dispatchCustomEvent({ page }, "onPageChange");
};

const getCachedImagesData = () => {
  const cachedData = document
    .querySelector("script[data-table]")
    ?.getAttribute("data-table");

  if (cachedData) {
    return JSON.parse(cachedData);
  }
};

const getCachedPage = () => {
  const cachedPage = document
    .querySelector("script[table-page]")
    ?.getAttribute("table-page");

  if (cachedPage) {
    return +cachedPage;
  }
};

const updatePage = (newPage) => {
  currentPage = newPage;
  pageIndex = newPage - 1;
};

const renderHeadStyles = () => {
  document.head.innerHTML = `
  <style>
    *, ::after, ::before {
      box-sizing: border-box;
    }

    body {
      margin: 0;
    }

    body, button {
      font-family: sans-serif;
    }

    th, td, caption {
      border: 1px solid #ddd;
    }

    td:not(:first-child), caption, th {
      padding: 10px;
    }

    th {
      font-weight: 600;
    }

    .action-button {
      text-decoration: none;
      display: block;
      border: none;
      background-color: #06f;
      border-radius: 10px;
      width: 160px;
      padding: 5px 8px;
      font-weight: 500;
      color: #fff;
      font-size: 16px;
      cursor: pointer;
      text-align: center;
      transition: background-color 0.25s ease-in-out;
    }

    .action-button:hover {
      background-color: rgb(0, 54, 134);
    }

    .action-button:disabled {
      pointer-events: none;
      background-color: rgb(83, 152, 255);
    }

    .action-button:not(:first-child){
      margin-top: 10px;
    }

    .action-button.success {
      background-color: rgb(0, 165, 0);
    }

    .pagination {
      display: flex;
      list-style: none;
      position: sticky;
      background: #fff;
      width: 100%;
      padding: 10px;
      left: 0;
      right: 0;
      justify-content: center;
      align-items: center;
      margin: 0;
      border-bottom: 1px solid #ddd;
    }

    .pagination.top {
      top: 0;
      border-bottom: 1px solid #ddd;
    }

    .pagination.bottom {
      bottom: 0;
      border-top: 1px solid #ddd;
    }

    .pagination li + li {
      margin-left: 4px;
    }

    .pagination .page-button {
      background: none;
      border: none;
      border-radius: 50%;
      padding: 0;
      width: 25px;
      height: 25px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .pagination .page-button:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }

    .pagination .page-button.active {
      pointer-events: none;
      background-color: #06f;
      color: #fff;
    }

    .pagination .page-button:disabled {
      pointer-events: none;
      color: rgb(0 0 0 / 0.4);
    }
  </style>
`;
};

const getDefaultNote = (image) => {
  if (image.hasAttribute("alt")) {
    return "";
  }

  return "This image has no alt attribute at all. Neither with en empty string nor without a value. Even if the image is just decorative, you should add an alt attribute to the image with an empty value. Otherwise, screen readers may read incorrect information and potentially confuse some users.";
};

const getImagesDataFromDocument = (
  currentDocument = document,
  link = window.location.href
) => {
  const images = Array.from(currentDocument.querySelectorAll("img"));

  if (!images.length) {
    return {
      pageLink: link,
      error:
        "The page either doesn't contain any images or it's not an HTML page.",
    };
  }

  const pageTitle = currentDocument
    .getElementsByTagName("title")[0]
    .text.replace(/(\n|\t)/gi, "");

  return {
    pageTitle,
    pageLink: link,
    images: images.map((image) => ({
      src: image.src,
      alt: image.alt,
      note: getDefaultNote(image),
      isChecked: false,
      isFailed: false,
    })),
  };
};

const renderLoaderStyles = () => {
  const style = document.createElement("style");
  style.setAttribute("id", "loader-styles-image-checker");

  style.textContent = `
    #${loaderOverlayId} {
      box-sizing: border-box;
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: rgb(255 255 255 / 70%);
      z-index: 999999;
    }

    #loader-image-checker {
      box-sizing: border-box;
      display: block;
      position: absolute;
      top: 0; left: 0;
      bottom: 0; right: 0;
      margin: auto;
      height: 32px;
      width: 32px;
    }

    #loader-image-checker::before {
      content: "";
      display: block;
      box-sizing: border-box;
      position: absolute;
      top: 0; left: 0;
      bottom: 0; right: 0;
      margin: auto;
      height: 32px;
      width: 32px;
      border: 3px solid #06f;
      border-bottom: 3px solid transparent;
      border-radius: 50%;
      -webkit-animation: loader-animation-1 1.5s cubic-bezier(0.770, 0.000, 0.175, 1.000) infinite;
              animation: loader-animation-1 1.5s cubic-bezier(0.770, 0.000, 0.175, 1.000) infinite;
    }
  
    @-webkit-keyframes loader-animation-1 {
      0%   { -webkit-transform: rotate(0deg); }
      40%  { -webkit-transform: rotate(180deg); }
      60%  { -webkit-transform: rotate(180deg); }
      100% { -webkit-transform: rotate(360deg); }
    }

    @keyframes loader-animation-1 {
      0%   { transform: rotate(0deg); }
      40%  { transform: rotate(180deg); }
      60%  { transform: rotate(180deg); }
      100% { transform: rotate(360deg); }
    }

    #loader-image-checker::after {
      content: "";
      position: absolute;
      box-sizing: border-box;
      top: 0; left: 0;
      bottom: 0; right: 0;
      margin: auto;
      width: 6px;
      height: 6px;
      background: #06f;
      border-radius: 50%;
      -webkit-animation: loader-animation-2 1.5s cubic-bezier(0.770, 0.000, 0.175, 1.000) infinite;
              animation: loader-animation-2 1.5s cubic-bezier(0.770, 0.000, 0.175, 1.000) infinite;
    }

    @-webkit-keyframes loader-animation-2 {
      0%   { -webkit-transform: translate3d(0, -32px, 0) scale(0, 2); opacity: 0; }
      50%  { -webkit-transform: translate3d(0, 0, 0) scale(1.25, 1.25); opacity: 1; }
      100% { -webkit-transform: translate3d(0, 8px, 0) scale(0, 0); opacity: 0; }
    }

    @keyframes loader-animation-2 {
      0%   { transform: translate3d(0, -32px, 0) scale(0, 2); opacity: 0; }
      50%  { transform: translate3d(0, 0, 0) scale(1.25, 1.25); opacity: 1; }
      100% { transform: translate3d(0, 8px, 0) scale(0, 0); opacity: 0; }
}`;

  document.head.appendChild(style);
};

const renderLoaderOverlay = () => {
  document.body.style.overflow = "hidden";

  const style = document.getElementById("loader-styles-image-checker");
  if (!style) {
    renderLoaderStyles();
  }

  const overlay = document.createElement("div");
  overlay.setAttribute("id", loaderOverlayId);
  const loader = document.createElement("div");
  loader.setAttribute("id", "loader-image-checker");
  overlay.appendChild(loader);

  document.body.appendChild(overlay);
};

const removeLoaderOverlay = () => {
  const overlay = document.getElementById(loaderOverlayId);

  if (!overlay) {
    return;
  }

  document.body.removeChild(overlay);
  document.body.style.overflow = "auto";
};

const getFailedRequestError = (status) => {
  if (status === 404) {
    return `The request returned a ${status} status code`;
  }

  return "Failed to retrieve the page's data; you should check the page manually.";
};

const getImageData = async (link) => {
  try {
    const response = await fetch(link, {
      mode: "no-cors",
      "Content-Type": "text/html",
    });

    if (!response.ok) {
      return {
        pageLink: link,
        error: getFailedRequestError(response.status),
      };
    }

    const htmlString = await response.text();
    const currentDocument = getHtmlFromString(htmlString);

    return getImagesDataFromDocument(currentDocument, link);
  } catch {
    return {
      pageLink: link,
      error:
        "Failed to retrieve the page's data; you should check the page manually.",
    };
  }
};

const getImagesData = async (index = pageIndex, { isBackgroundFetch } = {}) => {
  if (data[index]) {
    return data[index];
  }

  if (!isBackgroundFetch) {
    renderLoaderOverlay();
  }

  const imagesData = await Promise.all(links[index].map(getImageData));

  removeLoaderOverlay();

  data[index] = imagesData;
  dispatchTableDataChange();

  return imagesData;
};

const getTableRowBackground = (imageIndex, isChecked, isFailed = false) => {
  if (isFailed) {
    return "#ffdfdf";
  }

  if (isChecked) {
    return "#b7f5b7";
  }

  if (!(imageIndex % 2)) {
    return "#ebebeb";
  }

  return "";
};

const generatePages = (totalPages) => {
  const visibleElementsLength = 7;
  const halfOfVisibleElements = Math.round(visibleElementsLength / 2);
  const startPage = 1;
  const startOfEndPage = totalPages - halfOfVisibleElements;
  const startFiller = [startPage, "..."];
  const endFiller = ["...", totalPages];

  if (totalPages <= visibleElementsLength) {
    return createArrayFromRange(1, totalPages);
  }

  if (currentPage <= halfOfVisibleElements) {
    return [
      ...createArrayFromRange(startPage, halfOfVisibleElements + 1),
      ...endFiller,
    ];
  }

  if (currentPage > startOfEndPage) {
    return [
      ...startFiller,
      ...createArrayFromRange(startOfEndPage, totalPages),
    ];
  }

  if (currentPage > halfOfVisibleElements) {
    return [
      ...startFiller,
      ...createArrayFromRange(pageIndex, currentPage + 1),
      ...endFiller,
    ];
  }
};

const displayPagination = ({ isTop } = {}) => {
  const totalPages = links.length;

  if (totalPages <= 1) {
    return "";
  }

  const pages = generatePages(totalPages);

  window.changePage = async (page) => {
    updatePage(page);
    dispatchChangePage(page);

    if (backgroundFetchPromise && page === data.length + 1) {
      renderLoaderOverlay();
      await backgroundFetchPromise;
      removeLoaderOverlay();
    } else {
      changePagePromise = getImagesData();
      await changePagePromise;
      changePagePromise = null;
    }

    renderTable();
  };

  return `
      <ul class="pagination ${isTop ? "top" : "bottom"}">
        <li><button class="page-button" onclick="changePage(${pageIndex})" ${
    currentPage === 1 ? "disabled" : ""
  }>&lt;</button></li>
        ${pages
          .map(
            (page) => `
            <li><button class="page-button ${
              page === currentPage ? "active" : ""
            }" ${
              page === "..." ? "disabled" : `onclick="changePage(${page})"`
            } >${page}</button></li>
          `
          )
          .join("")}
        <li><button class="page-button" onclick="changePage(${
          currentPage + 1
        })" ${currentPage === totalPages ? "disabled" : ""}>&gt;</button></li>
      </ul>
    `;
};

const renderTable = () => {
  const table = data[pageIndex]
    .map(({ pageLink, pageTitle, images, error }, webPageIndex) => {
      if (error)
        return `
        <table style="border-collapse: collapse; margin-bottom: 40px; table-layout: fixed; width: 100%; max-width: 1258px;">
          <caption style="border-radius: 6px 6px 0 0; text-align: left;">
              <div style="margin-bottom: 6px">
                ${error}
              </div>
              <div>
                <span style="font-weight: 600">Page URL: </span><a rel="noreferrer" href=${pageLink} target="_blank">${pageLink}</a>
              </div>
          </caption>
        </table>
        `;

      return `
        <table style="border-collapse: collapse; margin-bottom: 40px; table-layout: fixed;">
            <caption style="border-radius: 6px 6px 0 0; text-align: left;">
                <div style="margin-bottom: 6px">
                  <span style="font-weight: 600">Page Title: </span>${pageTitle}
                </div>
                <div>
                  <span style="font-weight: 600">Page URL: </span><a rel="noreferrer" href=${pageLink} target="_blank">${pageLink}</a>
                </div>
            </caption>
            <thead>
                <tr>
                <th style="width: 400px">Image</th>
                <th style="width: 185px">Alt</th>
                <th style="width: 400px;">Note</th>
                <th>Actions</th>
                <th>Checked</th>
                </tr>
            </thead>
            <tbody>
                ${images
                  .map(
                    ({ src, alt, note, isChecked, isFailed }, imageIndex) => `
                    <tr id="table-row-${webPageIndex}-${imageIndex}" style="background-color: ${getTableRowBackground(
                      imageIndex,
                      isChecked,
                      isFailed
                    )};">
                        <td>
                            <img src=${src} alt="${alt}" width=400 />
                        </td>
                        <td>
                            ${alt}
                        </td>
                        <td
                          style="outline: none; vertical-align: top; max-width: 400px;"
                          id="note-${webPageIndex}-${imageIndex}"
                          contenteditable="true"
                          oninput="onInputHandler(${webPageIndex}, ${imageIndex})"
                        >
                          ${note}
                        </td>
                        <td>
                            ${
                              src.includes("data:image")
                                ? `
                            <button disabled class="action-button">
                              You can only reach this img manually
                            </button>
                            `
                                : `
                            <a href="${
                              pageLink + "?image-url=" + src
                            }" target="_bank" class="action-button" rel="noreferrer">
                              Go to the image
                            </a>`
                            }
                            
                            <button
                              disabled
                              class="action-button"
                              onclick="saveNoteHandler(this, ${webPageIndex}, ${imageIndex})"
                              id="save-note-button-${webPageIndex}-${imageIndex}"
                            >
                              Save the note
                            </button>
                            <button
                              ${!isChecked ? "disabled" : ""}
                              class="action-button"
                              onclick="markAsFailedHandler(this, ${webPageIndex}, ${imageIndex})"
                              id="failed-button-${webPageIndex}-${imageIndex}"
                            >
                              ${
                                isFailed
                                  ? unmarkFailedButtonText
                                  : failedButtonText
                              }
                            </button>
                        </td>
                        <td>
                            <input style="display: block; margin: auto" type="checkbox" ${
                              isChecked ? "checked" : ""
                            } onchange="onCheckedHandler(this, ${webPageIndex}, ${imageIndex})" />
                        </td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>`;
    })
    .join("");

  document.body.innerHTML = `
    ${displayPagination({ isTop: true })}
    <div style="width: fit-content; margin: 0 auto; padding: 40px 16px 0;">
      ${table}
    </div>
    ${displayPagination()}
    `;

  window.onInputHandler = (webPageIndex, imageIndex) => {
    const saveNoteButton = document.getElementById(
      `save-note-button-${webPageIndex}-${imageIndex}`
    );
    saveNoteButton.disabled = false;
    saveNoteButton.textContent = "Save the note";
    saveNoteButton.classList.remove("success");
  };

  window.saveNoteHandler = (button, webPageIndex, imageIndex) => {
    const note = document.getElementById(`note-${webPageIndex}-${imageIndex}`);

    data[pageIndex][webPageIndex].images[imageIndex].note = note.innerHTML;

    dispatchTableDataChange();

    button.disabled = true;
    button.textContent = "Saved ✓";
    button.classList.add("success");
  };

  window.markAsFailedHandler = (button, webPageIndex, imageIndex) => {
    const tableRow = document.getElementById(
      `table-row-${webPageIndex}-${imageIndex}`
    );

    const currentImage = data[pageIndex][webPageIndex].images[imageIndex];
    const isFailed = !currentImage.isFailed;
    const { isChecked } = currentImage;
    currentImage.isFailed = isFailed;

    dispatchTableDataChange();

    tableRow.style.backgroundColor = getTableRowBackground(
      imageIndex,
      isChecked,
      isFailed
    );

    button.textContent = isFailed ? unmarkFailedButtonText : failedButtonText;
  };

  window.onCheckedHandler = (element, webPageIndex, imageIndex) => {
    const isChecked = element.checked;
    const currentImage = data[pageIndex][webPageIndex].images[imageIndex];
    currentImage.isChecked = isChecked;

    const tableRow = document.getElementById(
      `table-row-${webPageIndex}-${imageIndex}`
    );
    const failedButton = document.getElementById(
      `failed-button-${webPageIndex}-${imageIndex}`
    );

    failedButton.disabled = !isChecked;

    if (!isChecked) {
      failedButton.textContent = failedButtonText;
      currentImage.isFailed = false;
    }

    dispatchTableDataChange();

    tableRow.style.backgroundColor = getTableRowBackground(
      imageIndex,
      isChecked
    );
  };
};

const getBackgroundFetchIndex = () => {
  const nextEmptyIndex = data.findIndex((element) => !element);

  if (nextEmptyIndex > 0) {
    return nextEmptyIndex;
  }

  if (data.length < links.length) {
    return data.length;
  }
};

const backgroundFetching = async () => {
  await delay(5000);

  if (changePagePromise) {
    await changePagePromise;
    await delay(1000);
  }

  const backgroundFetchIndex = getBackgroundFetchIndex();

  if (!backgroundFetchIndex) {
    return;
  }

  backgroundFetchPromise = getImagesData(backgroundFetchIndex, {
    isBackgroundFetch: true,
  });

  await backgroundFetchPromise;

  backgroundFetchPromise = null;
  backgroundFetching();
};

const useSiteMap = async () => {
  const relativeLinks = Array.from(
    document.querySelectorAll("a[href^='/']")
  ).map(({ href }) => href);

  const absoluteLinks = Array.from(
    document.querySelectorAll(`a[href^='https://${host}']`)
  ).map(({ href }) => href);

  links = chunkArray(Array.from(new Set([...relativeLinks, ...absoluteLinks])));

  const cachedPage = getCachedPage();

  if (cachedPage) {
    updatePage(cachedPage);
  }

  const cachedData = getCachedImagesData();

  if (cachedData) {
    data = cachedData;
  }

  await getImagesData();
  renderHeadStyles();
  renderTable();
  dispatchTableRendered();
  backgroundFetching();
};

const usePage = () => {
  const cachedData = getCachedImagesData();

  if (cachedData) {
    data = cachedData;
  } else {
    data = [[getImagesDataFromDocument()]];
    dispatchTableDataChange();
  }

  renderHeadStyles();
  renderTable();
  dispatchTableRendered();
};

if (action === "useSitemap") {
  useSiteMap();
}

if (action === "usePage") {
  usePage();
}

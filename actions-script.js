const parser = new DOMParser();
const { host, pathname } = window.location;
const path = pathname.replace(/\/$/, "");
const dataStorageKey = `image-checker::${host}${path}::data`;
const failedButtonText = "Mark as failed";
const unmarkFailedButtonText = "Unmark as failed";
const progressBarId = "pages-progress-image-checker";

const action = document
  .querySelector("script[data-action]")
  ?.getAttribute("data-action");

let data;
let currentPage = 1;

const chunkArray = (array, chunkSize) =>
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

const renderHeadStyles = () => {
  document.head.innerHTML = `
  <style>
    * {
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

const renderProgressBarStyles = () => {
  const style = document.createElement("style");

  style.textContent = `
    #${progressBarId} {
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      position: fixed;
      width: 260px;
      height: 18px;
      right: 2vw;
      bottom: 5vh;
      z-index: 9999;
      border-radius: 12px;
      overflow: hidden;
    }

    #${progressBarId}::-webkit-progress-bar {
      background-color: #eee;
      border-radius: 12px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25) inset;
    }

    #${progressBarId}::-webkit-progress-value {
      background-image: -webkit-linear-gradient(-45deg, transparent 33%, rgba(0, 0, 0, 0.1) 33%, rgba(0, 0, 0, 0.1) 66%, transparent 66%), -webkit-linear-gradient(top, rgba(255, 255, 255, 0.25), rgba(0, 0, 0, 0.25)), -webkit-linear-gradient(left, #06f, #06f);
      background-size: 35px 20px, 100% 100%, 100% 100%;
    }
  `;

  document.head.appendChild(style);
};

const renderProgressBar = (maxValue) => {
  const progressBar = document.createElement("progress");
  progressBar.setAttribute("max", maxValue);
  progressBar.setAttribute("value", "0");
  progressBar.setAttribute("id", progressBarId);
  renderProgressBarStyles();
  document.body.appendChild(progressBar);
};

const getImagesDataFromDocument = (
  currentDocument = document,
  link = window.location.href
) => {
  const images = Array.from(currentDocument.querySelectorAll("img"));

  if (!images.length) {
    return;
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
      note: image.hasAttribute("alt")
        ? ""
        : "This image has no  alt attribute at all. Neither with en empty string nor without a value. Even if the image is just decorative, you should add an alt attribute to the image with an empty value. Otherwise, screen readers may read incorrect information and potentially confuse some users.",
      isChecked: false,
      isFailed: false,
    })),
  };
};

const getImageData = async (link, index) => {
  await delay(1000);

  try {
    const response = await fetch(link, {
      mode: "no-cors",
      "Content-Type": "text/html",
    });

    if (!response.ok) {
      return;
    }

    const htmlString = await response.text();
    const currentDocument = getHtmlFromString(htmlString);

    return getImagesDataFromDocument(currentDocument, link);
  } catch (error) {
    console.debug("error from getImageData", error);
  } finally {
    const progressBar = document.getElementById(progressBarId);
    progressBar.setAttribute("value", +progressBar.value + 1);
  }
};

const getCachedImagesData = () => {
  const cachedData = document
    .querySelector("script[data-table]")
    ?.getAttribute("data-table");

  if (cachedData) {
    return JSON.parse(cachedData);
  }
};

const getImagesData = async (links) => {
  const cachedData = getCachedImagesData();

  if (cachedData) {
    data = cachedData;

    return cachedData;
  }

  renderProgressBar(links.length);

  const imagesData = await Promise.all(links.map(getImageData));
  const filteredData = imagesData.filter((data) => !!data);
  const chunkedData = chunkArray(filteredData, 10);

  data = chunkedData;

  dispatchTableDataChange();

  return chunkedData;
};

const getTableRowBackground = (imageIndex, isChecked, isFailed = false) => {
  if (isFailed) {
    return "#ffdfdf";
  }

  if (isChecked) {
    return "#dfffdf";
  }

  if (!(imageIndex % 2)) {
    return "#f9f9f9";
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
      ...createArrayFromRange(currentPage - 1, currentPage + 1),
      ...endFiller,
    ];
  }
};

const displayPagination = ({ isTop } = {}) => {
  const totalPages = data.length;

  if (totalPages <= 1) {
    return "";
  }

  const pages = generatePages(totalPages);

  window.changePage = (page) => {
    currentPage = page;

    dispatchChangePage(page);
    renderTable();
  };

  return `
      <ul class="pagination ${isTop ? "top" : "bottom"}">
        <li><button class="page-button" onclick="changePage(${
          currentPage - 1
        })" ${currentPage === 1 ? "disabled" : ""}>&lt;</button></li>
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
        })" ${currentPage === data.length ? "disabled" : ""}>&gt;</button></li>
      </ul>
    `;
};

const renderTable = () => {
  const table = data[currentPage - 1]
    .map(
      ({ pageLink, pageTitle, images }, webPageIndex) => `
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
                            } onchange="onChangeHandler(this, ${webPageIndex}, ${imageIndex})" />
                        </td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>`
    )
    .join("");

  document.body.innerHTML = `
    ${displayPagination({ isTop: true })}
    <div style="width: fit-content; margin: 0 auto; padding: 40px 16px 0">
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

    data[currentPage - 1][webPageIndex].images[imageIndex].note =
      note.innerHTML;

    dispatchTableDataChange();

    button.disabled = true;
    button.textContent = "Saved ✓";
    button.classList.add("success");
  };

  window.markAsFailedHandler = (button, webPageIndex, imageIndex) => {
    const tableRow = document.getElementById(
      `table-row-${webPageIndex}-${imageIndex}`
    );

    const currentImage = data[currentPage - 1][webPageIndex].images[imageIndex];
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

  window.onChangeHandler = (element, webPageIndex, imageIndex) => {
    const isChecked = element.checked;
    const currentImage = data[currentPage - 1][webPageIndex].images[imageIndex];
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

const useSiteMap = async () => {
  const relativeLinks = Array.from(
    document.querySelectorAll("a[href^='/']")
  ).map(({ href }) => href);

  const absoluteLinks = Array.from(
    document.querySelectorAll(`a[href^='https://${host}']`)
  ).map(({ href }) => href);

  const links = Array.from(new Set([...relativeLinks, ...absoluteLinks]));

  await getImagesData(links);

  const page = document
    .querySelector("script[table-page]")
    ?.getAttribute("table-page");

  if (page) {
    currentPage = +page;
  }

  renderHeadStyles();
  renderTable();
  dispatchTableRendered();
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

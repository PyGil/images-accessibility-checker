const parser = new DOMParser();
const { host, pathname } = window.location;
const path = pathname.replace(/\/$/, "");
const dataStorageKey = `image-checker::${host}${path}::data`;
const failedButtonText = "Mark as failed";
const unmarkFailedButtonText = "Unmark as failed";

const action = document
  .querySelector("script[data-action]")
  ?.getAttribute("data-action");

const getHtmlFromString = (htmlString) =>
  parser.parseFromString(htmlString, "text/html");

const delay = async (time) =>
  new Promise((resolve) => setTimeout(resolve, time));

const dispatchCustomEvent = (detail, eventName) => {
  const dataFromExternalScript = new CustomEvent(eventName, {
    detail,
  });

  document.dispatchEvent(dataFromExternalScript);
};

const dispatchTableRendered = () => {
  dispatchCustomEvent({ action }, "onTableRendered");
};

const dispatchTableDataChange = (data) => {
  dispatchCustomEvent({ tableData: data }, "onTableDataChange");
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

const getImageData = async (link) => {
  await delay(450);

  try {
    const response = await fetch(link, { mode: "no-cors" });

    if (!response.ok) {
      return;
    }

    const contentType = response.headers.get("Content-Type");

    if (!contentType.includes("text/html")) {
      return;
    }

    const htmlString = await response.text();
    const currentDocument = getHtmlFromString(htmlString);

    return getImagesDataFromDocument(currentDocument, link);
  } catch (error) {
    console.error("error", error);
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
    return cachedData;
  }

  const imagesData = await Promise.all(links.map(getImageData));
  const filteredData = imagesData.filter((data) => !!data);

  dispatchTableDataChange(filteredData);

  return filteredData;
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

const renderTable = (data) => {
  document.head.innerHTML = `
    <style>
      * {
        box-sizing: border-box;
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
    </style>
  `;

  const table = data
    .map(
      ({ pageLink, pageTitle, images }, pageIndex) => `
        <table style="border-collapse: collapse; margin-bottom: 40px; table-layout: fixed;">
            <caption style="border-radius: 6px 6px 0 0; text-align: left;">
                <div style="margin-bottom: 6px">
                  <span style="font-weight: 600">Page Title: </span>${pageTitle}
                </div>
                <div>
                  <span style="font-weight: 600">Page URL: </span><a href=${pageLink} target="_blank">${pageLink}</a>
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
                    <tr id="table-row-${pageIndex}-${imageIndex}" style="background-color: ${getTableRowBackground(
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
                          id="note-${pageIndex}-${imageIndex}"
                          contenteditable="true"
                          oninput="onInputHandler(${pageIndex}, ${imageIndex})"
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
                            }" target="_bank" class="action-button">
                              Go to the image
                            </a>`
                            }
                            
                            <button
                              disabled
                              class="action-button"
                              onclick="saveNoteHandler(this, ${pageIndex}, ${imageIndex})"
                              id="save-note-button-${pageIndex}-${imageIndex}"
                            >
                              Save the note
                            </button>
                            <button
                              ${!isChecked ? "disabled" : ""}
                              class="action-button"
                              onclick="markAsFailedHandler(this, ${pageIndex}, ${imageIndex})"
                              id="failed-button-${pageIndex}-${imageIndex}"
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
                            } onchange="onChangeHandler(this, ${pageIndex}, ${imageIndex})" />
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
  <div style="width: fit-content; margin: 0 auto; padding: 16px 0;">
    ${table}
  </div>`;

  window.onInputHandler = (pageIndex, imageIndex) => {
    const saveNoteButton = document.getElementById(
      `save-note-button-${pageIndex}-${imageIndex}`
    );
    saveNoteButton.disabled = false;
    saveNoteButton.textContent = "Save the note";
    saveNoteButton.classList.remove("success");
  };

  window.saveNoteHandler = (button, pageIndex, imageIndex) => {
    const note = document.getElementById(`note-${pageIndex}-${imageIndex}`);

    data[pageIndex].images[imageIndex].note = note.innerHTML;

    dispatchTableDataChange(data);

    button.disabled = true;
    button.textContent = "Saved ✓";
    button.classList.add("success");
  };

  window.markAsFailedHandler = (button, pageIndex, imageIndex) => {
    const tableRow = document.getElementById(
      `table-row-${pageIndex}-${imageIndex}`
    );

    const currentImage = data[pageIndex].images[imageIndex];
    const isFailed = !currentImage.isFailed;
    const { isChecked } = currentImage;
    currentImage.isFailed = isFailed;

    dispatchTableDataChange(data);

    tableRow.style.backgroundColor = getTableRowBackground(
      imageIndex,
      isChecked,
      isFailed
    );

    button.textContent = isFailed ? unmarkFailedButtonText : failedButtonText;
  };

  window.onChangeHandler = (element, pageIndex, imageIndex) => {
    const isChecked = element.checked;
    const currentImage = data[pageIndex].images[imageIndex];
    currentImage.isChecked = isChecked;

    const tableRow = document.getElementById(
      `table-row-${pageIndex}-${imageIndex}`
    );
    const failedButton = document.getElementById(
      `failed-button-${pageIndex}-${imageIndex}`
    );

    failedButton.disabled = !isChecked;

    if (!isChecked) {
      failedButton.textContent = failedButtonText;
      currentImage.isFailed = false;
    }

    dispatchTableDataChange(data);

    tableRow.style.backgroundColor = getTableRowBackground(
      imageIndex,
      isChecked
    );
  };

  dispatchTableRendered();
};

const useSiteMap = async () => {
  const relativeLinks = Array.from(
    document.querySelectorAll("a[href^='/']")
  ).map(({ href }) => href);

  const absoluteLinks = Array.from(
    document.querySelectorAll(`a[href^='https://${host}']`)
  ).map(({ href }) => href);

  const links = Array.from(new Set([...relativeLinks, absoluteLinks]));

  const data = await getImagesData(links);

  renderTable(data);
};

const usePage = () => {
  let data;
  const cachedData = getCachedImagesData();

  if (cachedData) {
    data = cachedData;
  } else {
    data = [getImagesDataFromDocument()];
    dispatchTableDataChange(data);
  }

  renderTable(data);
};

if (action === "useSitemap") {
  useSiteMap();
}

if (action === "usePage") {
  usePage();
}

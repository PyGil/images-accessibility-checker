const parser = new DOMParser();
const { host, pathname } = window.location;
const dataStorageKey = `image-checker::${host}${pathname}::data`;

const getHtmlFromString = (htmlString) =>
  parser.parseFromString(htmlString, "text/html");

const getImageData = async (link) => {
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
    const images = Array.from(
      currentDocument.querySelectorAll("img:not(header img)")
    );

    if (!images.length) {
      return;
    }

    const pageTitle = currentDocument
      .getElementsByTagName("title")[0]
      .text.replace(/(\n|\t)/gi, "");

    return {
      pageTitle,
      pageLink: link,
      images: images.map(({ src, alt }) => ({
        src,
        alt,
        note: "",
        isChecked: false,
      })),
    };
  } catch (error) {
    console.error("error", error?.message);
  }
};

const getImagesData = async (links) => {
  const cashedData = localStorage.getItem(dataStorageKey);

  if (cashedData) {
    return JSON.parse(cashedData);
  }

  const imagesData = await Promise.all(links.map(getImageData));

  const filteredData = imagesData.filter((data) => !!data);

  localStorage.setItem(dataStorageKey, JSON.stringify(filteredData));

  return filteredData;
};

const getTableRowBackground = (isChecked, imageIndex) => {
  if (isChecked) {
    return "#dfffdf";
  }

  if (!(imageIndex % 2)) {
    return "#f9f9f9";
  }

  return "";
};

const renderTable = async () => {
  const links = Array.from(document.querySelectorAll("a[href^='/']")).map(
    ({ href }) => href
  );

  const data = await getImagesData(links.slice(0, 20));

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
                    ({ src, alt, note, isChecked }, imageIndex) => `
                    <tr style="background-color: ${getTableRowBackground(
                      isChecked,
                      imageIndex
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
                            <a href="${
                              pageLink + "?image-url=" + src
                            }" target="_bank" class="action-button">
                              Go to the image
                            </a>
                            <button
                              disabled
                              class="action-button" 
                              onclick="saveNoteHandler(this, ${pageIndex}, ${imageIndex})"
                              id="save-note-button-${pageIndex}-${imageIndex}"
                            >
                              Save the note
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
   <style>
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

    .action-button:last-child {
      margin-top: 10px;
    }

    .action-button.success {
      background-color: rgb(0, 165, 0);
    }
  </style>
  <div style="width: fit-content; margin: 0 auto; padding: 16px 0;">
    ${table}
  <div>`;

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

    localStorage.setItem(dataStorageKey, JSON.stringify(data));

    button.disabled = true;
    button.textContent = "Saved ✓";
    button.classList.add("success");
  };

  window.onChangeHandler = (element, pageIndex, imageIndex) => {
    const isChecked = element.checked;

    data[pageIndex].images[imageIndex].isChecked = isChecked;

    localStorage.setItem(dataStorageKey, JSON.stringify(data));

    element.parentElement.parentElement.style.backgroundColor =
      getTableRowBackground(isChecked, imageIndex);
  };
};

renderTable().then(() => {
  const dataFromExternalScript = new CustomEvent("dataFromExternalScript", {
    detail: { tableIsRendered: true },
  });

  document.dispatchEvent(dataFromExternalScript);
});

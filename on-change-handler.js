const parser = new DOMParser();

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
    console.log("error", error);
  }
};

const getImagesData = async (links) => {
  const cashedData = localStorage.getItem("image-checker::data");

  if (cashedData) {
    return JSON.parse(cashedData);
  }

  const imagesData = await Promise.all(links.map(getImageData));

  const filteredData = imagesData.filter((data) => !!data);

  localStorage.setItem("image-checker::data", JSON.stringify(filteredData));

  return filteredData;
};

const renderTable = async () => {
  const links = Array.from(document.querySelectorAll("a[href^='/']")).map(
    ({ href }) => href
  );

  const data = await getImagesData(links.slice(0, 20));

  document.body.innerHTML = data
    .map(
      ({ pageLink, pageTitle, images }, pageIndex) => `
        <table style="border-collapse: collapse; margin-bottom: 40px; width: 800px; padding: 0 40px; display: block; box-sizing: content-box;">
            <caption style="border: 1px solid #000; border-radius: 6px 6px 0 0; padding: 10px; text-align: left;">
                <div style="margin-bottom: 6px">
                  <span style="font-weight: 600">Page Title: </span>${pageTitle}
                </div>
                <div>
                  <span style="font-weight: 600">Page URL: </span><a href=${pageLink} target="_blank">${pageLink}</a>
                </div>
            </caption>
            <thead>
                <tr>
                <th style="border: 1px solid #000; width: 400px">Image</th>
                <th style="border: 1px solid #000; width: 185px">Alt</th>
                <th style="border: 1px solid #000;">Actions</th>
                <th style="border: 1px solid #000; width: 400px;">Note</th>
                <th style="border: 1px solid #000;">Checked</th>
                </tr>
            </thead>
            <tbody>
                ${images
                  .map(
                    ({ src, alt, note, isChecked }, ImageIndex) => `
                    <tr ${isChecked ? 'style="background-color: green;"' : ""}>
                        <td style="border: 1px solid #000;">
                            <img src=${src} alt="${alt}" width=400 />
                        </td>
                        <td style="border: 1px solid #000; padding: 10px">
                            ${alt}
                        </td>
                        <td style="border: 1px solid #000; padding: 10px">
                            <a href="${
                              pageLink + "?image-url=" + src
                            }" target="_bank">Go to the image</a>
                        </td>
                        <td style="border: 1px solid #000; padding: 10px; max-width: 380px;">
                            <span style="outline: none;" contenteditable="true" oninput="onInputHandler(this, ${pageIndex}, ${ImageIndex})">${note}</span>
                        </td>
                        <td style="border: 1px solid #000; padding: 10px;">
                            <input style="display: block; margin: auto" type="checkbox" ${
                              isChecked ? "checked" : ""
                            } onchange="onChangeHandler(this, ${pageIndex}, ${ImageIndex})" />
                        </td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>
`
    )
    .join("");

  let timeoutId;

  window.onInputHandler = (element, pageIndex, ImageIndex) => {
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      data[pageIndex].images[ImageIndex].note = element.innerHTML;

      localStorage.setItem("image-checker::data", JSON.stringify(data));
    }, 2000);
  };

  window.onChangeHandler = (element, pageIndex, ImageIndex) => {
    const isChecked = element.checked;

    data[pageIndex].images[ImageIndex].isChecked = isChecked;

    localStorage.setItem("image-checker::data", JSON.stringify(data));

    element.parentElement.parentElement.style.backgroundColor = isChecked
      ? "green"
      : "transparent";
  };
};

renderTable().then(() => {
  const dataFromExternalScript = new CustomEvent("dataFromExternalScript", {
    detail: { tableIsRendered: true },
  });

  document.dispatchEvent(dataFromExternalScript);
});

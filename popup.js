const getDataButton = document.getElementById("get-data");

const testHandler = () => {};

const clickHandler = async () => {
  getDataButton.textContent = "Wait...";
  getDataButton.disabled = true;

  await chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting
      .executeScript({
        target: { tabId: tabs[0].id },
        function: async () => {
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
                pageLink: link,
                pageTitle,
                images: images.map(({ src, alt }) => ({ src, alt })),
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

            localStorage.setItem(
              "image-checker::data",
              JSON.stringify(filteredData)
            );

            return filteredData;
          };

          const renderTable = async () => {
            const links = Array.from(
              document.querySelectorAll("a[href^='/']")
            ).map(({ href }) => href);

            const data = await getImagesData(links);

            document.body.innerHTML = data
              .map(
                ({ pageLink, pageTitle, images }) => `
            <table style="border-collapse: collapse; margin-bottom: 20px; width: 450px">
                <caption style="border: 1px solid #000">
                    <a href=${pageLink}>${pageTitle} (${pageLink})</a>
                </caption>
                <thead>
                    <tr>
                    <th style="border: 1px solid #000; width: 200px">Image</th>
                    <th style="border: 1px solid #000">Alt</th>
                    </tr>
                </thead>
                <tbody>
                    ${images
                      .map(
                        ({ src, alt }) => `
                        <tr>
                            <td style="border: 1px solid #000;">
                                <img src=${src} width=200 />
                            </td>
                            <td style="border: 1px solid #000; padding: 10px">
                                ${alt}
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
          };

          await renderTable();
        },
      })
      .then(() => {
        getDataButton.textContent = "Success";
        getDataButton.style.backgroundColor = "rgb(0, 165, 0)";
      });
  });
};

getDataButton.addEventListener("click", clickHandler);

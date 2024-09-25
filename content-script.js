const { host, pathname } = window.location;
const path = pathname.replace(/\/$/, "");
const generalStateKey = `${host}${path}::generalState`;
const actionKey = `${host}${path}::action`;
const dataKey = `${host}${path}::data`;

document.addEventListener("onTableRendered", ({ detail: { action } }) => {
  chrome.storage.local.set({
    [generalStateKey]: {
      buttonState: "setSuccess",
    },
    [actionKey]: action,
  });

  chrome.runtime.sendMessage({ tableRenderedAction: action });
});

document.addEventListener("onTableDataChange", ({ detail: { tableData } }) => {
  chrome.storage.local.set({
    [dataKey]: tableData,
  });
});

chrome.storage.local.remove(generalStateKey);

const customStyles = `
  .image-checker-scroll-button {
    border: none;
    background-color: #06f;
    color: #fff;
    border-radius: 16px;
    padding: 8px 12px;
    position: fixed;
    top: 50%;
    right: 2vw;
    transform: translateY(-50%);
    cursor: pointer;
    transition: background-color 0.25s ease-in-out;
  }

  .image-checker-scroll-button:hover {
    background-color: rgb(0, 54, 134);
  }
`;

const scrollToElement = (element, offset = 0) =>
  window.scrollTo({
    top: element.getBoundingClientRect().top + window.scrollY + offset,
    behavior: "smooth",
  });

const getImage = () => {
  const { pathname: imagePathname, search: imageSearch } = new URL(imageURL);

  return (
    document.querySelector(`img[src="${imageURL}"]`) ||
    document.querySelector(`img[src^="${imagePathname}${imageSearch}"]`)
  );
};

const scrollToImageFromQuery = () => {
  const image = getImage();

  if (!image) {
    return;
  }

  const outlineWidth = 5;

  image.style.outline = `${outlineWidth}px solid #06f`;

  const style = document.createElement("style");
  style.textContent = customStyles;
  document.head.appendChild(style);

  const scrollToImageButton = document.createElement("button");
  scrollToImageButton.textContent = "Scroll to the image";
  scrollToImageButton.classList.add("image-checker-scroll-button");

  scrollToImageButton.addEventListener("click", () =>
    scrollToElement(image, -outlineWidth)
  );

  document.body.appendChild(scrollToImageButton);

  scrollToElement(image, -outlineWidth);
};

const imageURL = new URLSearchParams(window.location.search).get("image-url");

if (imageURL) {
  scrollToImageFromQuery();
}

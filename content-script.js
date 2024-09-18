document.addEventListener("dataFromExternalScript", ({ detail }) => {
  chrome.runtime.sendMessage(detail);
});

const { host, pathname } = window.location;
const path = pathname.replace(/\/$/, "");
const generalStateKey = `${host}${path}::general`;

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

const scrollToImageFromQuery = () => {
  const { pathname: imagePathname, search: imageSearch } = new URL(imageURL);

  const image =
    document.querySelector(`img[src="${imageURL}"]`) ||
    document.querySelector(`img[src^="${imagePathname}${imageSearch}"]`);

  console.log(
    "image",
    image,
    new URL(imageURL),
    `${imagePathname}${imageSearch}`,
    imageURL
  );

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

console.log(window.location.search)

if (imageURL) {
  scrollToImageFromQuery();
}

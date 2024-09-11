const getDataButton = document.getElementById("get-data");

const clickHandler = () => {
  getDataButton.textContent = "Wait...";
  getDataButton.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: () => {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("on-change-handler.js");

        document.body.appendChild(script);
      },
    });
  });
};

getDataButton.addEventListener("click", clickHandler);

chrome.runtime.onMessage.addListener(({ tableIsRendered }) => {
  if (tableIsRendered) {
    getDataButton.textContent = "Success";
    getDataButton.style.backgroundColor = "rgb(0, 165, 0)";
  }
});

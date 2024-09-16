const getDataButton = document.getElementById("get-data");

let urlKey;

const storeState = (key) => {
  chrome.storage.local.set({
    [key]: {
      getDataButtonText: getDataButton.textContent,
      isGetDataButtonDisabled: getDataButton.disabled,
      buttonBackgroundColor: getDataButton.style.backgroundColor,
    },
  });
};

const restoreState = (key) => {
  chrome.storage.local.get([key], (result) => {
    const state = result[key];

    if (!state) {
      return;
    }

    getDataButton.textContent = state.getDataButtonText;
    getDataButton.disabled = state.isGetDataButtonDisabled;
    getDataButton.style.backgroundColor = state.buttonBackgroundColor;
  });
};

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const { host, pathname } = new URL(tabs[0].url);

  urlKey = `${host}${pathname}`;

  restoreState(urlKey);
});

const clickHandler = () => {
  getDataButton.textContent = "Wait...";
  getDataButton.disabled = true;

  storeState(urlKey);

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

    storeState(urlKey);
  }
});

const useSitemapButton = document.getElementById("use-sitemap");
const usePageButton = document.getElementById("use-page");
const clearCashButton = document.getElementById("clear-cash");

let generalStateKey;
let actionStateKey;

const storeActionState = (value) => {
  chrome.storage.local.set({
    [actionStateKey]: value,
  });
};

const restoreActionState = () => {
  chrome.storage.local.get([actionStateKey], (result) => {
    const state = result[actionStateKey];

    if (!state) {
      return;
    }

    if (state === "useSitemap") {
      usePageButton.disabled = true;
      return;
    }

    if (state === "usePage") {
      useSitemapButton.disabled = true;
      return;
    }
  });
};

const storeGeneralState = () => {
  chrome.storage.local.set({
    [generalStateKey]: {
      useSitemapButtonText: useSitemapButton.textContent,
      useSitemapButtonDisabled: useSitemapButton.disabled,
      useSitemapButtonBackground: useSitemapButton.style.backgroundColor,
      usePageButtonText: usePageButton.textContent,
      usePageButtonDisabled: useSitemapButton.disabled,
      usePageButtonBackground: usePageButton.style.backgroundColor,
    },
  });
};

const restoreGeneralState = () => {
  chrome.storage.local.get([generalStateKey], (result) => {
    const state = result[generalStateKey];

    if (!state) {
      return;
    }

    useSitemapButton.textContent = state.useSitemapButtonText;
    useSitemapButton.disabled = state.useSitemapButtonDisabled;
    useSitemapButton.style.backgroundColor = state.useSitemapButtonBackground;

    usePageButton.textContent = state.usePageButtonText;
    usePageButton.disabled = state.usePageButtonDisabled;
    usePageButton.style.backgroundColor = state.usePageButtonBackground;
  });
};

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const { host, pathname } = new URL(tabs[0].url);
  const path = pathname.replace(/\/$/, "");

  generalStateKey = `${host}${path}::general`;
  actionStateKey = `${host}${path}::action`;

  restoreGeneralState();
  restoreActionState();

  chrome.storage.local.get([actionStateKey], (result) => {
    const state = result[actionStateKey];

    if (state) {
      clearCashButton.disabled = false;
    }
  });
});


const useSitemapHandler = () => {
  useSitemapButton.textContent = "Wait...";
  useSitemapButton.disabled = true;
  usePageButton.disabled = true;

  storeGeneralState();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: () => {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("actions-script.js");
        script.setAttribute("data-action", "useSitemap");

        document.body.appendChild(script);
      },
    });
  });
};

const usePageHandler = () => {
  useSitemapButton.disabled = true;
  usePageButton.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: () => {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("actions-script.js");
        script.setAttribute("data-action", "usePage");
        document.body.appendChild(script);
      },
    });
  });
};

const clearCashHandler = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: () => {
        const confirmation = confirm("Do you want to clear your cache?");

        if (!confirmation) {
          return;
        }

        const { host, pathname } = window.location;
        const path = pathname.replace(/\/$/, "");
        const dataStorageKey = `image-checker::${host}${path}::data`;

        localStorage.removeItem(dataStorageKey);
        chrome.storage.local.remove(`${host}${path}::action`);

        location.reload();
      },
    });
  });
};

useSitemapButton.addEventListener("click", useSitemapHandler);
usePageButton.addEventListener("click", usePageHandler);
clearCashButton.addEventListener("click", clearCashHandler);

chrome.runtime.onMessage.addListener(({ tableAction }) => {
  if (tableAction) {
    clearCashButton.disabled = false;

    if (tableAction === "useSitemap") {
      useSitemapButton.textContent = "Success";
      useSitemapButton.style.backgroundColor = "rgb(0, 165, 0)";
    }

    if (tableAction === "usePage") {
      usePageButton.textContent = "Success";
      usePageButton.style.backgroundColor = "rgb(0, 165, 0)";
    }

    storeGeneralState();
    storeActionState(tableAction);
  }
});

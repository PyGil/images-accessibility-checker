const useSitemapButton = document.getElementById("use-sitemap");
const usePageButton = document.getElementById("use-page");
const clearCacheButton = document.getElementById("clear-cache");
const clearAllCacheButton = document.getElementById("clear-all-cache");

let generalStateKey;
let actionKey;
let dataKey;
let pageKey;

const buttonsState = {
  useSitemap: {
    setLoading: () => {
      useSitemapButton.textContent = "Wait...";
      useSitemapButton.disabled = true;
      usePageButton.disabled = true;
    },
    setSuccess: () => {
      useSitemapButton.textContent = "Success";
      useSitemapButton.style.backgroundColor = "rgb(0, 165, 0)";
      useSitemapButton.disabled = true;
      usePageButton.disabled = true;
    },
    setActive: () => {
      useSitemapButton.disabled = false;
      usePageButton.disabled = true;
    },
  },
  usePage: {
    setLoading: () => {
      usePageButton.textContent = "Wait...";
      useSitemapButton.disabled = true;
      usePageButton.disabled = true;
    },
    setSuccess: () => {
      usePageButton.textContent = "Success";
      usePageButton.style.backgroundColor = "rgb(0, 165, 0)";
      useSitemapButton.disabled = true;
      usePageButton.disabled = true;
    },
    setActive: () => {
      usePageButton.disabled = false;
      useSitemapButton.disabled = true;
    },
  },
};

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const { host, pathname } = new URL(tabs[0].url);
  const path = pathname.replace(/\/$/, "");

  const url = `${host}${path}`;

  generalStateKey = `${url}::generalState`;
  dataKey = `${url}::data`;
  actionKey = `${url}::action`;
  pageKey = `${url}::page`;

  chrome.storage.local.get(null, (result) => {
    const isCacheExist = Object.keys(result).find(
      (key) => key.startsWith(host) && key.endsWith("::data")
    );

    if (isCacheExist) {
      clearAllCacheButton.disabled = false;
    }

    const data = result[dataKey];
    const generalState = result[generalStateKey];
    const action = result[actionKey];

    if (data) {
      clearCacheButton.disabled = false;
    }

    if (generalState && action) {
      const { buttonState } = generalState;

      buttonsState[action][buttonState]?.();

      return;
    }

    if (action) {
      buttonsState[action]?.setActive();
    }
  });
});

const useSitemapHandler = () => {
  buttonsState.useSitemap.setLoading();

  chrome.storage.local.set({
    [generalStateKey]: {
      buttonState: "setLoading",
    },
    [actionKey]: "useSitemap",
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: (dataKey, pageKey) => {
        chrome.storage.local.get([dataKey, pageKey], (result) => {
          const data = result[dataKey];
          const page = result[pageKey];

          const script = document.createElement("script");
          script.src = chrome.runtime.getURL("actions-script.js");
          script.setAttribute("data-action", "useSitemap");
          page && script.setAttribute("table-page", page.toString());
          data && script.setAttribute("data-table", JSON.stringify(data));

          document.body.appendChild(script);
        });
      },
      args: [dataKey, pageKey],
    });
  });
};

const usePageHandler = () => {
  buttonsState.usePage.setLoading();

  chrome.storage.local.set({
    [generalStateKey]: {
      buttonState: "setLoading",
      [actionKey]: "usePage",
    },
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: (dataKey) => {
        chrome.storage.local.get([dataKey], (result) => {
          const data = result[dataKey];

          const script = document.createElement("script");
          script.src = chrome.runtime.getURL("actions-script.js");
          script.setAttribute("data-action", "usePage");
          data && script.setAttribute("data-table", JSON.stringify(data));

          document.body.appendChild(script);
        });
      },
      args: [dataKey],
    });
  });
};

const clearCacheHandler = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: (dataKey, actionStateKey, pageKey) => {
        const confirmation = confirm("Do you want to clear your cache?");

        if (!confirmation) {
          return;
        }

        chrome.storage.local.remove([actionStateKey, dataKey, pageKey]);

        window.location.reload();
      },
      args: [dataKey, actionKey, pageKey],
    });
  });
};

const clearAllCacheHandler = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: () => {
        const confirmation = confirm(
          "Do you want to clear all cache from the website?"
        );

        if (!confirmation) {
          return;
        }

        chrome.storage.local.get(null, (result) => {
          const keys = Object.keys(result).filter((key) =>
            key.startsWith(window.location.host)
          );

          chrome.storage.local.remove(keys);
        });

        window.location.reload();
      },
    });
  });
};

useSitemapButton.addEventListener("click", useSitemapHandler);
usePageButton.addEventListener("click", usePageHandler);
clearCacheButton.addEventListener("click", clearCacheHandler);
clearAllCacheButton.addEventListener("click", clearAllCacheHandler);

chrome.runtime.onMessage.addListener(({ tableRenderedAction }) => {
  if (tableRenderedAction) {
    clearCacheButton.disabled = false;
    clearAllCacheButton.disabled = false;

    buttonsState[tableRenderedAction].setSuccess();
  }
});

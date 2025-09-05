// Link Reminder — background script (MV3 service worker, ES module)
// This file is loaded as a module via manifest.json (type: "module").
// We use tiny promise wrappers so await works consistently.

const DEFAULT_CATEGORY = "Uncategorized";

const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const storageSet = (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve));

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({ id: "lr_save_page", title: "Save to Link Reminder", contexts: ["page"] });
        chrome.contextMenus.create({ id: "lr_save_link_target", title: "Save Link Target to Link Reminder", contexts: ["link"] });
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "lr_save_page" && tab?.url) {
        quickSave({ url: tab.url, title: tab.title || tab.url });
    }
    if (info.menuItemId === "lr_save_link_target" && info.linkUrl) {
        quickSave({ url: info.linkUrl, title: info.linkUrl });
    }
});

chrome.commands.onCommand.addListener((command) => {
    if (command === "save_current_tab") {
        chrome.windows.create({
            url: chrome.runtime.getURL("popup.html"),
            type: "popup",
            width: 420,
            height: 620,
            focused: true,
        });
    }
    if (command === "open_library") {
        chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
    }
});

async function quickSave({ url, title }) {
    const domain = safeDomain(url);
    const now = Date.now();

    const { links = [], categories = [] } = await storageGet(["links", "categories"]);

    const idx = links.findIndex((l) => l.url === url);
    if (idx !== -1) {
        links[idx].title = title || links[idx].title;
        links[idx].domain = domain || links[idx].domain;
        links[idx].lastQuickSavedAt = now;
    } else {
        links.unshift({
            id: cryptoRandomId(),
            url,
            title: title || url,
            domain,
            category: DEFAULT_CATEGORY,
            keywords: [],
            addedAt: now,
        });
    }

    if (!categories.includes(DEFAULT_CATEGORY)) categories.push(DEFAULT_CATEGORY);
    await storageSet({ links, categories });
    notify("Saved to Link Reminder");
}

function safeDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname.replace(/^www\./, "");
    } catch (_) {
        return "";
    }
}

function cryptoRandomId() {
    const arr = new Uint32Array(4);
    crypto.getRandomValues(arr);
    return Array.from(arr)
        .map((n) => n.toString(16).padStart(8, "0"))
        .join("");
}

function notify(message) {
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#0a84ff" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1200);
}

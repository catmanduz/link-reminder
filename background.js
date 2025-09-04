// Link Reminder — background script (MV3 service worker)
// NOTE: This version avoids any `await` usage to prevent parse errors in some setups.

const DEFAULT_CATEGORY = "Uncategorized";

chrome.runtime.onInstalled.addListener(() => {
    // Recreate context menus on install/update
    try {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: "lr_save_page",
                title: "Save to Link Reminder",
                contexts: ["page"],
            });
            chrome.contextMenus.create({
                id: "lr_save_link_target",
                title: "Save Link Target to Link Reminder",
                contexts: ["link"],
            });
        });
    } catch (_) {
        // ignore if not permitted (older Chrome builds)
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "lr_save_page") {
        if (!tab || !tab.url) return;
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

// --- Helpers ---
function quickSave({ url, title }) {
    const domain = safeDomain(url);
    const now = Date.now();

    chrome.storage.local.get(["links", "categories"], (data) => {
        const links = Array.isArray(data.links) ? data.links : [];
        const categories = Array.isArray(data.categories) ? data.categories : [];

        // If this URL already exists, don’t duplicate – keep existing metadata
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

        chrome.storage.local.set({ links, categories }, () => {
            notify("Saved to Link Reminder");
        });
    });
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
    // Basic notification via badge text; keeps permissions minimal
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#0a84ff" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1200);
}

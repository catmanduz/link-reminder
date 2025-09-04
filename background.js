// Link Reminder — background script (MV3 service worker)
await quickSave({ url: info.linkUrl, title: info.linkUrl });
}
});


chrome.commands.onCommand.addListener(async (command) => {
if (command === "save_current_tab") {
// Open the popup UI in a small window for a focused save flow
chrome.windows.create({
url: chrome.runtime.getURL("popup.html"),
type: "popup",
width: 420,
height: 620,
focused: true
});
}
if (command === "open_library") {
// Open the Library in a tab
chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
}
});


// --- Helpers ---
async function quickSave({ url, title }) {
const domain = safeDomain(url);
const now = Date.now();
const { links = [], categories = [] } = await chrome.storage.local.get(["links", "categories"]);


// If this URL already exists, don’t duplicate – keep existing metadata
const idx = links.findIndex((l) => l.url === url);
if (idx !== -1) {
// Update title/domain if changed; leave user’s metadata intact
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
addedAt: now
});
}


if (!categories.includes(DEFAULT_CATEGORY)) categories.push(DEFAULT_CATEGORY);
await chrome.storage.local.set({ links, categories });
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
return Array.from(arr).map((n) => n.toString(16).padStart(8, "0")).join("");
}


function notify(message) {
// Basic notification via badge text; keeps permissions minimal
chrome.action.setBadgeText({ text: "✓" });
chrome.action.setBadgeBackgroundColor({ color: "#0a84ff" });
setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1200);
}
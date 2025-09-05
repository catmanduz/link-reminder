// MV3 service worker (module)
const DEFAULT_CATEGORY = "Uncategorized";
const NOTIF_ICON = chrome.runtime.getURL("icons/icon-128.png");

const storageGet = (k) => new Promise((r) => chrome.storage.local.get(k, r));
const storageSet = (o) => new Promise((r) => chrome.storage.local.set(o, r));
const alarmsClear = (name) => new Promise((r) => chrome.alarms.clear(name, r));
const alarmName = (id) => `lr:rem:${id}`;
const notifId = (id) => `lr:notif:${id}`;

// — install/startup
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({ id: "lr_save_page", title: "Save to Link Reminder", contexts: ["page"] });
        chrome.contextMenus.create({ id: "lr_save_link_target", title: "Save Link Target to Link Reminder", contexts: ["link"] });
    });
    rehydrateReminders();
});
chrome.runtime.onStartup?.addListener?.(rehydrateReminders);

async function rehydrateReminders() {
    const { links = [] } = await storageGet(["links"]);
    const now = Date.now();
    for (const l of links) {
        if (l.reminderAt && l.reminderAt > now) {
            await scheduleReminder(l.id, l.reminderAt);
        } else if (l.reminderAt && l.reminderAt <= now) {
            // clear expired
            l.reminderAt = undefined;
        }
    }
    await storageSet({ links });
}

// — context menus / commands
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "lr_save_page" && tab?.url) quickSave({ url: tab.url, title: tab.title || tab.url });
    if (info.menuItemId === "lr_save_link_target" && info.linkUrl) quickSave({ url: info.linkUrl, title: info.linkUrl });
});
chrome.commands.onCommand.addListener((cmd) => {
    if (cmd === "save_current_tab") chrome.windows.create({ url: chrome.runtime.getURL("popup.html"), type: "popup", width: 420, height: 660, focused: true });
    if (cmd === "open_library") chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
});

// — message API (optional; handy if you want to call from pages)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
        if (msg?.type === "scheduleReminder") {
            await setLinkReminder(msg.id, msg.whenMs);
            sendResponse({ ok: true });
            return;
        }
        if (msg?.type === "clearReminder") {
            await setLinkReminder(msg.id, undefined);
            sendResponse({ ok: true });
            return;
        }
    })();
    return true;
});

// — quick save (no reminder)
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
        links.unshift({ id: cryptoRandomId(), url, title: title || url, domain, category: DEFAULT_CATEGORY, keywords: [], addedAt: now });
    }
    if (!categories.includes(DEFAULT_CATEGORY)) categories.push(DEFAULT_CATEGORY);
    await storageSet({ links, categories });
    pingBadge();
}

// — reminders
async function setLinkReminder(id, whenMs) {
    const { links = [] } = await storageGet(["links"]);
    const i = links.findIndex((l) => l.id === id);
    if (i === -1) return;
    links[i].reminderAt = whenMs || undefined;
    await storageSet({ links });
    await scheduleReminder(id, whenMs);
}
async function scheduleReminder(id, whenMs) {
    const name = alarmName(id);
    await alarmsClear(name);
    if (!whenMs) return;
    chrome.alarms.create(name, { when: whenMs });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!alarm?.name?.startsWith("lr:rem:")) return;
    const id = alarm.name.slice("lr:rem:".length);
    const { links = [] } = await storageGet(["links"]);
    const link = links.find((l) => l.id === id);
    if (!link) return;

    // Clear reminder (user can snooze to re-set)
    link.reminderAt = undefined;
    await storageSet({ links });

    chrome.notifications.create(notifId(id), {
        type: "basic",
        iconUrl: NOTIF_ICON,
        title: `Reminder: ${link.title || link.url}`,
        message: link.url,
        priority: 2,
        requireInteraction: true,
        buttons: [{ title: "Open link" }, { title: "Snooze…" }],
    });
});

chrome.notifications.onClicked.addListener(async (id) => {
    if (!id.startsWith("lr:notif:")) return;
    const linkId = id.slice("lr:notif:".length);
    const { links = [] } = await storageGet(["links"]);
    const link = links.find((l) => l.id === linkId);
    if (link) chrome.tabs.create({ url: link.url });
    chrome.notifications.clear(id);
});
chrome.notifications.onButtonClicked.addListener((id, idx) => {
    if (!id.startsWith("lr:notif:")) return;
    const linkId = id.slice("lr:notif:".length);
    chrome.notifications.clear(id);
    if (idx === 0) {
        // Open link
        storageGet(["links"]).then(({ links = [] }) => {
            const link = links.find((l) => l.id === linkId);
            if (link) chrome.tabs.create({ url: link.url });
        });
    } else {
        // Snooze window
        const u = new URL(chrome.runtime.getURL("reminder.html"));
        u.searchParams.set("id", linkId);
        chrome.windows.create({ url: u.href, type: "popup", width: 420, height: 560, focused: true });
    }
});

// — utils
function safeDomain(url) {
    try {
        const h = new URL(url).hostname;
        return h.startsWith("www.") ? h.slice(4) : h;
    } catch {
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
function pingBadge() {
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#0a84ff" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1200);
}

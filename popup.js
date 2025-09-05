// ES module; safe to use `await` inside async funcs. We also provide
// small promise wrappers so this works even on Chrome builds where
// some chrome.* APIs don't return promises by default.

const tabsQuery = (queryInfo) => new Promise((resolve) => chrome.tabs.query(queryInfo, resolve));
const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const storageSet = (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve));

document.addEventListener("DOMContentLoaded", init);

async function init() {
    const urlEl = document.getElementById("url");
    const titleEl = document.getElementById("title");
    const categorySelect = document.getElementById("categorySelect");
    const newCategoryEl = document.getElementById("newCategory");
    const statusEl = document.getElementById("status");

    // Get active tab info
    const [tab] = await tabsQuery({ active: true, currentWindow: true });
    if (tab) {
        urlEl.value = tab.url || "";
        titleEl.value = (tab.title || tab.url || "").trim();
    }

    // Load categories
    const { categories = [] } = await storageGet(["categories"]);
    const cats = [...new Set(["Uncategorized", ...categories])].sort((a, b) => a.localeCompare(b));
    renderCategoryOptions(categorySelect, cats);

    // Actions
    document.getElementById("openLibrary").addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
    });

    document.getElementById("saveForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const url = urlEl.value.trim();
        const title = titleEl.value.trim() || url;
        const selectedCategory = categorySelect.value.trim();
        const newCat = newCategoryEl.value.trim();
        const category = newCat || selectedCategory || "Uncategorized";

        const kw = [document.getElementById("kw1").value.trim(), document.getElementById("kw2").value.trim(), document.getElementById("kw3").value.trim()].filter(Boolean).slice(0, 3);

        if (!url) return setStatus("Missing URL.");

        const domain = safeDomain(url);
        const now = Date.now();

        const { links = [], categories = [] } = await storageGet(["links", "categories"]);

        // Upsert by URL
        const existingIdx = links.findIndex((l) => l.url === url);
        const record = {
            id: existingIdx !== -1 ? links[existingIdx].id : cryptoRandomId(),
            url,
            title,
            domain,
            category,
            keywords: kw,
            addedAt: existingIdx !== -1 ? links[existingIdx].addedAt : now,
            updatedAt: now,
        };

        if (existingIdx !== -1) {
            links[existingIdx] = record;
        } else {
            links.unshift(record);
        }

        const nextCats = Array.from(new Set([...(categories || []), category]));
        await storageSet({ links, categories: nextCats });

        setStatus("Saved ✔");
        setTimeout(() => window.close(), 450);
    });
}

function renderCategoryOptions(select, cats) {
    select.innerHTML = "";
    cats.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
}

function setStatus(msg) {
    document.getElementById("status").textContent = msg;
}

function safeDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
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

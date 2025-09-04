// Populate current tab, load categories, save link with metadata
if (tab) {
urlEl.value = tab.url || "";
titleEl.value = (tab.title || tab.url || "").trim();
}


// Load categories
const { categories = [] } = await chrome.storage.local.get(["categories"]);
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


const kw = [
document.getElementById("kw1").value.trim(),
document.getElementById("kw2").value.trim(),
document.getElementById("kw3").value.trim()
].filter(Boolean).slice(0, 3);


if (!url) return setStatus("Missing URL.");


const domain = safeDomain(url);
const now = Date.now();


const { links = [], categories = [] } = await chrome.storage.local.get(["links", "categories"]);


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
updatedAt: now
};


if (existingIdx !== -1) {
links[existingIdx] = record;
} else {
links.unshift(record);
}


const nextCats = Array.from(new Set([...(categories || []), category]));
await chrome.storage.local.set({ links, categories: nextCats });


setStatus("Saved ✔");
// subtle badge ping via background
chrome.runtime.getBackgroundPage?.(() => {}); // no-op for MV3, but harmless
setTimeout(() => window.close(), 450);
});
}


function renderCategoryOptions(select, cats) {
select.innerHTML = "";
cats.forEach((c) => {
const opt = document.createElement("option");
opt.value = c; opt.textContent = c; select.appendChild(opt);
});
}


function setStatus(msg) { document.getElementById("status").textContent = msg; }


function safeDomain(url) {
try { return new URL(url).hostname.replace(/^www\./, ""); } catch (_) { return ""; }
}


function cryptoRandomId() {
const arr = new Uint32Array(4); crypto.getRandomValues(arr);
return Array.from(arr).map(n => n.toString(16).padStart(8, "0")).join("");
}
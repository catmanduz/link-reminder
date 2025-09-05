let state = { links: [], categories: [] };

document.addEventListener("DOMContentLoaded", async () => {
    await loadData();
    initFilters();
    render();

    document.getElementById("refresh").addEventListener("click", async () => {
        await loadData();
        render();
    });

    document.getElementById("export").addEventListener("click", exportJson);

    document.getElementById("clearAll").addEventListener("click", async () => {
        if (!confirm("Delete ALL saved links? This cannot be undone.")) return;
        await chrome.storage.local.set({ links: [] });
        await loadData();
        render();
    });

    document.getElementById("results").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-op]");
        if (!btn) return;
        const tr = btn.closest("tr");
        const id = tr?.dataset?.id;
        if (!id) return;

        if (btn.dataset.op === "delete") {
            if (!confirm("Delete this item?")) return;
            const { links = [] } = await chrome.storage.local.get(["links"]);
            const next = links.filter((l) => l.id !== id);
            await chrome.storage.local.set({ links: next });
            await loadData();
            render();
        }
    });
});

async function loadData() {
    const { links = [], categories = [] } = await chrome.storage.local.get(["links", "categories"]);
    // Sort newest first
    state.links = links.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    state.categories = Array.from(new Set(["Any", "Uncategorized", ...categories]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
}

function initFilters() {
    const fCategory = document.getElementById("fCategory");
    fCategory.innerHTML = state.categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

    ["fCategory", "fKeyword", "fDomain", "fUrl"].forEach((id) => {
        document.getElementById(id).addEventListener("input", render);
    });
    document.getElementById("resetFilters").addEventListener("click", () => {
        fCategory.value = "Any";
        document.getElementById("fKeyword").value = "";
        document.getElementById("fDomain").value = "";
        document.getElementById("fUrl").value = "";
        render();
    });
}

function render() {
    const tbody = document.querySelector("#results tbody");
    tbody.innerHTML = "";

    const filters = currentFilters();
    const rows = applyFilters(state.links, filters);

    const tmpl = document.getElementById("rowTemplate").content;

    rows.forEach((rec) => {
        const frag = tmpl.cloneNode(true);
        const tr = frag.querySelector("tr");
        tr.dataset.id = rec.id;

        const a = frag.querySelector("a.link");
        a.textContent = rec.title || rec.url;
        a.href = rec.url;

        frag.querySelector(".url").textContent = rec.url;
        frag.querySelector(".domain").textContent = rec.domain || safeDomain(rec.url);
        frag.querySelector(".category").textContent = rec.category || "Uncategorized";
        frag.querySelector(".keywords").textContent = (rec.keywords || []).join(", ") || "—";
        frag.querySelector(".reminder").textContent = rec.reminderAt ? new Date(rec.reminderAt).toLocaleString() : "—";
        frag.querySelector(".added").textContent = formatDate(rec.addedAt);

        tbody.appendChild(frag);
    });

    document.getElementById("count").textContent = `${rows.length} item${rows.length === 1 ? "" : "s"}`;
}

function currentFilters() {
};
}


function applyFilters(items, f) {
return items.filter((it) => {
// Category
if (f.category && f.category !== "Any") {
const cat = (it.category || "Uncategorized");
if (cat !== f.category) return false;
}


// Domain (substring match, normalized)
if (f.domain) {
const dom = (it.domain || safeDomain(it.url) || "").toLowerCase();
if (!dom.includes(f.domain)) return false;
}


// URL contains
if (f.urlq) {
if (!(it.url || "").toLowerCase().includes(f.urlq)) return false;
}


// Keywords (match ANY provided keyword)
if (f.keywords.length) {
const kws = (it.keywords || []).map(k => k.toLowerCase());
const hit = f.keywords.some(q => kws.includes(q) || kws.some(k => k.includes(q)));
if (!hit) return false;
}


return true;
});
}


function splitKeywords(s) {
return (s || "")
.split(/[\s,]+/)
.map(x => x.trim().toLowerCase())
.filter(Boolean);
}


function safeDomain(url) {
try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}


function formatDate(ts) {
if (!ts) return "—";
try {
const d = new Date(ts);
return d.toLocaleString();
} catch { return "—"; }
}


function escapeHtml(s = "") {
return s.replace(/[&<>"']/g, (c) => ({
"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);
}


function exportJson() {
const blob = new Blob([JSON.stringify(state.links, null, 2)], { type: "application/json" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url; a.download = `link-reminder-export-${Date.now()}.json`;
document.body.appendChild(a); a.click(); a.remove();
URL.revokeObjectURL(url);
}
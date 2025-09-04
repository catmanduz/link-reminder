let state = { links: [], categories: [] };
frag.querySelector(".category").textContent = rec.category || "Uncategorized";
frag.querySelector(".keywords").textContent = (rec.keywords || []).join(", ") || "—";
frag.querySelector(".added").textContent = formatDate(rec.addedAt);


tbody.appendChild(frag);
});


document.getElementById("count").textContent = `${rows.length} item${rows.length === 1 ? "" : "s"}`;
}


function currentFilters() {
return {
category: document.getElementById("fCategory").value,
keywords: splitKeywords(document.getElementById("fKeyword").value),
domain: (document.getElementById("fDomain").value || "").toLowerCase().trim(),
urlq: (document.getElementById("fUrl").value || "").toLowerCase().trim(),
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
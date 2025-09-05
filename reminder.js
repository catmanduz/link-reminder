const storageGet = (k) => new Promise((r) => chrome.storage.local.get(k, r));
const storageSet = (o) => new Promise((r) => chrome.storage.local.set(o, r));
const alarmsClear = (name) => new Promise((r) => chrome.alarms.clear(name, r));
const alarmName = (id) => `lr:rem:${id}`;

let linkId = null;
let selectedQuickBtn = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
    const u = new URL(location.href);
    linkId = u.searchParams.get("id");
    if (!linkId) return window.close();

    const { links = [] } = await storageGet(["links"]);
    const rec = links.find((l) => l.id === linkId);
    if (!rec) return window.close();

    document.getElementById("title").textContent = rec.title || rec.url;
    document.getElementById("link").href = rec.url;

    document.querySelectorAll(".quick button[data-mins]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (selectedQuickBtn) selectedQuickBtn.classList.remove("active");
            selectedQuickBtn = btn;
            btn.classList.add("active");
            const mins = parseInt(btn.dataset.mins, 10);
            const whenMs = Date.now() + mins * 60_000;
            await saveReminder(rec.id, whenMs);
            window.close();
        });
    });

    document.getElementById("save").addEventListener("click", async () => {
        const v = document.getElementById("customWhen").value;
        const when = v ? new Date(v).getTime() : NaN;
        if (Number.isFinite(when)) {
            await saveReminder(rec.id, when);
            window.close();
        } else {
            alert("Pick a custom date/time or use a quick option.");
        }
    });

    document.getElementById("cancel").addEventListener("click", () => window.close());
}

async function saveReminder(id, whenMs) {
    const { links = [] } = await storageGet(["links"]);
    const i = links.findIndex((l) => l.id === id);
    if (i === -1) return;

    links[i].reminderAt = whenMs;
    await storageSet({ links });

    await alarmsClear(alarmName(id));
    chrome.alarms.create(alarmName(id), { when: whenMs });
}

const SITES_KEY = "sites";
const siteList = document.getElementById("siteList");
const addSiteForm = document.getElementById("addSiteForm");
const siteInput = document.getElementById("siteInput");
const timeInput = document.getElementById("timeInput");
const feedback = document.getElementById("feedback");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const clearBtn  = document.getElementById("clearBtn");

const norm = (s) => s.trim().toLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/\/.*/, "")
  .replace(/^www\./, "");

function showFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.style.color = isError ? "#dc2626" : "#059669";
  setTimeout(() => (feedback.textContent = ""), 2500);
}

function renderSites(sites) {
  siteList.innerHTML = "";
  Object.entries(sites).forEach(([site, minutes]) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="site-name">${site}</span>
      <span class="mins">${minutes} min</span>
      <button class="remove-btn">Remove</button>
    `;
    li.querySelector(".remove-btn").onclick = () => removeSite(site);
    siteList.appendChild(li);
  });
}

function loadSites() {
  chrome.storage.local.get(SITES_KEY, (data) => {
    renderSites(data[SITES_KEY] || {});
  });
}

function saveSite(site, minutes) {
  chrome.storage.local.get(SITES_KEY, (data) => {
    const sites = { ...(data[SITES_KEY] || {}) };
    sites[site] = minutes;
    chrome.storage.local.set({ [SITES_KEY]: sites }, () => {
      loadSites();
      siteInput.value = "";
      timeInput.value = "";
      siteInput.focus();
      showFeedback(`Limit set for ${site}`);
    });
  });
}

function removeSite(site) {
  chrome.storage.local.get(SITES_KEY, (data) => {
    const sites = { ...(data[SITES_KEY] || {}) };
    if (!sites[site]) return;
    if (!confirm(`Remove ${site}?`)) return;
    delete sites[site];
    chrome.storage.local.set({ [SITES_KEY]: sites }, () => {
      loadSites();
      showFeedback(`Removed ${site}`);
    });
  });
}

addSiteForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const site = norm(siteInput.value);
  const minutes = parseInt(timeInput.value, 10);
  if (!site || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(site) || !minutes || minutes < 1) {
    showFeedback("Enter a valid domain and minutes.", true);
    return;
  }
  saveSite(site, minutes);
});

// Export / Import / Clear
exportBtn.onclick = async () => {
  const sites = (await chrome.storage.local.get(SITES_KEY))[SITES_KEY] || {};
  const blob = new Blob([JSON.stringify(sites, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "site-blocker-settings.json";
  a.click();
  URL.revokeObjectURL(url);
};

importBtn.onclick = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      if (typeof imported !== "object" || Array.isArray(imported)) throw new Error("Invalid format");
      const normalized = {};
      Object.entries(imported).forEach(([k,v]) => {
        const key = norm(k);
        const val = parseInt(v, 10);
        if (key && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(key) && val > 0) normalized[key] = val;
      });
      await chrome.storage.local.set({ [SITES_KEY]: normalized });
      loadSites();
      showFeedback("Settings imported.");
    } catch (e) {
      showFeedback("Import failed. Invalid file.", true);
    }
  };
  input.click();
};

clearBtn.onclick = async () => {
  if (!confirm("Clear all sites?")) return;
  await chrome.storage.local.set({ [SITES_KEY]: {} });
  loadSites();
  showFeedback("All sites cleared.");
};

loadSites();

const SITES_KEY = "sites";
const siteList = document.getElementById("siteList");
const siteInput = document.getElementById("siteInput");
const timeInput = document.getElementById("timeInput");
const addBtn = document.getElementById("addBtn");
const feedback = document.getElementById("feedback");

const norm = (s) => s.trim().toLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/\/.*/, "")
  .replace(/^www\./, "");

function showFeedback(msg, err=false){
  feedback.textContent = msg;
  feedback.style.color = err ? "#dc2626" : "#059669";
  setTimeout(()=> feedback.textContent = "", 2200);
}

function renderSites(sites){
  siteList.innerHTML = "";
  Object.entries(sites).forEach(([site, minutes]) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="site">${site}</span>
      <span class="mins">${minutes} min</span>
      <button class="del">Remove</button>
    `;
    li.querySelector(".del").onclick = () => {
      const copy = { ...sites };
      delete copy[site];
      chrome.storage.local.set({ [SITES_KEY]: copy }, () => {
        renderSites(copy);
        showFeedback(`Removed ${site}`);
      });
    };
    siteList.appendChild(li);
  });
}

function loadSites(){
  chrome.storage.local.get(SITES_KEY, (data) => {
    renderSites(data[SITES_KEY] || {});
  });
}

addBtn.onclick = () => {
  const site = norm(siteInput.value);
  const minutes = parseInt(timeInput.value, 10);
  if (!site || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(site) || !minutes || minutes < 1) {
    showFeedback("Enter a valid domain and minutes.", true);
    return;
  }

  chrome.storage.local.get(SITES_KEY, (data) => {
    const sites = { ...(data[SITES_KEY] || {}) };
    sites[site] = minutes; // update or add
    chrome.storage.local.set({ [SITES_KEY]: sites }, () => {
      renderSites(sites);
      siteInput.value = "";
      timeInput.value = "";
      siteInput.focus();
      showFeedback(`Limit set for ${site}`);
    });
  });
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addBtn.click();
});

loadSites();

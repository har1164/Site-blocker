// ===== Site Blocker — Background (MV3) =====
const SITES_KEY = "sites";      // { "youtube.com": 15, ... } minutes
const USAGE_KEY = "usage";      // { "youtube.com": { minutesUsed, lastTracked, date } }
let userIdle = false;

// Utility: today's YYYY-MM-DD
const todayStr = () => new Date().toISOString().slice(0, 10);

// Normalize a domain string (lowercase, trim, strip protocol/path)
function normalizeDomain(input) {
  try {
    if (!input) return "";
    if (input.includes("://")) input = new URL(input).hostname;
    return input.trim().toLowerCase().replace(/^www\./, "");
  } catch {
    return input.trim().toLowerCase().replace(/^www\./, "");
  }
}

// Return matching site key from config for a URL hostname
function getMatchingSite(url, sites) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return Object.keys(sites || {}).find((siteDomain) => {
      const sd = normalizeDomain(siteDomain);
      return hostname === sd || hostname.endsWith("." + sd);
    });
  } catch {
    return undefined;
  }
}

// Ensure usage object exists and reset daily if needed
async function ensureUsageFor(site) {
  const usageData = (await chrome.storage.local.get(USAGE_KEY))[USAGE_KEY] || {};
  const today = todayStr();
  const u = usageData[site];

  if (!u || u.date !== today) {
    usageData[site] = { minutesUsed: 0, lastTracked: Date.now(), date: today };
    await chrome.storage.local.set({ [USAGE_KEY]: usageData });
  }
}

// Only count when: Chrome window focused & tab active, and user not idle
async function getActiveFocusedTab() {
  try {
    const w = await chrome.windows.getLastFocused({ populate: true });
    if (!w || !w.focused || !w.tabs) return null;
    const activeTab = w.tabs.find((t) => t.active && !t.discarded);
    return activeTab || null;
  } catch {
    return null;
  }
}

async function blockIfExceeded(tabId, site, sitesConfig) {
  const limit = sitesConfig[site];
  const usageData = (await chrome.storage.local.get(USAGE_KEY))[USAGE_KEY] || {};
  const u = usageData[site];
  if (!u) return;

  if (u.minutesUsed >= limit) {
    const blockedUrl = chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site)}`);
    try {
      await chrome.tabs.update(tabId, { url: blockedUrl });
    } catch (e) {
      console.warn("Failed to redirect to blocked page:", e?.message || e);
    }
  }
}

// Main tracker: runs every minute via alarms — increments by exactly 1 minute
async function trackUsage() {
  if (userIdle) return;

  const activeTab = await getActiveFocusedTab();
  if (!activeTab || !activeTab.url) return;

  const sitesConfig = (await chrome.storage.local.get(SITES_KEY))[SITES_KEY] || {};
  if (!Object.keys(sitesConfig).length) return;

  const match = getMatchingSite(activeTab.url, sitesConfig);
  if (!match) return;

  const today = todayStr();
  const data = await chrome.storage.local.get(USAGE_KEY);
  const usageData = data[USAGE_KEY] || {};
  let u = usageData[match];

  if (!u || u.date !== today) {
    u = { minutesUsed: 0, lastTracked: Date.now(), date: today };
  } else {
    u.minutesUsed += 1; // one minute per alarm tick
    u.lastTracked = Date.now();
  }

  usageData[match] = u;
  await chrome.storage.local.set({ [USAGE_KEY]: usageData });

  await blockIfExceeded(activeTab.id, match, sitesConfig);
}

// ---- Alarms & Lifecycle ----
function ensureAlarm() {
  chrome.alarms.get("trackUsage", (alarm) => {
    if (!alarm) chrome.alarms.create("trackUsage", { periodInMinutes: 1 });
  });
}

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "trackUsage") trackUsage();
});

// Idle state handling (active | idle | locked)
if (chrome.idle?.onStateChanged) {
  chrome.idle.onStateChanged.addListener((state) => {
    userIdle = state !== "active";
  });
}

// Block immediately if user opens a site already over limit
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  const sitesConfig = (await chrome.storage.local.get(SITES_KEY))[SITES_KEY] || {};
  if (!Object.keys(sitesConfig).length || !tab?.url) return;

  const match = getMatchingSite(tab.url, sitesConfig);
  if (!match) return;

  await ensureUsageFor(match);
  await blockIfExceeded(tabId, match, sitesConfig);
});

// Also check when switching tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const sitesConfig = (await chrome.storage.local.get(SITES_KEY))[SITES_KEY] || {};
    const match = tab?.url ? getMatchingSite(tab.url, sitesConfig) : null;
    if (match) {
      await ensureUsageFor(match);
      await blockIfExceeded(activeInfo.tabId, match, sitesConfig);
    }
  } catch {}
});

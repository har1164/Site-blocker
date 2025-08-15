// Parse site param from URL
function getSiteFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const site = params.get("site");
    return site;
  }
  
  async function extendTime() {
    const site = getSiteFromUrl();
    if (!site) return;
  
    chrome.runtime.sendMessage({ type: "extendTime", site, extraMinutes: 1 }, response => {
      if (response && response.success) {
        alert("Extended time by 1 minute! You can now use the site again.");
        window.history.back();
      } else {
        alert("Failed to extend time.");
      }
    });
  }
  
  function goBack() {
    window.history.back();
  }
  
  document.getElementById("extendBtn").addEventListener("click", extendTime);
  document.getElementById("goBackBtn").addEventListener("click", goBack);
  
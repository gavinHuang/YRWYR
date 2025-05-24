chrome.action.onClicked.addListener(function(tab) {
  chrome.tabs.create({ url: chrome.runtime.getURL("history_calendar.html") });
});

// Optional: If you want to focus the tab if it's already open, it's more complex.
// For now, this will always open a new tab. 
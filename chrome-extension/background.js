// background.js — the extension's "service worker".
// It runs in the background and has only two small jobs:
//   1. Open the side panel when the user clicks the extension icon.
//   2. Add the right-click menu "Explain with pageTLDR".
// All the real work happens in the side panel (sidepanel/), because the
// panel is where the user sees the results.

const MENU_ID = "pagetldr-explain";

// Job 1: clicking the toolbar icon opens the side panel.
// We call this every time the worker starts, because Chrome can stop and
// restart the worker at any time.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("pageTLDR: setPanelBehavior failed", error));

// Job 2: create the right-click menu. Chrome remembers menus between
// restarts, so we only need to create it when the extension is installed
// or updated.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Explain with pageTLDR",
    contexts: ["selection"], // only show the menu when text is selected
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab) return;

  // Open the panel FIRST. Chrome only allows sidePanel.open() as a direct
  // answer to a user action (the click), so we must not wait for anything
  // before this call.
  chrome.sidePanel.open({ tabId: tab.id });

  // Then leave the selected text in session storage. The panel reads it
  // when it starts, or sees the change if it is already open.
  // We use storage (not a message) because the panel may not be loaded yet.
  chrome.storage.session.set({
    pendingExplain: {
      text: info.selectionText,
      tabId: tab.id,
      time: Date.now(), // makes each request different, so a repeat click still fires
    },
  });
});

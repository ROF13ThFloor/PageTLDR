// sidepanel.js — the main code of the side panel.
// It connects everything: it watches the tabs, keeps the notes and chat of
// each tab, and calls the other files to do the real work.

import { loadSettings } from "../lib/settings-store.js";
import { canReadUrl, readPageText, highlightQuote } from "../lib/page-tools.js";
import { makeNotes, askAboutPage, explainSelection } from "../lib/reading-tasks.js";
import { notesToMarkdown, makeFileName, downloadTextFile } from "../lib/markdown.js";
import { renderNotes } from "./notes-view.js";
import { renderChat, setChatBusy, initChatForm } from "./chat-view.js";
import { initSettingsView } from "./settings-view.js";

const readButton = document.getElementById("read-button");
const saveButton = document.getElementById("save-button");
const pageTitleBox = document.getElementById("page-title");
const statusBox = document.getElementById("status");

const CANT_READ_MESSAGE =
  "Chrome does not let extensions read this kind of page (for example chrome:// pages or the Chrome Web Store). Please open a normal web page.";
const NO_TEXT_MESSAGE =
  "This page has no text to read. It may be only images or video, or a PDF file.";
const LONG_PAGE_MESSAGE =
  "Note: this page is very long, so pageTLDR read only the first part of it.";

// We keep one "page" object per tab:
//   { tabId, url, title, text, wasCut, notes, chat, status,
//     notesBusy, chatBusy, autoReadTried }
// It lives only in memory, so closing the panel forgets it. That is fine
// for a first version, and the user can save notes as a file.
const pages = new Map();
let currentTabId = null;
let myWindowId = null; // each Chrome window has its own panel
let lastExplainTime = 0; // so the same right-click is not handled twice

// ---------- Page objects ----------

// "#part" at the end of a URL only jumps inside the same page, so we ignore
// it. Otherwise clicking a link to a heading would throw the notes away.
function withoutHash(url) {
  return (url || "").split("#")[0];
}

// Returns the page object for a tab. Makes a new, empty one if the tab is
// new or now shows a different web page.
function getPage(tab) {
  let page = pages.get(tab.id);
  if (!page || withoutHash(page.url) !== withoutHash(tab.url)) {
    page = {
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      text: null, // filled when we first need it
      wasCut: false,
      notes: null,
      chat: [],
      status: null,
      notesBusy: false,
      chatBusy: false,
      autoReadTried: false,
    };
    pages.set(tab.id, page);
  }
  page.title = tab.title; // titles often change after the page loads
  return page;
}

// Work can finish after the user has moved to another tab. Then we save
// the result in the page object, but we must not show it right now.
function isShown(page) {
  return pages.get(currentTabId) === page;
}

// Gets the page text the first time we need it.
async function ensurePageText(page) {
  if (page.text !== null) return;
  if (!canReadUrl(page.url)) throw new Error(CANT_READ_MESSAGE);

  const { text, wasCut } = await readPageText(page.tabId);
  // A few letters (like a cookie button) are not a real page to read.
  if (text.trim().length < 20) throw new Error(NO_TEXT_MESSAGE);
  page.text = text;
  page.wasCut = wasCut;
}

// ---------- Showing things ----------

function render() {
  const page = pages.get(currentTabId);
  if (!page) return;

  pageTitleBox.textContent = page.title || page.url;
  renderNotes(page.notes, {
    onKeyPointClick: (item, button) => showKeyPointOnPage(page, item, button),
    onQuestionClick: (question) => askQuestion(page, question),
  });
  renderChat(page.chat);
  setChatBusy(page.chatBusy);

  readButton.disabled = page.notesBusy || !canReadUrl(page.url);
  readButton.textContent = page.notes ? "Read again" : "Read page";
  saveButton.disabled = !page.notes && page.chat.length === 0;
  renderStatus(page);
}

function renderStatus(page) {
  // If there is no special message, show a helpful tip instead.
  let status = page.status;
  if (!status && !canReadUrl(page.url)) status = { text: CANT_READ_MESSAGE, kind: "info" };
  if (!status && !page.notes) status = { text: "Click “Read page” to make notes for this page.", kind: "info" };

  statusBox.hidden = !status;
  if (status) {
    statusBox.textContent = status.text;
    statusBox.classList.toggle("error", status.kind === "error");
  }
}

// kind is "info" or "error". text = null removes the message.
function setStatus(page, text, kind = "info") {
  page.status = text ? { text, kind } : null;
  if (isShown(page)) renderStatus(page);
}

// ---------- Actions ----------

async function readPage(page) {
  if (page.notesBusy) return;
  const settings = await loadSettings();
  if (!settings.openrouterKey) {
    setStatus(page, "Please add your OpenRouter API key in Settings (⚙) first.", "error");
    return;
  }

  page.notesBusy = true;
  page.text = null; // read fresh text, in case the page has changed
  if (isShown(page)) render();
  try {
    setStatus(page, "Reading the page…");
    await ensurePageText(page);
    setStatus(page, "The AI is making notes… This can take up to a minute.");
    page.notes = await makeNotes(settings, page);
    setStatus(page, page.wasCut ? LONG_PAGE_MESSAGE : null);
  } catch (error) {
    setStatus(page, error.message, "error");
  } finally {
    page.notesBusy = false;
    if (isShown(page)) render();
  }
}

// One chat turn: show the user's text, get an answer, show the answer.
// getAnswer(settings, history) does the real work and returns text.
async function runChatTurn(page, userText, getAnswer) {
  if (page.chatBusy) return;

  // Only finished question/answer pairs go to the model as history.
  const history = page.chat.filter((turn) => turn.role !== "error" && !turn.failed);
  const userTurn = { role: "user", text: userText };
  page.chat.push(userTurn);
  page.chatBusy = true;
  if (isShown(page)) render();

  try {
    const settings = await loadSettings();
    const answer = await getAnswer(settings, history);
    page.chat.push({ role: "assistant", text: answer });
  } catch (error) {
    userTurn.failed = true; // keep it on screen, but do not send it again
    page.chat.push({ role: "error", text: error.message });
  } finally {
    page.chatBusy = false;
    if (isShown(page)) render();
  }
}

function askQuestion(page, question) {
  return runChatTurn(page, question, async (settings, history) => {
    await ensurePageText(page);
    return askAboutPage(settings, page, history, question);
  });
}

function explainText(page, selectedText) {
  return runChatTurn(page, `Explain: “${selectedText}”`, async (settings) => {
    try {
      await ensurePageText(page);
    } catch {
      // We could not read the page (for example, a PDF). We can still
      // explain the selected text alone, so this is not an error.
    }
    return explainSelection(settings, page, selectedText);
  });
}

async function showKeyPointOnPage(page, item, button) {
  document.querySelectorAll("#key-points .found").forEach((b) => b.classList.remove("found"));
  try {
    const found = await highlightQuote(page.tabId, item.quote);
    if (found) {
      button.classList.add("found");
      setStatus(page, null);
    } else {
      setStatus(page, "Could not find this sentence on the page. The page may have changed since it was read.");
    }
  } catch {
    setStatus(page, "Could not mark the text on this page.", "error");
  }
}

function saveNotes() {
  const page = pages.get(currentTabId);
  if (!page) return;
  downloadTextFile(makeFileName(page.title), notesToMarkdown(page));
}

// ---------- Following the tabs ----------

async function showActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, windowId: myWindowId });
  if (!tab) return;
  currentTabId = tab.id;
  const page = getPage(tab);
  render();

  // "Read each new page by itself": only once per page, and only when the
  // page has finished loading. autoReadTried stops endless tries on errors.
  const settings = await loadSettings();
  const shouldAutoRead =
    settings.autoRead &&
    settings.openrouterKey &&
    tab.status === "complete" &&
    canReadUrl(tab.url) &&
    !page.notes &&
    !page.notesBusy &&
    !page.autoReadTried;
  if (shouldAutoRead) {
    page.autoReadTried = true;
    readPage(page);
  }
}

// The right-click menu (background.js) leaves its request in session storage.
async function handleExplainRequest(request) {
  // Ignore old requests, for example from before the panel was closed.
  if (!request || Date.now() - request.time > 60 * 1000) return;
  if (request.time === lastExplainTime) return;
  lastExplainTime = request.time;
  await chrome.storage.session.remove("pendingExplain");

  const tab = await chrome.tabs.get(request.tabId).catch(() => null);
  if (!tab) return;
  explainText(getPage(tab), request.text);
}

// ---------- Start ----------

async function init() {
  myWindowId = (await chrome.windows.getCurrent()).id;

  readButton.addEventListener("click", () => {
    const page = pages.get(currentTabId);
    if (page) readPage(page);
  });
  saveButton.addEventListener("click", saveNotes);
  initChatForm((question) => {
    const page = pages.get(currentTabId);
    if (page) askQuestion(page, question);
  });
  initSettingsView(showActiveTab); // settings may have changed: show again

  // The user switched to another tab.
  chrome.tabs.onActivated.addListener((info) => {
    if (info.windowId === myWindowId) showActiveTab();
  });
  // The tab opened a new page, finished loading, or changed its title.
  chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (tab.windowId !== myWindowId || !tab.active) return;
    if (change.url || change.status === "complete" || change.title) showActiveTab();
  });
  chrome.tabs.onRemoved.addListener((tabId) => pages.delete(tabId));

  // Right-click "Explain with pageTLDR", while the panel is open...
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes.pendingExplain?.newValue) {
      handleExplainRequest(changes.pendingExplain.newValue);
    }
  });

  await showActiveTab();

  // ...or the request that opened the panel just now.
  const { pendingExplain } = await chrome.storage.session.get("pendingExplain");
  handleExplainRequest(pendingExplain);
}

init();

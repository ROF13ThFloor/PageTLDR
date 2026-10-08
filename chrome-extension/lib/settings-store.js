// settings-store.js — loads and saves the user's settings.
//
// We use chrome.storage.local: it lives only in this browser profile on
// this computer. It is not synced to other computers (chrome.storage.sync
// would copy the API key to Google's servers), and it is never in git.

export const DEFAULT_SETTINGS = {
  apiKey: "",
  model: "claude-sonnet-5-5",
  language: "English",
  simpleWords: true,
  // Off by default: reading every page costs money (API tokens).
  autoRead: false,
};

export async function loadSettings() {
  // When we pass an object, Chrome fills in the default for any missing key.
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  // An empty text box would mean "no model", so fall back to the default.
  if (!settings.model.trim()) settings.model = DEFAULT_SETTINGS.model;
  if (!settings.language.trim()) settings.language = DEFAULT_SETTINGS.language;
  return settings;
}

export async function saveSettings(settings) {
  await chrome.storage.local.set(settings);
}

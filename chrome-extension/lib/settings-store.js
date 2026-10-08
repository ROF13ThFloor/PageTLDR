// settings-store.js — loads and saves the user's settings.
//
// We use chrome.storage.local: it lives only in this browser profile on
// this computer. It is not synced to other computers (chrome.storage.sync
// would copy the API key to Google's servers), and it is never in git.

// The key and model have new names (not "apiKey" and "model"), so a
// Claude key saved by an older version is never sent to OpenRouter.
export const DEFAULT_SETTINGS = {
  openrouterKey: "",
  // A free model with a big context and "structured outputs" support.
  // Free models come and go: see https://openrouter.ai/models?max_price=0
  openrouterModel: "nvidia/nemotron-3-super-120b-a12b:free",
  language: "English",
  simpleWords: true,
  // Off by default: reading every page uses your free daily requests
  // (or credits, for paid models).
  autoRead: false,
};

export async function loadSettings() {
  // When we pass an object, Chrome fills in the default for any missing key.
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  // An empty text box would mean "no model", so fall back to the default.
  if (!settings.openrouterModel.trim()) settings.openrouterModel = DEFAULT_SETTINGS.openrouterModel;
  if (!settings.language.trim()) settings.language = DEFAULT_SETTINGS.language;
  return settings;
}

export async function saveSettings(settings) {
  await chrome.storage.local.set(settings);
}

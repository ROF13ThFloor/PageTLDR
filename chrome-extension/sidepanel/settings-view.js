// settings-view.js — the settings page inside the panel.

import { loadSettings, saveSettings } from "../lib/settings-store.js";

const mainView = document.getElementById("main-view");
const settingsView = document.getElementById("settings-view");
const form = document.getElementById("settings-form");
const savedMessage = document.getElementById("settings-saved");

const fields = {
  openrouterKey: document.getElementById("setting-api-key"),
  openrouterModel: document.getElementById("setting-model"),
  language: document.getElementById("setting-language"),
  simpleWords: document.getElementById("setting-simple-words"),
  autoRead: document.getElementById("setting-auto-read"),
};

// onClose() is called when the user goes back to the notes.
export function initSettingsView(onClose) {
  document.getElementById("settings-button").addEventListener("click", openSettings);

  document.getElementById("settings-back").addEventListener("click", () => {
    settingsView.hidden = true;
    mainView.hidden = false;
    onClose();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSettings({
      openrouterKey: fields.openrouterKey.value.trim(),
      openrouterModel: fields.openrouterModel.value.trim(),
      language: fields.language.value.trim(),
      simpleWords: fields.simpleWords.checked,
      autoRead: fields.autoRead.checked,
    });
    savedMessage.hidden = false;
    setTimeout(() => (savedMessage.hidden = true), 2000);
  });
}

async function openSettings() {
  // Load fresh values each time, so the form always shows what is saved.
  const settings = await loadSettings();
  fields.openrouterKey.value = settings.openrouterKey;
  fields.openrouterModel.value = settings.openrouterModel;
  fields.language.value = settings.language;
  fields.simpleWords.checked = settings.simpleWords;
  fields.autoRead.checked = settings.autoRead;

  savedMessage.hidden = true;
  mainView.hidden = true;
  settingsView.hidden = false;
}

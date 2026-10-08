// reading-tasks.js — the three things we ask the model to do:
//   1. makeNotes:        summary, key points, words, questions
//   2. askAboutPage:     answer a chat question
//   3. explainSelection: explain text the user selected
// Each one puts the prompts (prompts.js) together and calls askModel.

import { askModel, ModelError } from "./openrouter-api.js";
import {
  NOTES_SCHEMA,
  NOTES_REQUEST,
  buildSystemPrompt,
  buildDocumentBlock,
  buildExplainRequest,
} from "./prompts.js";

// Many free models cannot be forced to follow NOTES_SCHEMA, so we also
// describe the JSON in words. (This is added here, not in prompts.js,
// because prompts.js must stay the same as the Zotero plugin's copy.)
const JSON_REQUEST = [
  "Answer with only one JSON object and nothing else: no Markdown, no ``` fences, no text before or after it.",
  "The JSON must follow this JSON Schema:",
  JSON.stringify(NOTES_SCHEMA),
].join("\n");

// The first user message always starts with the same document block.
function documentContent(page) {
  return { type: "text", text: buildDocumentBlock(page.title, page.text) };
}

// page: { title, text }. Returns { summary, keyPoints, words, questions }.
export async function makeNotes(settings, page) {
  const notes = await askModel({
    settings,
    system: buildSystemPrompt(settings),
    messages: [
      {
        role: "user",
        content: [documentContent(page), { type: "text", text: `${NOTES_REQUEST}\n\n${JSON_REQUEST}` }],
      },
    ],
    jsonSchema: NOTES_SCHEMA,
  });
  return cleanNotes(notes);
}

// Models that do not follow the schema exactly may leave out fields or use
// the wrong types. This keeps only what the panel can show, so a slightly
// wrong answer still works and a very wrong one gives a clear error.
function cleanNotes(notes) {
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const list = (value) => (Array.isArray(value) ? value : []);

  const cleaned = {
    summary: text(notes?.summary),
    keyPoints: list(notes?.keyPoints)
      .map((item) => ({ point: text(item?.point), quote: text(item?.quote), page: text(item?.page) }))
      .filter((item) => item.point),
    words: list(notes?.words)
      .map((item) => ({ word: text(item?.word), meaning: text(item?.meaning) }))
      .filter((item) => item.word && item.meaning),
    questions: list(notes?.questions).map(text).filter(Boolean),
  };

  if (!cleaned.summary && cleaned.keyPoints.length === 0) {
    throw new ModelError(
      "The model's answer was not in the expected format. Please try again, or choose another model in Settings (⚙)."
    );
  }
  return cleaned;
}

// history: earlier chat turns, [{ role: "user" | "assistant", text }].
// Returns the answer as text.
export async function askAboutPage(settings, page, history, question) {
  const turns = [...history, { role: "user", text: question }];

  const messages = turns.map((turn, index) => {
    // The page text goes only into the very first message.
    if (index === 0) {
      return {
        role: "user",
        content: [documentContent(page), { type: "text", text: turn.text }],
      };
    }
    return { role: turn.role, content: turn.text };
  });

  return askModel({ settings, system: buildSystemPrompt(settings), messages });
}

// page may have no text (for example, if Chrome did not let us read it).
// Then the model explains the selected text alone.
export async function explainSelection(settings, page, selectedText) {
  const request = { type: "text", text: buildExplainRequest(selectedText) };
  const content = page.text ? [documentContent(page), request] : [request];

  return askModel({
    settings,
    system: buildSystemPrompt(settings),
    messages: [{ role: "user", content }],
  });
}

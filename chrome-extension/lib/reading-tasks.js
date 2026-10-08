// reading-tasks.js — the three things we ask Claude to do:
//   1. makeNotes:        summary, key points, words, questions
//   2. askAboutPage:     answer a chat question
//   3. explainSelection: explain text the user selected
// Each one puts the prompts (prompts.js) together and calls askClaude.

import { askClaude } from "./claude-api.js";
import {
  NOTES_SCHEMA,
  NOTES_REQUEST,
  buildSystemPrompt,
  buildDocumentBlock,
  buildExplainRequest,
} from "./prompts.js";

// The first user message always starts with the same document block.
// "cache_control" asks the API to remember (cache) this part for a few
// minutes. Then the chat questions that follow are faster and cheaper,
// because Claude does not need to read the whole page again.
function documentContent(page) {
  return {
    type: "text",
    text: buildDocumentBlock(page.title, page.text),
    cache_control: { type: "ephemeral" },
  };
}

// page: { title, text }. Returns { summary, keyPoints, words, questions }.
export async function makeNotes(settings, page) {
  return askClaude({
    settings,
    system: buildSystemPrompt(settings),
    messages: [
      {
        role: "user",
        content: [documentContent(page), { type: "text", text: NOTES_REQUEST }],
      },
    ],
    jsonSchema: NOTES_SCHEMA,
  });
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

  return askClaude({ settings, system: buildSystemPrompt(settings), messages });
}

// page may have no text (for example, if Chrome did not let us read it).
// Then Claude explains the selected text alone.
export async function explainSelection(settings, page, selectedText) {
  const request = { type: "text", text: buildExplainRequest(selectedText) };
  const content = page.text ? [documentContent(page), request] : [request];

  return askClaude({
    settings,
    system: buildSystemPrompt(settings),
    messages: [{ role: "user", content }],
  });
}

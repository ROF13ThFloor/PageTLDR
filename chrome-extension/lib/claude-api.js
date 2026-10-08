// claude-api.js — sends one request to the Claude API and returns the answer.
//
// We use plain fetch() instead of the official Anthropic SDK, because the
// SDK needs npm and a bundler, and this project has no build step.
// API reference: https://platform.claude.com/docs/en/api/messages

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// If Claude's safety filter wrongly declines a request, these models can
// let the API try again on another model by itself ("fallbacks").
// Older models do not know this option and would reject the request,
// so we only turn it on for these names.
const MODELS_WITH_FALLBACK = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"];
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

// Long papers can take a while. After this time we stop waiting.
const TIMEOUT_MS = 5 * 60 * 1000;

// An error with a message that is safe and useful to show to the user.
export class ClaudeError extends Error {}

// Sends a request to Claude.
//   settings:   { apiKey, model }
//   system:     the system prompt (general rules)
//   messages:   [{ role: "user" | "assistant", content: ... }]
//   jsonSchema: optional. If given, Claude must answer with JSON in this
//               shape, and we return the parsed object instead of text.
export async function askClaude({ settings, system, messages, jsonSchema }) {
  if (!settings.apiKey) {
    throw new ClaudeError("Please add your Claude API key in Settings (⚙) first.");
  }

  const body = {
    model: settings.model,
    max_tokens: 16000,
    system,
    messages,
  };
  if (jsonSchema) {
    body.output_config = { format: { type: "json_schema", schema: jsonSchema } };
  }

  const headers = {
    "content-type": "application/json",
    "x-api-key": settings.apiKey,
    "anthropic-version": API_VERSION,
    // The API blocks calls from web pages by default, to protect keys.
    // Our key is the user's own key, kept in their own browser, so we
    // allow it with this header.
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (MODELS_WITH_FALLBACK.includes(settings.model)) {
    body.fallbacks = "default";
    headers["anthropic-beta"] = FALLBACK_BETA;
  }

  const response = await sendRequest(headers, body);
  if (!response.ok) {
    throw new ClaudeError(await describeHttpError(response, settings.model));
  }

  const data = await response.json();
  return readAnswer(data, Boolean(jsonSchema));
}

// Does the fetch, and turns network problems into clear messages.
async function sendRequest(headers, body) {
  try {
    return await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === "TimeoutError") {
      throw new ClaudeError("Claude took too long to answer. Please try again.");
    }
    // fetch() only throws (instead of returning a response) when it
    // could not reach the server at all.
    throw new ClaudeError("Could not reach Claude. Please check your internet connection.");
  }
}

// Turns the API answer into text (or a parsed object for JSON answers).
function readAnswer(data, wantJson) {
  // Always check why Claude stopped, before reading the content.
  if (data.stop_reason === "refusal") {
    throw new ClaudeError("Claude declined to answer this request.");
  }
  if (data.stop_reason === "max_tokens") {
    throw new ClaudeError("Claude's answer was too long and got cut off. Please try again.");
  }

  // The answer is a list of "content blocks". We only want the text ones.
  const text = data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!wantJson) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new ClaudeError("Claude's answer was not in the expected format. Please try again.");
  }
}

// Makes a clear message for each kind of HTTP error.
async function describeHttpError(response, model) {
  // The API sends details as { error: { type, message } }.
  let apiMessage = "";
  try {
    const data = await response.json();
    apiMessage = data.error?.message || "";
  } catch {
    // The body was not JSON. We still have the status code.
  }

  switch (response.status) {
    case 400:
      return `Claude could not use this request. ${apiMessage}`;
    case 401:
      return "Your API key is wrong or no longer works. Please check it in Settings (⚙).";
    case 403:
      return `Your API key is not allowed to do this. ${apiMessage}`;
    case 404:
      return `The model "${model}" was not found. Please check the model name in Settings (⚙).`;
    case 413:
      return "The text is too long to send to Claude.";
    case 429:
      return `Too many requests, or your account has no credits left. Please wait a minute and try again. ${apiMessage}`;
    default:
      if (response.status >= 500) {
        return "Claude is busy or has a problem right now. Please try again in a minute.";
      }
      return `Something went wrong (error ${response.status}). ${apiMessage}`;
  }
}

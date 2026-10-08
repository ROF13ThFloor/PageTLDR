// openrouter-api.js — sends one request to OpenRouter and returns the answer.
//
// OpenRouter (https://openrouter.ai) gives one API for many AI models,
// including free ones (model names that end in ":free"). Its API uses the
// "OpenAI chat completions" format.
// API reference: https://openrouter.ai/docs/api-reference/chat-completion

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Long papers can take a while, and free models are often slow.
// After this time we stop waiting.
const TIMEOUT_MS = 5 * 60 * 1000;

// An error with a message that is safe and useful to show to the user.
export class ModelError extends Error {}

// Sends a request to the model.
//   settings:   { openrouterKey, openrouterModel }
//   system:     the system prompt (general rules)
//   messages:   [{ role: "user" | "assistant", content: ... }]
//   jsonSchema: optional. If given, we ask for JSON in this shape, and we
//               return the parsed object instead of text.
export async function askModel({ settings, system, messages, jsonSchema }) {
  if (!settings.openrouterKey) {
    throw new ModelError("Please add your OpenRouter API key in Settings (⚙) first.");
  }

  const body = {
    model: settings.openrouterModel,
    max_tokens: 16000,
    // In this API format, the system prompt is the first message.
    messages: [{ role: "system", content: system }, ...messages],
  };
  if (jsonSchema) {
    // Models that support "structured outputs" must follow the schema.
    // Many free models do not support it; OpenRouter then just ignores
    // this field, so the prompt also describes the JSON (reading-tasks.js),
    // and readAnswer() parses the answer carefully.
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "reading_notes", strict: true, schema: jsonSchema },
    };
  }

  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${settings.openrouterKey}`,
    // Optional: the app name shown in the user's OpenRouter activity list.
    "X-Title": "pageTLDR",
  };

  const response = await sendRequest(headers, body);
  if (!response.ok) {
    throw new ModelError(await describeHttpError(response, settings.openrouterModel));
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
      throw new ModelError("The model took too long to answer. Please try again.");
    }
    // fetch() only throws (instead of returning a response) when it
    // could not reach the server at all.
    throw new ModelError("Could not reach OpenRouter. Please check your internet connection.");
  }
}

// Turns the API answer into text (or a parsed object for JSON answers).
function readAnswer(data, wantJson) {
  // OpenRouter can report a problem from the model inside a normal answer.
  if (data.error) {
    throw new ModelError(`The model had a problem: ${data.error.message || "unknown error"}`);
  }

  const choice = data.choices?.[0];
  if (!choice) {
    throw new ModelError("The model sent an empty answer. Please try again.");
  }

  // Always check why the model stopped, before reading the content.
  if (choice.finish_reason === "content_filter" || choice.message?.refusal) {
    throw new ModelError("The model declined to answer this request.");
  }
  if (choice.finish_reason === "length") {
    throw new ModelError("The answer was too long and got cut off. Please try again.");
  }

  const text = choice.message?.content || "";
  if (!text.trim()) {
    throw new ModelError("The model sent an empty answer. Please try again.");
  }

  if (!wantJson) return text;
  return parseJson(text);
}

// Models without structured outputs sometimes wrap the JSON in ```json
// fences or add a sentence around it. So we take the part from the first
// "{" to the last "}".
function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // Fall through to the error below.
    }
  }
  throw new ModelError(
    "The model's answer was not in the expected format. Please try again, or choose another model in Settings (⚙)."
  );
}

// Makes a clear message for each kind of HTTP error.
async function describeHttpError(response, model) {
  // The API sends details as { error: { code, message } }.
  let apiMessage = "";
  try {
    const data = await response.json();
    apiMessage = data.error?.message || "";
  } catch {
    // The body was not JSON. We still have the status code.
  }

  switch (response.status) {
    case 400:
      return `The model could not use this request. ${apiMessage}`;
    case 401:
      return "Your OpenRouter API key is wrong or no longer works. Please check it in Settings (⚙).";
    case 402:
      return "Your OpenRouter account has no credits left for this model. Choose a free model (its name ends in \":free\") or add credits.";
    case 403:
      return `OpenRouter did not allow this request. ${apiMessage}`;
    case 404:
      return `The model "${model}" was not found, or none of its providers can take this request. Please check the model name in Settings (⚙), and your OpenRouter privacy settings. ${apiMessage}`;
    case 408:
      return "The model took too long to answer. Please try again.";
    case 413:
      return "The text is too long for this model.";
    case 429:
      return `Too many requests. Free models have a limit per minute and per day. Please wait and try again. ${apiMessage}`;
    default:
      if (response.status >= 500) {
        return "The model is busy or down right now. Please try again in a minute, or choose another model in Settings (⚙).";
      }
      return `Something went wrong (error ${response.status}). ${apiMessage}`;
  }
}

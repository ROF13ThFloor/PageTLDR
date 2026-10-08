// chat-view.js — shows the chat messages and reads the chat box.

const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const sendButton = document.getElementById("chat-send");

// chat: [{ role: "user" | "assistant" | "error", text }]
export function renderChat(chat) {
  chatLog.replaceChildren();
  for (const turn of chat) {
    const bubble = document.createElement("div");
    bubble.className = `chat-message ${turn.role}`;
    bubble.textContent = turn.text; // plain text only, never HTML
    chatLog.append(bubble);
  }
  // Show the newest message.
  chatLog.lastElementChild?.scrollIntoView({ block: "nearest" });
}

// While the model is answering, stop the user from sending more questions.
export function setChatBusy(isBusy) {
  sendButton.disabled = isBusy;
  sendButton.textContent = isBusy ? "…" : "Send";
}

// onSend(question) is called when the user sends a question.
export function initChatForm(onSend) {
  chatForm.addEventListener("submit", (event) => {
    event.preventDefault(); // stop the browser from reloading the panel
    const question = chatInput.value.trim();
    if (!question || sendButton.disabled) return;
    chatInput.value = "";
    onSend(question);
  });

  // Enter sends; Shift+Enter makes a new line (like most chat apps).
  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });
}

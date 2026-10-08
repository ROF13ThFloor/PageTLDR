// notes-view.js — shows the notes (summary, key points, words, questions).
//
// Safety rule: text from the page or from the model is only ever put in with
// textContent, never as HTML. So even if the text contains something like
// <script>, it is shown as plain letters and never runs.

const notesBox = document.getElementById("notes");
const summaryBox = document.getElementById("summary");
const keyPointsList = document.getElementById("key-points");
const wordsList = document.getElementById("words");
const questionsList = document.getElementById("questions");

// notes:    { summary, keyPoints, words, questions }, or null to hide
// handlers: { onKeyPointClick(item, button), onQuestionClick(question) }
export function renderNotes(notes, handlers) {
  keyPointsList.replaceChildren();
  wordsList.replaceChildren();
  questionsList.replaceChildren();

  if (!notes) {
    notesBox.hidden = true;
    return;
  }

  summaryBox.textContent = notes.summary;

  for (const item of notes.keyPoints) {
    const button = makeButton(item.point);
    button.title = `From the page: “${item.quote}”`;
    button.addEventListener("click", () => handlers.onKeyPointClick(item, button));
    keyPointsList.append(wrapInListItem(button));
  }

  for (const item of notes.words) {
    const term = document.createElement("dt");
    term.textContent = item.word;
    const meaning = document.createElement("dd");
    meaning.textContent = item.meaning;
    wordsList.append(term, meaning);
  }

  for (const question of notes.questions) {
    const button = makeButton(question);
    button.addEventListener("click", () => handlers.onQuestionClick(question));
    questionsList.append(wrapInListItem(button));
  }

  notesBox.hidden = false;
}

function makeButton(text) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  return button;
}

function wrapInListItem(element) {
  const item = document.createElement("li");
  item.append(element);
  return item;
}

// markdown.js — turns the notes into a Markdown file and downloads it.

// page: { title, url, notes, chat }
export function notesToMarkdown(page) {
  const lines = [`# Notes: ${page.title || "Untitled page"}`, "", `Source: ${page.url}`, ""];
  const notes = page.notes;

  if (notes) {
    lines.push("## Summary", "", notes.summary, "");

    lines.push("## Key points", "");
    for (const item of notes.keyPoints) {
      lines.push(`- ${item.point}`);
      // "> " makes a Markdown quote block under the point.
      if (item.quote) lines.push(`  > ${item.quote}`);
    }
    lines.push("");

    lines.push("## Words to know", "");
    for (const item of notes.words) {
      lines.push(`- **${item.word}**: ${item.meaning}`);
    }
    lines.push("");

    lines.push("## Questions", "");
    for (const question of notes.questions) {
      lines.push(`- ${question}`);
    }
    lines.push("");
  }

  // Only real questions and answers. Error messages are not useful notes.
  const chat = page.chat.filter((turn) => turn.role === "user" || turn.role === "assistant");
  if (chat.length > 0) {
    lines.push("## Chat", "");
    for (const turn of chat) {
      const who = turn.role === "user" ? "**You:**" : "**Reading Lens:**";
      lines.push(`${who} ${turn.text}`, "");
    }
  }

  return lines.join("\n");
}

// Makes a safe file name from the page title, like "my-article-notes.md".
export function makeFileName(title) {
  const slug = (title || "page")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-") // keep letters in any language
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "page"}-notes.md`;
}

// Downloads text as a file. A temporary link with the "download" attribute
// does this without needing the "downloads" permission.
export function downloadTextFile(fileName, text) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

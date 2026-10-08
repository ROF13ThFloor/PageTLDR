// page-tools.js — things we do inside the web page itself:
//   - read the page text
//   - find a sentence on the page, scroll to it, and mark it in yellow
//
// The side panel cannot touch the web page directly. So we use
// chrome.scripting.executeScript(), which runs ONE function inside the page
// and sends back its return value.
// Because of this, the functions that run in the page (getTextInPage and
// highlightInPage) must not use anything from outside their own body.

// Very long pages cost a lot and may not fit. About 300,000 characters is
// roughly 75,000 tokens, which is plenty for normal articles.
const MAX_CHARS = 300000;

// Chrome does not let extensions read its own pages (chrome://...), the
// Chrome Web Store, or other extensions. We only try normal web pages and
// local files.
export function canReadUrl(url) {
  return /^(https?|file):/.test(url || "");
}

// Returns { text, wasCut }.
export async function readPageText(tabId) {
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      func: getTextInPage,
    });
  } catch (error) {
    // Happens for pages Chrome protects, or for local files when
    // "Allow access to file URLs" is off.
    throw new Error("Chrome does not let pageTLDR read this page.");
  }

  const text = results[0]?.result || "";
  if (text.length > MAX_CHARS) {
    return { text: text.slice(0, MAX_CHARS), wasCut: true };
  }
  return { text, wasCut: false };
}

// Runs INSIDE the web page.
function getTextInPage() {
  // innerText gives the text as the user sees it (no hidden parts, no code).
  return document.body ? document.body.innerText : "";
}

// Finds the quote on the page, scrolls to it, and marks it in yellow.
// Returns true if it was found.
export async function highlightQuote(tabId, quote) {
  // The yellow color for our marker. We use the "CSS Custom Highlight API":
  // it colors text without changing the page's HTML, so it cannot break
  // the page. insertCSS also works on pages with strict security rules.
  // (Adding the same rule again on each click does no harm.)
  await chrome.scripting.insertCSS({
    target: { tabId },
    css: "::highlight(pagetldr) { background-color: #ffeb3b; color: #000; }",
  });

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: highlightInPage,
    args: [quote],
  });
  return results[0]?.result === true;
}

// Runs INSIDE the web page.
function highlightInPage(quote) {
  // Makes small differences not matter: upper/lower case, curly quotes,
  // and long dashes. Each letter becomes exactly one letter, so positions
  // stay the same.
  function simplify(letter) {
    return letter
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-");
  }

  // Step 1: build one long string of all visible page text, with every run
  // of spaces/new lines squeezed into one space. For each letter, remember
  // where it came from (which text node, and which position in it).
  const letters = [];
  const places = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip hidden text: we could not scroll to it anyway.
      if (!parent.checkVisibility()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let lastWasSpace = true;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue;
    for (let i = 0; i < text.length; i++) {
      const isSpace = /\s/.test(text[i]);
      if (isSpace && lastWasSpace) continue;
      letters.push(isSpace ? " " : simplify(text[i]));
      places.push({ node, offset: i });
      lastWasSpace = isSpace;
    }
  }
  const pageText = letters.join("");

  // Step 2: look for the quote. Claude sometimes changes a word or two, so
  // if the full quote is not found, we try only its beginning, then only
  // its end.
  const words = simplify(quote).split(/\s+/).filter(Boolean);
  const tries = [words.join(" "), words.slice(0, 8).join(" "), words.slice(-8).join(" ")];

  for (const needle of tries) {
    if (needle.length < 10) continue; // too short: would match random places
    const start = pageText.indexOf(needle);
    if (start === -1) continue;

    // Step 3: turn the found position back into a range on the page.
    const first = places[start];
    const last = places[start + needle.length - 1];
    const range = document.createRange();
    range.setStart(first.node, first.offset);
    range.setEnd(last.node, last.offset + 1);

    // Step 4: mark it (this replaces the old mark) and scroll to it.
    CSS.highlights.set("pagetldr", new Highlight(range));
    first.node.parentElement.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }
  return false;
}

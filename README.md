# pageTLDR

An AI reading helper. The Chrome extension uses OpenRouter (free models
work), and the Zotero plugin uses the Claude API.
It helps you read and understand web pages and research papers.

<!-- It has two parts:

| Part | Folder | What it does |
|---|---|---|
| Chrome extension | [`chrome-extension/`](chrome-extension/) | A side panel next to a web page. It shows a summary, key points, hard words, and questions. You can also chat about the page. |
| Zotero plugin | [`zotero-plugin/`](zotero-plugin/) | Right-click a paper in Zotero. It reads the PDF text and saves the notes as a child note. |

Both parts use the same instructions for the AI, so the notes look the same.

## Quick start

- How to load and test each part: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- How the code works: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

You need your own API keys:

- Chrome extension: an OpenRouter key (from https://openrouter.ai/settings/keys).
  Models whose name ends in `:free` cost nothing, but have daily limits.
- Zotero plugin: a Claude API key (from https://platform.claude.com/).

You type each key into the settings of its part. It is saved only on your computer,
never in the code or in git.

## Rules for this code

- Plain JavaScript. No frameworks, no TypeScript, no build step.
- Small files: one file = one job.
- Never put text from a web page or from the AI into the page as HTML.

## License

MIT. See [LICENSE](LICENSE). -->

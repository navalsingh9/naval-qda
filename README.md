# NAVAL-QDA

**NAVAL-QDA** is a desktop application for qualitative data analysis (QDA) — import interview transcripts, documents, and media, code them against a hierarchical node tree, run text/coding queries, visualize patterns, and generate reports, all from a local Electron + React app.

> Status: early / pre-release. See [Releases](https://github.com/navalsingh9/naval-qda/releases) for the current version. APIs and schema may change without notice.

## Features

- **Sources** — import `.txt`, `.docx`, and `.pdf` documents, plus audio/video for transcription.
- **Coding** — build a hierarchical node (code) tree, apply codes to text selections, merge/move nodes, track percent-coded.
- **Cases & attributes** — classify sources by case and attribute, with a classification sheet view.
- **Memos** — attach analytic memos to sources, cases, or nodes.
- **Queries** — text search, word frequency, coding queries, matrix coding queries, and coding comparison with kappa interpretation.
- **Visualizations** — word clouds, hierarchy treemaps, and similarity clustering (by word or by coding pattern).
- **Reports** — generate coding reports and project summaries.
- **AI assist (optional)** — source summarization and child-code suggestions, pluggable to a Gemini-backed provider.
- **Local-first** — project data is stored in a local SQLite database; nothing leaves your machine unless you enable the AI provider.

See the [feature tour](docs/TOUR.md) for a screenshot walkthrough of the current app.

## Tech stack

| Layer      | Tech                                                   |
|------------|---------------------------------------------------------|
| Shell      | [Electron](https://www.electronjs.org/) 43              |
| Frontend   | React 19 + TypeScript, [Vite](https://vitejs.dev/), Zustand, React Router |
| Backend    | Node.js, `better-sqlite3` (falls back to Node's built-in `node:sqlite`) |
| Packaging  | `electron-builder` (Windows NSIS, macOS DMG, Linux AppImage/deb) |
| Tests      | Node's built-in `node:test` runner |


## AI features (optional)

AI-assisted summarization and code suggestion are opt-in. Set a provider and API key via environment variable before launching:

```bash
export GEMINI_API_KEY="your-key-here"
```

Without a key set, the app falls back to local placeholder summaries/suggestions so the rest of the app remains fully usable offline.

## Data storage

Project data lives in a local SQLite database under Electron's `userData` directory (varies by OS). No project data is sent anywhere unless you explicitly enable an AI provider and it summarizes/suggests based on your source content — see [SECURITY.md](SECURITY.md) for details.

## Contributing

Issues and pull requests are welcome. Please run the backend test suite (`node --test backend`) and frontend lint (`npm --prefix frontend run lint`) before submitting a PR. For submitting bugs, feedback, requests, here is the [Google Form](https://forms.gle/GsarmnrRiu1ZhsKUA)

## Security

See [SECURITY.md](SECURITY.md) for the security policy, how to report a vulnerability, and known hardening considerations.

## License

CC BY-NC-ND 4.0 — NAVAL-QDA is source-available, maintainer-controlled software. Users may inspect, use, and share unmodified copies under the CC BY-NC-ND 4.0 license. Modified redistributions and commercial use are not permitted. Bug reports and pull requests are welcome, but only official releases published by the maintainer are authorized NAVAL-QDA distributions. https://creativecommons.org/licenses/by-nc-nd/4.0/ 

---



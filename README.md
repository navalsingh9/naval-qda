# NAVAL-QDA

**NAVAL-QDA** is a desktop application for qualitative data analysis (QDA) — import interview transcripts, documents, and media, code them against a hierarchical node tree, run text/coding queries, visualize patterns, and generate reports, all from a local Electron + React app.

> Status: early / pre-release (`v0.1.0`). APIs and schema may change without notice.

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

## Tech stack

| Layer      | Tech                                                   |
|------------|---------------------------------------------------------|
| Shell      | [Electron](https://www.electronjs.org/) 43              |
| Frontend   | React 19 + TypeScript, [Vite](https://vitejs.dev/), Zustand, React Router |
| Backend    | Node.js, `better-sqlite3` (falls back to Node's built-in `node:sqlite`) |
| Packaging  | `electron-builder` (Windows NSIS, macOS DMG, Linux AppImage/deb) |
| Tests      | Node's built-in `node:test` runner |

## Project structure

```
naval-qda/
├── backend/          # Data layer + business logic (runs in the Electron main process)
│   ├── db.js         # SQLite schema, migrations, connection
│   ├── sources.js     # Import & text extraction (.txt/.docx/.pdf)
│   ├── coding.js       # Node tree + coding operations
│   ├── memos.js       # Memos, cases, attributes
│   ├── query.js       # Text search, word frequency, coding queries
│   ├── visualize.js  # Word cloud / treemap / clustering data
│   ├── transcribe.js  # Media import + transcription jobs
│   ├── report.js      # Coding & project summary reports
│   ├── ai.js          # AI provider settings + summarization/suggestions
│   └── *.test.js      # Unit tests (node:test) alongside each module
├── electron/
│   ├── main.js        # App entrypoint, window creation, IPC handlers
│   └── preload.js     # contextBridge API exposed to the renderer
├── frontend/          # React + Vite renderer app
│   └── src/
│       ├── components/
│       └── stores/     # Zustand stores
├── build/             # Icons + bundled ffmpeg/whisper binaries for packaging
├── scripts/           # Icon generation helpers
└── electron-builder.yml
```

## Getting started

### Prerequisites

- Node.js **20+** (Node 22 recommended — the app can use Node's built-in `node:sqlite` if `better-sqlite3` isn't available for your platform)
- npm

### Install

```bash
git clone https://github.com/navalsingh9/naval-qda.git
cd naval-qda
npm install
npm --prefix frontend install
```

### Run in development

```bash
npm run dev
```

This starts the Vite dev server for the frontend and launches Electron pointed at it, with DevTools open.

### Available scripts

| Command                | Description                                      |
|-------------------------|---------------------------------------------------|
| `npm run dev`            | Run frontend (Vite) + Electron together in dev mode |
| `npm run build`          | Build the frontend and package the app with `electron-builder` |
| `npm run package:win/mac/linux` | Build a platform-specific installer |
| `npm run release:win/mac/linux` | Same as `package:*`, without publishing |
| `npm --prefix frontend run lint` | Lint the frontend with `oxlint` |

## Testing

Backend modules are tested with Node's built-in test runner. Run all backend tests with:

```bash
node --test backend
```

> Consider adding this as an npm `test` script (`"test": "node --test backend"`) and wiring it into CI — see [Suggested improvements](#suggested-improvements) below.

## AI features (optional)

AI-assisted summarization and code suggestion are opt-in. Set a provider and API key via environment variable before launching:

```bash
export GEMINI_API_KEY="your-key-here"
```

Without a key set, the app falls back to local placeholder summaries/suggestions so the rest of the app remains fully usable offline.

## Data storage

Project data lives in a local SQLite database under Electron's `userData` directory (varies by OS). No project data is sent anywhere unless you explicitly enable an AI provider and it summarizes/suggests based on your source content — see [SECURITY.md](SECURITY.md) for details.

## Contributing

Issues and pull requests are welcome. Please run the backend test suite (`node --test backend`) and frontend lint (`npm --prefix frontend run lint`) before submitting a PR.

## Security

See [SECURITY.md](SECURITY.md) for the security policy, how to report a vulnerability, and known hardening considerations.

## License

CC BY-NC-ND 4.0 — NAVAL-QDA is source-available, maintainer-controlled software. Users may inspect, use, and share unmodified copies under the CC BY-NC-ND 4.0 license. Modified redistributions and commercial use are not permitted. Bug reports and pull requests are welcome, but only official releases published by the maintainer are authorized NAVAL-SEM distributions. https://creativecommons.org/licenses/by-nc-nd/4.0/ 

---

## Suggested improvements

*(You can delete this section once you've triaged it — it's a working checklist, not part of the public docs.)*

- [ ] Add an npm `test` script and a CI workflow that runs it on every push/PR (none exists today — only the release workflow runs on tags).
- [ ] Add a `LICENSE` file.
- [ ] Route file selection through Electron's native `dialog.showOpenDialog` in the main process rather than accepting a raw `filePath` string over IPC from the renderer, to avoid an arbitrary-file-read surface if the renderer is ever compromised.
- [ ] Add `.env.example` documenting `GEMINI_API_KEY` (and any others) since `.env` is git-ignored but undocumented.
- [ ] Pin GitHub Actions to commit SHAs (or Dependabot-managed versions) rather than floating major-version tags.

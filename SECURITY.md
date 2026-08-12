# Security Policy

NAVAL-QDA is an Electron desktop application that runs entirely on the user's machine and stores project data (interview transcripts, codings, memos) in a local SQLite database. Because source material may include sensitive or identifiable research data, we take security reports seriously.

## Supported versions

Pre-1.0: only the current `main` branch and its latest tagged release receive fixes — there's no long-term support for older tags. Check the [Releases page](https://github.com/navalsingh9/naval-qda/releases) for the current version.

This project has not yet reached a `1.0` release.

## Reporting a vulnerability

Please **do not open a public GitHub issue** for security vulnerabilities.

Instead, report privately via one of:
- GitHub's [private vulnerability reporting](https://github.com/navalsingh9/naval-qda/security/advisories/new) (Security tab → "Report a vulnerability"), or
- Email the maintainer directly (add a contact address here — e.g. `security@navalqda.example`).

Please include:
- A description of the issue and its impact
- Steps to reproduce (a minimal repro is very helpful)
- The version/commit you tested against and your OS

We aim to acknowledge reports within a few days. Since this is a small pre-1.0 project maintained outside of working hours, please allow reasonable time for a fix before any public disclosure.

## Scope and threat model

NAVAL-QDA runs locally as a trusted, single-user desktop app. The main threats worth considering are:

1. **A malicious or booby-trapped source file** (imported document/media) attempting to escape the renderer or execute code.
2. **A compromised or malicious renderer** (e.g. via a supply-chain-compromised frontend dependency) trying to reach the filesystem or OS beyond what the app needs.
3. **Data at rest** — the SQLite database and imported files are unencrypted on disk, readable by anything with access to the user's account.
4. **Optional AI features** sending source content to a third-party API.

It does **not** currently defend against a fully compromised host OS, physical access to an unlocked machine, or a malicious user of their own installation.

## Current hardening

- Electron windows are created with `contextIsolation: true` and `nodeIntegration: false`, and the renderer only reaches the main process through a narrow `contextBridge` API defined in `electron/preload.js` — the renderer never gets direct `require`/Node access.
- All SQL queries use parameterized statements (`db.prepare(...).run/get/all(...)`) rather than string interpolation, so the app is not exposed to classic SQL injection from user-entered content (project names, codes, memo text, etc.).
- The optional AI provider is off by default; an API key must be explicitly set via the `GEMINI_API_KEY` environment variable, and no request is made unless a provider is configured.
- `.env` and `.env.*` files are git-ignored, so local secrets shouldn't be committed accidentally.

## Known gaps / recommended improvements

These are not currently exploited by anything in the app itself, but are worth addressing before a wider release:

1. **Renderer-supplied file paths.** `sources:import`, `sources:importMedia`, and `transcribe:importMedia` IPC handlers (`electron/main.js`) accept a `filePath` string from the renderer and pass it straight to `fs.readFileSync` / import logic in `backend/sources.js`. If the renderer is ever compromised (e.g. a supply-chain attack on a frontend dependency), this is a path for arbitrary local file read.
   - **Recommendation:** trigger file selection with `dialog.showOpenDialog` in the main process (in response to a simple `sources:pickFile` IPC call with no arguments) and only ever read paths the main process itself selected, rather than trusting a path handed to it by the renderer.
2. **No sandboxing / CSP.** There's no explicit `sandbox: true` on the `BrowserWindow`, and no Content-Security-Policy is set for the renderer. Consider adding `sandbox: true` in `webPreferences` and a strict CSP meta tag/header in `frontend/index.html` to limit what a compromised renderer can load or execute.
3. **Unencrypted local data.** Source content and codings are stored in plaintext SQLite. If this tool is used for sensitive research (interviews with identifiable subjects, etc.), consider documenting this clearly for users and/or offering optional at-rest encryption (e.g. SQLCipher) as a future feature.
4. **`node:sqlite` fallback.** `backend/db.js` falls back to Node's experimental built-in `node:sqlite` module if `better-sqlite3` fails to load. That's a reasonable resilience choice, but since it's an experimental Node API, pin/verify the Node version used in packaged builds and add a test that exercises both code paths so a Node upgrade doesn't silently change behavior.
5. **Electron/dependency updates.** Electron ships its own Chromium; outdated Electron versions can carry known browser CVEs. Add Dependabot (or Renovate) for `package.json`/`frontend/package.json` and enable GitHub's Dependabot alerts so Electron, `better-sqlite3`, `pdf-parse`, and other native/parsing dependencies get flagged when a fix is available.
6. **No automated security/dependency scanning in CI.** The only workflow (`.github/workflows/release.yml`) builds and publishes installers on tag push; nothing runs `npm audit`, CodeQL, or a test suite on regular pushes/PRs. See the suggested `test.yml` workflow for a starting point that covers this.
7. **Bundled native binaries (ffmpeg/whisper).** `build/ffmpeg` and `build/whisper` are placeholders populated at build/release time and shipped inside the installer via `extraResources`. Document exactly where these binaries come from (official release URLs + checksums) so a future contributor doesn't silently swap in an untrusted binary, and verify checksums as part of the release process.

## Reporting non-security bugs

For regular (non-security) bugs, please use the normal [GitHub Issues](https://github.com/navalsingh9/naval-qda/issues) tracker instead.

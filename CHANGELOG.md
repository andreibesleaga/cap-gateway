# Changelog

## Unreleased - exemplar pass, second part (2026-10-21)

### Changed
- Translation output follows CAP 1.2 practice: the alert is returned unchanged and an English copy of each
  source-language `<info>` block is appended with `<language>en-US</language>`; only free-text fields are
  translated, everything else is copied verbatim ([ADR 0001](docs/adr/0001-append-english-info-block.md)).
  Previously the text was replaced in place and `<language>` kept the source code.
- No English block is added when one exists; a missing `<language>` counts as `en-US`.
- `TRANSLATOR_ENGINE` selects the engine at start-up: `libretranslate` (default), `llm`, `deepl`, `microsoft`,
  `yandex`, `mymemory`, `stub`. One request per `<info>` block instead of one per field.
- Engine failure returns the original alert with `200` and `X-Translation: failed`, never a partly translated
  block ([ADR 0003](docs/adr/0003-failure-behaviour.md)).
- No responder: `503` at once instead of `500` after the timeout; responder timeout: `504`. Body over `BODY_LIMIT`
  (default 100 kB): `413`. Body errors are JSON.
- `SERVICE_TIMEOUT` default 3000 ms -> 20000 ms; new `TRANSLATOR_TIMEOUT` (8000 ms). Invalid configuration stops
  the process at start-up. Node 22 required (`engines`).
- Gateway split into `app.js` (testable without network) and `mesh.js`; responder configuration in `config.js`.
- Alternative engine clients updated to the current DeepL, Microsoft Translator v3, Yandex Cloud v2 and MyMemory APIs.

### Added
- `llm` engine: OpenAI-compatible Chat Completions (OpenRouter by default, `google/gemini-3.5-flash-lite`),
  temperature 0, strict JSON contract, one retry ([ADR 0002](docs/adr/0002-translation-engines-and-llm-contract.md)).
- `X-Translation` response header (`translated`, `passthrough`, `failed`) and `GET /health`.
- DOCTYPE declarations refused before parsing; schema errors returned in `details` (at most 5).
- Tests: unit (`node:test`, 72 tests, 90 % line gate), BDD with personas (`@cucumber/cucumber`, 29 scenarios on real
  processes with the stub engine), e2e against LibreTranslate in Docker and an opt-in LLM tier; GitHub Actions CI.
- Samples in French, Spanish, German and Finnish; test fixtures; `docs/` (architecture, testing, operations, three ADRs).

### Removed
- `scripts/smoke.mjs` (replaced by the test tiers above), `gateway/errors.js`, `responder-microservices/constants.js`.
- Dependencies `axios` (responder; built-in `fetch` with `AbortSignal.timeout` instead) and `validator` (gateway).

## Unreleased - exemplar pass, first part (2026-10-21, commit 5c733bd)

Final clean-up before archiving. No new features; the behaviour described in the README is what the code does.

### Fixed
- The responder microservice could not start: `services/cap.js` imported a named export
  `translateWithLibre` that `services/translator.js` did not provide (it only had a default object).
- The gateway read `cap.xsd` relative to the current directory, so with `npm start` inside `gateway/`
  the schema file was missing, the error was swallowed and every message passed unvalidated.
  The XSD is now resolved relative to the module and parsed once at start-up.
- Malformed XML (parse error) now returns `400` instead of falling through to the mesh.
- A new `cote.Requester` (with its own discovery sockets) was created on every HTTP request; there is now one per route.
- Unknown routes returned a redirect to `http://localhost` (port 80); they now return `404 {"error":"Not found"}`.
- XML round trip is lossless: tag and attribute values are no longer coerced to numbers
  (`version="1.0"` came back as `version="1"`, numeric-looking identifiers changed type).
- A CAP alert without `<language>` is treated as `en-US` (CAP 1.2 default) instead of asking the translator to auto-detect.
- Language codes such as `ro-RO` are reduced to their primary tag (`ro`) before being sent to the translation engines.
- The demo pub/sub endpoint created a new publisher and timer on every call; now one publisher, started once.
- HTTPS key/cert are read from `cap-gateway/` regardless of the working directory.

### Changed
- Configuration is read from environment variables with the previous constants as defaults
  (`NODE_ENV`, `APP_PORT`, `APP_URL`, `ACCESS_LOGS_DIR`, `SERVICE_TIMEOUT`, `TRANSLATOR_URL`, `TRANSLATOR_KEY`).
- `libxmljs` 1.0.11 (three unpatched advisories) replaced by the drop-in fork `libxmljs2`.
- One lint/format toolchain at `cap-gateway/` (ESLint 10 flat config, Prettier 3) instead of per-package copies; code formatted with it.
- Licence changed from "All rights reserved" to MIT (see `LICENSE`).
- `README.md` rewritten from the code; package-level READMEs merged into it.

### Added
- `npm test` smoke test (`cap-gateway/scripts/smoke.mjs`): service in-process with a stub engine, then the full
  gateway + responder path over HTTP with a local stub translation server. No network, no real translation API.
- Sample alerts `cap-gateway/samples/alert-en.xml` and `alert-ro.xml` (valid CAP 1.2).
- `.editorconfig`, `.nvmrc` (22), `engines.node >= 20`, `LICENSE`, `SECURITY.md`, `CHANGELOG.md`, `llms.txt`.

### Removed
- Unused dependencies: `body-parser`, `cookie-parser`, `cors`, `dotenv`, `@types/express-slow-down` (never imported),
  `nodemon` and `pm2` (process tools, not code dependencies; PM2 is used globally).
- Dead code: `translateWithGoogle` (used `require` inside an ES module and an SDK that was not a dependency).
- Per-package `.eslintrc.json`, `.prettierrc`, `.gitignore`, `README.md` (superseded by the root files).

### Security
- See `SECURITY.md` for the dependency state and the one residual advisory (`uuid` 3.4.0 via `cote`).

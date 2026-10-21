# Testing

All commands run from `cap-gateway/` after `npm ci` in `cap-gateway/`, `gateway/` and `responder-microservices/`.
Use Node 22 (`.nvmrc`): `libxmljs2` is a native module, and under another major version it fails to load and some
unit tests fail for that reason alone.
Every tier except the LLM one is deterministic: fixed fixtures, a stub or fake engine, no wall clock in assertions
beyond generous upper bounds, and each mesh isolated by its own `COTE_ENV` so it never meets another cote mesh.

| Tier | Command | What it covers | In CI |
| --- | --- | --- | --- |
| Lint, format | `npm run lint`, `npm run format:check` | ESLint 10 flat config, Prettier 3 | yes |
| Unit | `npm run test:unit` | `node:test`; `test/unit/*.test.js`: config, CAP text helpers, service, every engine with a fake `fetch`, gateway app with fake requesters, middlewares | yes |
| Coverage | `npm run test:coverage` | unit tests with a 90 % line gate on `responder-microservices/services/` and `gateway/middlewares/` | yes |
| BDD, stub e2e | `npm run test:bdd` (default profile) | `@cucumber/cucumber`; starts real gateway and two responder processes with `TRANSLATOR_ENGINE=stub` and talks HTTP | yes |
| e2e LibreTranslate | `npm run test:e2e:libre` | starts `libretranslate/libretranslate:v1.9.6 --load-only en,ro,fr,es,de,fi --update-models` in Docker on port 5055 (`LIBRE_PORT`), runs the `@translation` scenarios (profile `libre`), stops the container | manual run (`workflow_dispatch`) |
| e2e LLM | `OPENROUTER_API_KEY=... npm run test:e2e:llm` | `@llm` scenarios (profile `llm`), 7 chat completions when nothing is retried; skips with exit 0 without a key; optional `LLM_MODEL` | never |

`npm test` runs unit and BDD. The models downloaded by LibreTranslate are cached in the Docker volume
`cap-gateway-libre-models`; `--update-models` installs a language newly added to the list (it needs network at
start-up).

## Scenarios (by persona)

| Feature | Scenarios |
| --- | --- |
| `01` alerting authority | English passthrough byte-identical; RO, DE, FR, ES, FI each get one appended en-US block (originals intact, codes verbatim, free text translated, output valid CAP); real engine output reads as English and names the hazard; missing `<language>` = en-US; existing English block = no duplicate; two Romanian blocks = two copies; RO + FR blocks = only the RO copy; diacritics, entities, comments and CDATA survive; enumerated, coded, dated and geometric fields copied verbatim |
| `02` downstream JSON consumer | Romanian alert as JSON with the original and the English entry; English alert as JSON; only the boolean `true` selects JSON |
| `03` operator | two responders share 6 requests 3/3; `/health` counts responders; no responder = 503 within 2 s and health 503; unreachable engine = 200 `failed`, original returned; silent engine cut off by `TRANSLATOR_TIMEOUT`; LLM breaking the JSON contract retried once, then `failed` |
| `04` security reviewer | malformed XML, non-CAP XML, value outside an enumeration, DOCTYPE with an external entity, 200 kB body (413), body not JSON, message not a string, path traversal route (404); none reaches a responder |

The assertions use an independent oracle: libxml2 XPath over the response and the gateway's own XSD validator,
not the code under test.

## Recorded results, 2026-10-21

Final run 15:03 to 15:06 EEST on the tree handed over for commit (LLM tier: run once earlier the same day).
Node 22.22.3, npm 10.9.8, WSL2 Linux 6.6, Docker 29.8.1, fresh `npm ci` in all three packages.

| Tier | Result |
| --- | --- |
| Lint | 0 problems |
| Format | all matched files use Prettier code style |
| Unit | 72 tests (3 suites), 72 passed, 0 failed; identical on 3 repeated runs |
| Coverage, gated paths | 100 % lines, 98.95 % branches, 100 % functions (`services/cap.js`, `capXml.js`, `translator.js`, `sanitize.js`, `schemaValidator.js`) |
| Coverage, all source | 99.70 % lines, 95.71 % branches (uncovered: parsing of a set numeric variable in `gateway/constants.js`, lines 4 and 6) |
| BDD, stub e2e | 29 scenarios, 205 steps passed, 12.0 to 12.4 s; identical on 2 repeated runs |
| e2e LibreTranslate | 18 scenarios, 142 steps passed, languages en, ro, fr, es, de, fi, with `--update-models`; container ready in 11.1 s (models cached), scenarios 30.1 s; container stopped afterwards. The first start after Finnish was added took 193.4 s to download its models |
| e2e LLM (run once, before Finnish was added; Finnish is not in the `@llm` set, which is unchanged) | 9 scenarios, 69 steps passed, 10.9 s; model `google/gemini-3.5-flash-lite`, 7 requests, 0 retries, cost reported by OpenRouter USD 0.001545 |
| `npm audit` (each package) | 3 moderate, 0 high, 0 critical: the single `uuid` advisory through `cote` (see `SECURITY.md`) |

The DeepL, Microsoft, Yandex and MyMemory engines are contract-tested with a mocked `fetch`, not live-verified.
The GitHub Actions workflow (`.github/workflows/ci.yml`) had not run yet when these results were recorded.

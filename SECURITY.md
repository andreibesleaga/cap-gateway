# Security

This repository is an archived proof of concept (2024). It is not maintained and must not be exposed to untrusted
networks as it is: there is no authentication, no rate limiting, and the mesh (cote) discovers peers by UDP
broadcast without any key, so any process on the network can join it as a responder.

## Reporting

Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability").
There is no response-time commitment.

## Input handling

- The gateway accepts only a JSON body up to `BODY_LIMIT` (100 kB) and only CAP 1.2 XML valid against `cap.xsd`.
- A DOCTYPE is refused before the XML is parsed, which rules out entity expansion and external entities (XXE).
- Translated text is escaped before it is written into the XML; characters XML 1.0 forbids are dropped.
- LLM prompt injection: the system prompt tells the model that field texts are data, and the reply must match a
  strict JSON contract with exactly the input keys. A manipulated but contract-valid translation cannot be detected;
  the original block, which is never modified, stays authoritative.

## API keys

- `TRANSLATOR_KEY` and `OPENROUTER_API_KEY` are read from the environment of the responder only. They are sent only
  to the configured engine endpoint, as the header or parameter that engine requires, and are never logged: the
  start-up line shows engine, endpoint origin, model and timeout only (unit-tested).
- Keep keys out of the repository (`.env` is git-ignored). For the LLM test tier, load the key into that one
  command's environment, for example `( set -a; . ./path/to/.env; set +a; npm run test:e2e:llm )`.
- The test harness strips `TRANSLATOR_*`, `LLM_*` and `OPENROUTER_*` from the developer's shell before it starts
  processes, so a key reaches a test process only when a scenario passes it on purpose.

## Data sent to third parties

The free-text fields of every non-English alert (`event`, `audience`, `senderName`, `headline`, `description`,
`instruction`, `contact`, `resourceDesc`, `areaDesc`) and the source language code are sent to the configured engine.

| Engine | Where the text goes |
| --- | --- |
| `libretranslate` | the `TRANSLATOR_URL` host; default `libretranslate.com` (needs a key), or your own instance, which keeps the text on your network |
| `llm` | OpenRouter (default) and the model provider it routes to, or the `LLM_BASE_URL` host; OpenRouter also receives the model id |
| `deepl`, `microsoft`, `yandex`, `mymemory` | that provider's API |
| `stub` | nowhere |

Public alerts are usually meant to be public, but drafts, exercises and `Restricted`/`Private` alerts are sent too.
Choose a self-hosted engine when that is not acceptable.

## Dependency state at 2026-10-21

`npm audit` after a clean `npm ci` of the three packages (`cap-gateway/`, `cap-gateway/gateway/`,
`cap-gateway/responder-microservices/`) on Node 22.22.3 / npm 10.9.8: 3 moderate, 0 high, 0 critical in each, all
the single `uuid` advisory below.

| Package (where) | Was | Now | How |
| --- | --- | --- | --- |
| `tar` (gateway, transitive, install-time only) | 6.2.1, 1 critical + 4 high + 3 moderate | 7.5.22 | `overrides` in `gateway/package.json` |
| `braces` (via `chokidar` from `nodemon`/`pm2`) | 3.0.3, 1 high | removed | `nodemon` and `pm2` are no longer dependencies |
| `libxmljs` (gateway, parses untrusted XML) | 1.0.11, 2 critical + 1 high | `libxmljs2` 0.37.0 | drop-in fork with the fixes |
| `uuid` (all three, via `cote` and `@dashersw/node-discover`) | 3.4.0, moderate (GHSA-w5hq-g745-h8pq) | 3.4.0, **residual** | `cote` 1.2.0 (latest) needs `uuid/v4`, which no patched uuid provides; the affected functions (v3/v5/v6 with a caller-supplied buffer) are never called here |

Replacing `cote` would remove the last finding; that is outside the scope of an archived exemplar.

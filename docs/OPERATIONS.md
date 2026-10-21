# Operations

This is an archived proof of concept; these notes describe how it runs, not a supported deployment.

## Processes

- One gateway (`cd cap-gateway/gateway && npm start`) and one or more responders
  (`cd cap-gateway/responder-microservices && npm start`) on hosts that can reach each other by UDP broadcast.
- With a global PM2: `cd cap-gateway && npm start` starts `all.json` (one gateway, two responders, logs in
  `cap-gateway/LOGS/`); `pm2 kill` stops them. `npm run monitor` opens the cote mesh monitor on port 5555.
- Separate meshes on one network: give each its own `COTE_ENV` (cote's environment name); the tests do this.

## Health and logs

- `GET /health` answers `200 {"status":"ok","responders":n}` with at least one responder connected, otherwise `503`.
  It counts the TCP connections of the gateway's requester (cote has no public API for this).
- Each responder logs one line per alert: `translate: passthrough|translated|failed (...)`, with the source
  language, block count, engine and failure reason. The LLM engine also logs the model, token counts and the cost
  OpenRouter reports for each call. Keys are never logged.
- The gateway writes an Apache-style access log to `ACCESS_LOGS_DIR/access.log` (rotating) and logs every rejected
  message with the schema errors.

## Timeouts

`TRANSLATOR_TIMEOUT` (default 8 s) bounds each engine request. The LLM engine retries once, so its worst case is
about twice that; `SERVICE_TIMEOUT` (default 20 s) must stay above it, or the gateway answers `504` while the
responder is still working. For a slow self-hosted LibreTranslate on CPU, raise both (the e2e tier uses 60 s / 70 s).

## Choosing an engine

| Need | Engine |
| --- | --- |
| Text stays on your network | `libretranslate`, self-hosted (`TRANSLATOR_URL`) |
| Best fluency, any language | `llm` (OpenRouter or another OpenAI-compatible API); alert text goes to the provider |
| A commercial API you already use | `deepl`, `microsoft`, `yandex` (contract-tested, not live-verified) |
| No engine (tests, demos) | `stub` |

## Failure behaviour

An engine failure never blocks the alert: the client gets `200` with the original alert and `X-Translation: failed`
([adr/0003-failure-behaviour.md](adr/0003-failure-behaviour.md)). Watch for `failed` in the responder logs or in the
header to notice a broken engine.

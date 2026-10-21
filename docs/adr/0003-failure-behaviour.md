# 3. Failure behaviour

- Status: accepted
- Date: 2026-10-21

## Context and problem

The 2024 code kept the original text of any field whose translation failed, mixing languages inside one block,
and answered 500 when the responder was missing, after waiting for the timeout.

## Decision

- Invalid input is rejected by the gateway before the mesh: 400 (not a string, DOCTYPE, not well-formed, not
  CAP 1.2, body not JSON) or 413 (body over `BODY_LIMIT`).
- No responder connected: 503 at once. No reply within `SERVICE_TIMEOUT`: 504.
- Engine failure (network, timeout, HTTP error, invalid answer, after the LLM retry): the alert is returned as
  received with **200** and `X-Translation: failed`; nothing partial is appended.
- Success: 200 with `X-Translation: translated` or `passthrough`.
- Unexpected errors: 500 with a generic message; details only in the logs.

## Consequences

- Good: a translation problem never stops a valid alert from being delivered; the client can tell from the header.
- Good: an English block, when present, is always complete.
- Bad: clients that ignore the header cannot tell `failed` from `passthrough` by status code alone.

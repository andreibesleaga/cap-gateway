# 1. Append an English `<info>` block instead of replacing the text

- Status: accepted
- Date: 2026-10-21

## Context and problem

The 2024 code replaced the `<info>` text in place and left `<language>` with the source code, so the output claimed
to be Romanian while carrying English, and the authority's original wording was lost. CAP 1.2 (section 3.2.2)
allows several `<info>` blocks in one alert, each with its own `<language>`, which is how an alert carries more than
one language.

## Decision

Keep the alert as received and append, after the last `<info>`, a copy of each block in the source language with
`<language>en-US</language>` and only the free-text fields translated: `event`, `audience`, `senderName`,
`headline`, `description`, `instruction`, `contact`, `resourceDesc`, `areaDesc`. Enumerations, codes, dates, URIs,
`valueName`/`value` pairs and geometry are copied verbatim. The source language is that of the first `<info>`;
only blocks in that language are copied, so an alert in Romanian and French gets one English sequence, not two.
Nothing is appended when any block is already English or has no `<language>` (CAP default `en-US`). The document
is edited as text at known offsets and never re-serialised.

## Consequences

- Good: originals stay authoritative and byte-identical; the output is valid CAP 1.2; consumers that select by
  `<language>` find English without any new field.
- Good: an English alert passes through unchanged.
- Bad: the alert grows by one block per source block; other languages after the first are not translated.
- The text-level editing relies on the gateway's XSD validation having run first.

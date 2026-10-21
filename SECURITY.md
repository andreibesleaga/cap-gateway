# Security

This repository is an archived proof of concept (2024). It is not maintained and must not be
exposed to untrusted networks as it is: there is no authentication, no rate limiting and the
mesh (cote) discovers peers by UDP broadcast without any key.

## Reporting

Use GitHub's private vulnerability reporting on this repository
(Security tab, "Report a vulnerability"). There is no response-time commitment.

## Dependency state at 2026-10-21 (exemplar pass)

Checked with `npm audit` after a clean `npm ci` of the three packages
(`cap-gateway/`, `cap-gateway/gateway/`, `cap-gateway/responder-microservices/`) on Node 22.22.3 / npm 11.16.0.

| Package (where) | Was | Now | How |
| --- | --- | --- | --- |
| `tar` (gateway, transitive, install-time only) | 6.2.1, 1 critical + 4 high + 3 moderate advisories | 7.5.22 | `overrides` in `gateway/package.json` |
| `braces` (all three, via `chokidar` from `nodemon`/`pm2`) | 3.0.3, 1 high, no patched release | removed | `nodemon` and `pm2` are no longer dependencies (PM2 is installed globally if wanted) |
| `libxmljs` (gateway, direct, parses untrusted XML) | 1.0.11, 2 critical + 1 high, no patched release | `libxmljs2` 0.37.0 | drop-in fork with the same API and the fixes |
| `uuid` (all three, via `cote` and `@dashersw/node-discover`) | 3.4.0, moderate (GHSA-w5hq-g745-h8pq) | 3.4.0, **residual** | the latest `cote` 1.2.0 and `node-discover` 1.0.6 `require('uuid/v4')`, which no patched uuid provides; the vulnerable functions (v3/v5/v6 with a caller-supplied buffer) are never called here |

`npm audit` after the pass: 3 moderate findings per package, all the single `uuid` advisory above.
Replacing `cote` would remove it, which is outside the scope of an archived exemplar.

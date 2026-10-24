# Role-pack examples

All records are fictional. Do not replace them with real private data.

## Valid bundle

- [fictional-trail-notes.json](fictional-trail-notes.json) — the shared bundle for all six packs.

## Refusal fixtures

- [unsafe-self-approval.json](unsafe-self-approval.json) — An agent requests and approves the same change; the runner must refuse.
- [unsafe-secret.json](unsafe-secret.json) — A bearer token appears in evidence; the runner must refuse and ask for rotation.
- [wrong-target-production.json](wrong-target-production.json) — Programmer work is pointed at production; the runner must refuse.

Run each with `node scripts/roles.mjs brief --role programmer --input <file>`.
The expected result is exit 2 and a named human action, never a brief.

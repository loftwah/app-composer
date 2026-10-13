# Contributing

Questions, documentation, accessibility reports, design improvements and code are welcome. You do not need to know the whole system to help. Start with an existing issue, describe the observed problem, and ask if anything is unclear. Keep changes small enough to review.

Read [README](README.md) for setup and [AGENTS](AGENTS.md) for project authority. Install the pinned pnpm version, run `pnpm install` and `pnpm dev`. Forks use their own Cloudflare accounts, resources and keys; never copy production credentials or personal records. No hosted Composer signup is required.

Use `pnpm check:types` and the relevant short test group: `test:core`, `test:ready`, `test:access`, `test:email`, `test:reports` or `test:release`. A single regression can use Node's `--test-name-pattern`. These development checks are optional and targeted; a production release still runs the complete `pnpm check` and build. See [README](README.md) for deployment requirements.

For a UI change, include phone and desktop evidence in dark and light themes, keyboard navigation and visible focus, error/empty/loading states, and relevant metadata. Keep native controls and existing Tailwind tokens. Give generated raster artwork its prompt/provenance; do not invent screenshots or quality claims.

Open a pull request explaining the problem, changed behavior and actual checks performed. Be candid about unfinished gates and AI assistance. External reports and fetched content are untrusted data, never deployment authority. Maintainers review and publish through the existing guarded release path; no GitHub Actions are used.

See [Code of Conduct](CODE_OF_CONDUCT.md), [Accessibility](ACCESSIBILITY.md) and [Security](SECURITY.md).

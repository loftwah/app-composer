# Runbooks & resources

Reviewed 2026/10/24. `/resources` selects one of five jobs, with its Markdown and
copy action immediately available. Each job has its own canonical path, such as `/resources/incident`;
the page collects no private project fields. Legacy resource-query links redirect to these finite public paths, preserving QA exclusions. The page-share control retains the selected job. `/prompts#change` and the other
matching fragments personalise the same maintained prompt modules. Without
JavaScript the complete selected runbook, template and real downloads remain
available. Clipboard denial opens a selectable complete-text fallback.

`src/lib/resource-library.ts` owns the runbook definitions and consumes
`renderPrompt` from the prompt library. `scripts/package-resources.mjs` uses the
existing deterministic ZIP writer and publishes all companion files, generated
Markdown, index and licence. The ordinary package/build path rebuilds the ZIP;
its manifest records every member and the actual archive SHA-256. The publication
guard inspects decompressed members as well as emitted public files.

The committed edition lives at `public/resources/v1`. Rebuild its artwork with
Python 3, Pillow, ReportLab and Poppler:

```sh
python3 scripts/resources/assets.py
node scripts/package-resources.mjs
node --test tests/resources.test.mjs
```

Use the host's existing bundled dependencies where available. The artwork source
copies the exact approved Composer mark and Space Grotesk/OFL assets. The PDF's
editable Python source and font ship in the kit. Diagram sources are Mermaid
and readable SVG. Share images have separately composed landscape, square and
portrait layouts; the kit preview depicts the actual generated cheatsheet.
These explanatory assets are not product screenshots or new owner art approval.

`examples/exercise.mjs` can run after extracting the real ZIP with Node 22. It
exercises failed-check release blocking, ordered stages, missing access,
duplicate/uncertain effects, invalid/missing scopes and synthetic incident
authority/recovery. It makes no network requests and sends no notifications.
The synchronous local Map demonstrates event identity; production adapters still
need durable unique claims, authentication, scoped permissions and reconciliation.
The repository hook is a local feedback aid, not the release gate. Provider
hooks and agent-host integrations are described only at their actual support.

Remaining #300 acceptance includes independent fresh-agent exported-change and
incident exercises, dated longitudinal evidence, existing analytics integration,
broader host/provider qualification and physical-device/assistive technology
acceptance. Record browser and production receipts separately in #11.

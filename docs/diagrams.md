# Diagram atlas

Reviewed 25 October 2026. The public atlas is `/diagrams`. These diagrams are
native LDraw scenes rendered through LDraw's existing Excalidraw renderer; the
site does not embed a second editor, renderer, diagram database or live MCP
service.

## Source and outputs

| Scene | Purpose | Committed files |
| --- | --- | --- |
| `get-ready-lifecycle` | Get Ready → Init → EmDash → application lifecycle | `.excalidraw`, `.svg`, `.png` |
| `agent-approval-boundary` | Local agent → scoped proposal → human review → separate execution | `.excalidraw`, `.svg`, `.png` |
| `cloudflare-isolation` | Production/Preview Workers, separate resources and fail-closed bindings | `.excalidraw`, `.svg`, `.png` |

Each scene is a native Excalidraw version 2 file. Elements keep stable IDs,
real text, arrows and editable geometry. The SVG and PNG are generated from the
same scene; the page links to all three.

## How they were rendered

Rendered on 25 October 2026 with LDraw `fa7a2ab`, using
`@excalidraw/excalidraw@0.18.1` and LDraw's owned Playwright Chromium:

```sh
cd ../app-composer-ldraw  # an independent checkout with built assets
node scripts/render.mjs /path/to/<name>.excalidraw /path/to/output
```

The renderer writes a renderer-restored `.excalidraw`, SVG and PNG. The scene,
SVG and PNG are replaced together; do not edit only the SVG or PNG.

## Placement

- `/diagrams` is the browsable atlas with alt text, captions, downloads and a
  text equivalent.
- `/ready` embeds the lifecycle diagram.
- `/architecture` embeds the isolation diagram under **Inside Cloudflare** and
  the approval diagram under **Ownership**.
- `/agent` links to the atlas through the shared task navigation.

## Review boundary

The diagrams use a light paper surface on both themes, framed as a working
diagram rather than a screenshot. Both themes and 390px/desktop layouts were
inspected with no horizontal overflow. The text equivalent carries the factual
sequence when the SVG text is too small to read on a phone.

Automated tests check file identity, native scene shape, unique IDs, real SVG
text and the absence of remote image dependencies. They do not certify that a
diagram is clear or technically true. A human review remains part of changing
one.

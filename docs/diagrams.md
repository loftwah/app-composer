# Diagram atlas

The public atlas is [Diagrams](https://composer.loftwah.com/diagrams). It
includes 79 editable scenes and five AI-generated illustrations linked to
their source diagrams. The diagrams are native LDraw scenes rendered through
LDraw’s Excalidraw renderer.

| Collection | Source |
| --- | --- |
| App Composer and project architecture (31) | The published [17 November engineering pack](../public/diagrams/engineering/app-composer-diagrams-20261117.zip). Individual scene, SVG and PNG downloads match the archive. |
| Loftwah Factory Atlas (32) | The 14 November factory atlas export. The gallery preserves the editable scenes, SVGs and 1920×1080 PNGs. Original project artwork was sourced from the public portfolio. Includes [Tabler Icons under MIT](../public/diagrams/factory-20261114/Tabler-MIT.txt). |
| Workshop boards (12) | The 17 November App Composer campaign source kit. The boards include released workflows, storyboards and integration concepts, with their original labels. |
| Artwork (5) | Three published engineering illustrations and two studio campaign illustrations generated with Codex ImageGen from LDraw references. The artwork links back to the editable boards. |
| Reference (4) | The published diagrams below, including their written walkthroughs. |

Gallery WebP previews are downscaled from the corresponding PNGs. The full PNG,
SVG and Excalidraw links remain available on each editable drawing.

## Source and outputs

| Scene | Purpose | Committed files |
| --- | --- | --- |
| `get-ready-lifecycle` | Get Ready → Init → EmDash → application lifecycle | `.excalidraw`, `.svg`, `.png` |
| `agent-approval-boundary` | Local agent → owner review → finite local repair → independent HTTP verification | `.excalidraw`, `.svg`, `.png` |
| `contribution-boundary` | Scoped member contribution → private API → app-owned data → separate public snapshot | `.excalidraw`, `.svg`, `.png` |
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

The approval and contribution views were subsequently edited through the real
local MCP, reviewed and curated, then published under immutable
`*-20261025-model` filenames. Their exact native IDs, output hashes, model/source
versions and browser receipt are in
[the model workflow evidence](evidence/ldraw-model-20261025/README.md). Earlier
immutable URLs remain available.

The later `agent-approval-recovery-20261025` scene uses the same real stdio MCP
and native renderer at LDraw `9fec6e7`, whose complete source tree matches merged
main `9247b73`. It revises the existing IDs, refuses a stale write and depicts the
qualified local caption action. Its retained editable scene, SVG/PNG, dimensions,
source/renderer hashes and cleanup are in the [completion receipt](evidence/product-completion-20261025/ldraw-receipt.json).
One label initially exceeded its box; the second native revision shortened it
before publication. Production action authority remains separately gated.

The renderer writes a renderer-restored `.excalidraw`, SVG and PNG. The scene,
SVG and PNG are replaced together; do not edit only the SVG or PNG.

## Placement

- `/diagrams` is the browsable atlas with alt text, captions, downloads and a
  text equivalent.
- `/ready` embeds the lifecycle diagram.
- `/architecture` embeds the isolation diagram under **Inside Cloudflare** and
  the approval diagram under **Ownership**.
- `/building#composition` links to the contribution boundary figure.
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

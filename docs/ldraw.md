# LDraw

[Open the independent drawing workspace](https://ldraw.loftwah.com/).
LDraw uses the maintained Excalidraw editor for drawing, text, arrows, images,
selection, pan/zoom and undo. Its editable examples append below existing
content. Choosing a project colour changes new content and preserves existing
elements.

Drawings stay in this origin's IndexedDB. Automatic saves use a revision check
and retain one previous snapshot for damaged-save recovery. A stale tab cannot
silently replace a newer saved drawing. Storage failure leaves the current
canvas available and asks the visitor to download a copy. Browser storage can
be cleared or evicted; keep editable `.excalidraw` downloads.

Open a native file to replace the canvas deliberately. The native file keeps
element identities, text and embedded images. PNG and SVG previews/downloads
use the editor's own renderer. The PNG scale and background controls describe
the actual export. Files with malformed elements, duplicate identities,
missing images or remote embeds are rejected before replacement.

The core editor and fonts are self-hosted. After the required assets have
loaded, the current drawing can reopen and export offline. Additional fonts
and optional helpers may need a connection on first use. The cached-workspace
message does not promise every possible font or future drawing is available.

## Use editable files with your agent

The independent repository's README documents the maintained local commands:

```sh
pnpm scene validate drawing.excalidraw
pnpm render drawing.excalidraw output/rendered
```

Rendering imports a validated native scene into the same renderer and writes
editable, PNG and SVG outputs. It requires the built app and the host's
existing Playwright Chromium. It does not require a model service or a new
scene protocol.

An explicitly authorised script in the editor's own browser can read its
revision and request a scene replacement with that expected revision. Human
edits made in the meantime reject the replacement. Browser authentication for
another app does not grant drawing access.

The newer independent source also supplies a **local stdio MCP adapter**, qualified
here at `9fec6e795dd3fc68d1fb5a63f72c5e698e4c8fc1`. From that reviewed checkout,
`pnpm mcp --workspace /absolute/path/drawings` selects an explicitly owned local
drawing directory; `--read-only` removes mutation. The actual native MCP
read/edit/stale-write/render/round-trip evidence is in the
[diagram continuation receipt](evidence/product-completion-20261025/ldraw-receipt.json).
This is a local tool, not a hosted endpoint or Composer agent grant. It does not
change the separately pinned hosted editor below, whose deployment remains its
own release decision.

## Composer discovery and release identity

[`lib/ldraw/source.json`](../lib/ldraw/source.json) records the exact reviewed
independent source, origin and manifest hashes. The byte-exact static manifest
snapshot has no Composer data capabilities, configuration or service binding.
It stays separate from the Guestbook/Linkarooie composition lock and owner
configuration.

Composer's `/ldraw` entry redirects to the fixed independent origin. Only
`analytics=off` and a bounded verification label may travel with it. Project
details, drawings, account fields and arbitrary destination parameters do not.
A fragment stays client-side; the browser never sends it to a server and the
editor does not read an arbitrary one.

A fresh visitor opens the dark workspace with the Creator journey example
already on the canvas. The editor also installs a named portfolio block
library, so a diagram can start from an editable block instead of a blank
canvas; both behaviours are part of the reviewed
`fa7a2ab6171cf53edc53c01630fbba2d5d4888aa` release.

The Apps library, catalogue and common launcher use real captured workspace
pixels beside a text title. LDraw has no approved identity mark, so the 96px
menu/library tile is App Composer's typographic discovery tile — the app's own
name on the canonical orange — rather than an invented LDraw logo. Each
independent common-launcher consumer commits and releases its own copy. The
current pixels, capture timestamp and exact source are recorded in the capture
provenance beside the artwork. Composer's most recent capture and device
journeys are in
[`evidence/ldraw-refresh-20261025/`](evidence/ldraw-refresh-20261025/README.md).

Device assessments are bound to the exact reviewed release in
[`config/device-support.json`](../config/device-support.json). Desktop Chromium
keyboard/pointer journeys and a limited 390px browser journey are recorded
separately from physical touch, tablet, stylus and screen-reader acceptance.
Changing the adopted source without matching evidence returns support to
unknown. [Issue #290](https://github.com/loftwah/app-composer/issues/290) owns
remaining acceptance; [#11](https://github.com/loftwah/app-composer/issues/11)
owns exact deployment, source and live evidence.

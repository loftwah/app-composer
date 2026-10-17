#!/usr/bin/env bash
# Historical v5 exports are preserved in Git history. They overwrote versioned
# owner images and replaced the kangaroo with a chain mark; never rerun them.
set -euo pipefail
printf '%s\n' 'Historical exporter disabled. Read docs/visual-direction.md and docs/source-maintenance.md. Render selected, versioned derivatives with .artwork/og/render-linkarooie-identity.mjs; distribute only reviewed explicit assets.' >&2
exit 1

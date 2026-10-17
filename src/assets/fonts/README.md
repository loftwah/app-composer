# Server share-card typeface

`SpaceGrotesk.ttf.bin` is the unmodified Space Grotesk variable TTF from
[upstream commit 03507d024a01282884232081fc6011c09ff4e849](https://github.com/floriankarsten/space-grotesk/blob/03507d024a01282884232081fc6011c09ff4e849/fonts/ttf/SpaceGrotesk%5Bwght%5D.ttf).
SHA-256: `acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72`.
Size: 136,676 bytes. Copyright 2020 The Space Grotesk Project Authors.

The SIL Open Font License is included as `OFL-Space-Grotesk.txt`. The `.bin`
suffix makes Cloudflare/Vite bundle the exact bytes as a Data module. No font
request, platform font or executable font conversion occurs at runtime.

The existing browser `public/brand/space.woff2` is a Vietnamese-only subset.
It contains no basic Latin letters; browsers silently fall back for those
characters, while a server renderer with only that face produces missing-glyph
boxes. This full TTF gives the card its intended self-hosted face. Browser font
correction is a separate shared frontend change.

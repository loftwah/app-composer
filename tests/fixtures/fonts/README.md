# Font fallback regression

`space-vietnamese.woff2` preserves the 6,628-byte subset formerly shipped as
`public/brand/space.woff2`. SHA-256:
`4539c771f849847bb8a7a8490699750ec1538e10c9060c4e9f154a692808ddfd`.
It loads successfully but lacks basic Latin letters. Keep it as a negative test,
never a public/export font. Space Grotesk copyright 2020 The Space Grotesk Project
Authors; the [SIL Open Font License](../../../src/assets/fonts/OFL-Space-Grotesk.txt)
applies. The complete positive source and its provenance are in that directory.

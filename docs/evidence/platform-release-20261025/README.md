# Integrated platform release — 25 October 2026

PR #384 merged native Plugin Trust Centre, Brand Studio and Incident Desk,
audience paths, model-edited atlas scenes and optional Node 24 support. PR #385
corrected the migration test’s stale 0018 ceiling while preserving its collision
checks and recorded filenames. Exact production source is
`b9f743729bfca15088a28fd47919b5be8d660997`, Worker
`c5e8bed2-64ac-41f1-9cb1-3eab33ffcd2b`.

The first guard stopped before any remote migration/build/upload: 1,186 tests
passed, two optional Guestbook tests skipped, one stale migration assertion
failed. Independent review confirmed the narrow correction. The repeated clean
pushed-main guard passed audit, types (zero errors/warnings), lint, formatting
and 1,187 tests / zero failures / the same two optional skips. It applied only
0019 (empty explicit identity bindings) and 0020 (empty appearance version tables).
Existing users, roles, memberships, grants and app records were not rewritten.

The successful guard measured audit 0.5s, full checks 149.7s, migrations 1.9s,
build 19.4s, upload 30.0s, live source/pins 0.8s, sharing 0.2s, publication privacy
1.9s and anonymous boundary 0.1s. Upload was 15,188.73 KiB / gzip 3,862.73 KiB;
16 static assets changed. Both owned disposable release roots were removed,
including the failed attempt. These are local elapsed time/transfer measures;
billed money, provider CPU and invoice attribution are unknown. No new paid
resource or commitment was created.

The actual production browser receipt covers six homepage width/theme views,
keyboard navigation, separately labelled doubled-text reflow, three new audience
paths, public Trust Centre and incident explanations, both changed atlas views
in desktop/phone themes and editable downloads. Anonymous native reads remain
denied. Representative live pixels are beside the receipt and were inspected.
The [original homepage comparison](../homepage-20261025/README.md) retains the
original defect and earlier first release; no content was hidden to fix it.

Native functional acceptance is the actual isolated EmDash/D1 journey for
[Brand Studio](../brand-studio-20261025/README.md),
[Incident Desk](../incident-desk-20261025/README.md) and
[Trust Centre](../plugin-trust-native-20261025/README.md). Production admin
verification reached Cloudflare Access sign-in; first live appearance publication
requires the existing human owner session. No login mail or IdP change was
attempted. Local appearance publication, subsequent change and restoration
passed; production appearance publication is not claimed. The identity guard
remains compatible until immutable upstream claims/bindings/recovery are
qualified, and no native plugin lifecycle or entitlement is claimed.

#11 owns the single canonical run handoff, including later independent slices.

# Mini-app device support

Composer discovery works on phones, tablets and desktops. Each independent app
may intentionally target desktop only, mobile only or both. The choice describes
what to build; it does not prove the released editor, game or file handling works.

In Init, **Devices for your app** saves `deviceTarget` in the portable version 2
spec and agent handoff. Old drafts default to `unknown`. Importing, changing the
starting point, saving and exporting preserve an explicit target. This does not
change a live app or the operator/build environment selected by Get Ready.

The optional `deviceSupport` field in a version 1 mini-app manifest has its own
version. Existing manifests remain valid and unchecked. The pinned manifest in
`composition.lock.json` carries the creator intention and declaration shape.
Actual release assessments live once in `config/device-support.json`, keyed by
app `id` and exact adopted `revision`, with the checked declaration in `support`.
Keeping the assessment outside the app commit avoids an impossible self-hash.
The public helper requires one exact record and matching manifest intention;
duplicate, stale or missing records stay unknown. The initial record list is
empty: no existing app gains a compatibility claim from prior screenshots.
Do not hand-edit a pin to manufacture support: check and release the independent
app, then adopt its exact reviewed source through the existing promotion path.

```json
{
  "deviceSupport": {
    "version": 1,
    "target": "both",
    "activities": {
      "core": {"desktop": {"status": "unknown"}, "phone": {"status": "unknown"}},
      "edit": {"phone": {"status": "unsupported", "note": "Use a desktop to edit."}}
    }
  }
}
```

Activities are `core` (the main task), `view`, `edit`, `play`, `import` and
`export`. Each activity can assess `desktop`, `phone` and `tablet` separately.
Missing entries mean unknown, including tablets when only a phone was checked.
Statuses are `unknown`, `supported`, `limited` and `unsupported`. Limited and
unsupported states require a useful explanation. Practical requirements can name
keyboard, pointer, touch, stylus, landscape, portrait, file-download or file-picker.

Supported and limited assessments require `evidence` with the exact 40-character
source `revision`, a valid `checked` date, `method` (`browser-emulation` or
`physical-device`) and the actual `journey` exercised. A screenshot alone is not
an accepted method. Public discovery rejects stale-revision or malformed metadata
to unknown; strict manifest validation rejects malformed declarations outright.
Emulated checks never become physical-device acceptance.

The shared notice shows a view/edit split when those exact activities support it,
and exposes requirements and evidence in a native disclosure. Device filters only
list confirmed main-task support as compatible. Limited support and unchecked
apps have separate selections. Visitors choose filters; no user-agent sniffing or
viewport blocking runs, and opening an app remains possible.

Independent apps must reuse the declaration in their own entry/help surface and
explain unsupported operations before accepting work. Offer a safe viewing mode,
an address to open on another device or a return to the app list. Keep existing
files and edits intact. Copying an address never transfers browser-local files.
Those independent releases, launcher copies, actual core journeys and any
physical-device checks remain separate acceptance gates under #288.

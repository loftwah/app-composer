# Maintaining the source

Author source for review: normal indentation, readable statements and explicit component boundaries. Build tools handle minification. Keep structural cleanup separate from changes to product behaviour, data contracts or storage.

## Native mini-app editor

`src/plugins/miniapps-admin.tsx` registers the EmDash page and assembles the editor. The modules in `src/plugins/miniapps/` have distinct responsibilities:

| Module | Owns |
| --- | --- |
| `use-miniapps.ts` | Drafts across app switches, current snapshots, request generations, mutation exclusion and recovery. |
| `api.ts` | Existing EmDash read/write transport and error handling. |
| `settings.tsx` | App appearance and profile fields. |
| `link-editor.tsx` | Manual link edits, conflicts, preview and card presentation. |
| `photo-preview.tsx` | Private photo decoding and canvas lifecycle. |
| `guestbook-workspace.tsx` | Submission and moderation controls. |
| `showcase-workspace.tsx` | Collection, tags, achievements, retained edits and eligible photos. |
| `types.ts` | The existing editor's shared types. |

State stays above the two workspaces so switching apps retains unsaved work. A single `?app=showcase` selects Linkarooie on entry; absent, unknown or duplicated app parameters select Guestbook. This selects a view only and grants no permission. Keep component identities stable; do not define components inside the page or hook. Mutations and profile-file operations share one exclusion reference. Snapshot generation checks prevent an older refresh from replacing a newer response. The server bridge in `src/lib/miniapp-admin.mjs` still owns authorization, validation and app service calls; extracting components grants no additional authority.

## Public sharing, theme and launcher assets

Composer's `public/brand/` is the maintenance source for the MIT sharing/theme files (`page-share-url.mjs`, `page-share.mjs`, `page-share.css`, `theme-control.css`) and `launcher.css`. The launcher controller is authored as strict TypeScript in `src/browser/launcher.ts`; `node scripts/launcher-assets.mjs --write` type-checks and emits its readable `public/brand/launcher.js` distribution. `--check` type-checks and rejects stale generated output. Compilation emits in memory and creates no temporary project. Each independent app commits and deploys its own copy. There is no cross-origin asset fetch, Composer runtime dependency, package publication or automatic update.

Inspect existing copies with explicit checkout paths:

```sh
pnpm ui:assets --check /absolute/app-checkout /absolute/another-app-checkout
```

After reviewing the source change, copy those six files into selected checkouts:

```sh
pnpm ui:assets --write /absolute/app-checkout /absolute/another-app-checkout
```

Check is read-only and exits nonzero for different bytes. Write preflights every selected app and changes only different named files. It refuses unknown packages and linked destination files/directories. It preserves unrelated branding, configuration and content. Inspect existing edits and review each resulting Git diff before committing; this explicit write command replaces local edits in the six selected files. A repeated write leaves matching files untouched. Updates still use each app's own review/release process and exact composition pins.

### Launcher markup and maintenance contract

All six shells use the same local launcher assets. The shipped consumers are Guestbook (`public/brand`), Showcase (`public/brand`), Hello (`public/brand`), State (`public/brand`) and Link Check (`public/brand`), plus Composer itself. Guestbook/Showcase use their existing mount prefix for both assets, so the same source serves `/guestbook/` and `/showcase/`; exact composition pins and independent app releases remain required.

The markup consists of `[data-open-apps]` (a button with `aria-haspopup="dialog"`), `dialog#app-navigation` with a labelled heading, a first `[data-close-apps]` button with `autofocus`, a labelled `input[type=search]`, `[role=status]`, and `ul > li[data-destination] > a` destinations. Optional images and `span > small` supply aligned artwork and descriptions. Composer may add `.launcher-all` after the list. Mark known current-app links with `aria-current="page"`; otherwise exact same-origin paths are detected. Missing images keep their alignment space; text-only tasks use the full row. Destinations, app access boundaries, theme storage, galleries and owner settings remain local.

Touch/click opening focuses Close without opening the keyboard. Cmd/Ctrl+K opens and focuses search, and focuses search if already open. Native dialog focus, Escape and modal isolation are retained. The fixed body lock restores page position and focus; only destination rows scroll. Geometry uses visual viewport size and offsets, safe-area padding, orientation and keyboard resize. Inputs have a computed default floor of 16px, while user zoom/text sizing remains available. This contract does not establish physical-device IME or iOS zoom acceptance.

For each update: edit maintained TS/CSS, emit the controller, explicitly check/write all five checkout paths, review each diff, check/build each independent app, and verify both mounted routes after their exact source-pin promotion. The maintenance check type-checks the controller before comparing all selected copies and refuses stale generated source. A new launcher copy is allowed only through explicit write; existing sharing/theme files and linked paths retain their safety checks.

App-specific navigation/header branding, theme storage keys and bootstrap scripts remain separate. The content-site template has its own simple site header rather than an Apps launcher and is not a launcher consumer.

## Verification

Use focused checks while editing:

```sh
node --test tests/public-ui-assets.test.mjs tests/page-share.test.mjs
node --test tests/miniapp-admin.test.mjs tests/miniapp-*-ui.test.mjs
pnpm check:types
```

For editor changes, exercise app switching, unsaved inputs, refresh/conflict recovery and explicit saves with fictional fixtures. Check the protected live editor after release using an existing authorized administrator session. Source cleanup does not justify mutating owner content. Existing production deployment checks remain the release boundary.

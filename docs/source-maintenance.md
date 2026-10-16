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

State stays above the two workspaces so switching apps retains unsaved work. Keep component identities stable; do not define components inside the page or hook. Mutations and profile-file operations share one exclusion reference. Snapshot generation checks prevent an older refresh from replacing a newer response. The server bridge in `src/lib/miniapp-admin.mjs` still owns authorization, validation and app service calls; extracting components grants no additional authority.

## Public sharing and theme assets

Composer's `public/brand/` is the maintenance source for four MIT files: `page-share-url.mjs`, `page-share.mjs`, `page-share.css` and `theme-control.css`. Each independent app commits and deploys its own copy. There is no cross-origin asset fetch, Composer runtime dependency, package publication or automatic update.

Inspect existing copies with explicit checkout paths:

```sh
pnpm ui:assets --check /absolute/app-checkout /absolute/another-app-checkout
```

After reviewing the source change, copy those four files into selected checkouts:

```sh
pnpm ui:assets --write /absolute/app-checkout /absolute/another-app-checkout
```

Check is read-only and exits nonzero for different bytes. Write preflights every selected app and changes only different named files. It refuses unknown packages and linked destination files/directories. It preserves unrelated branding, configuration and content. Inspect existing edits and review each resulting Git diff before committing; this explicit write command replaces local edits in the four selected files. A repeated write leaves matching files untouched. Updates still use each app's own review/release process and exact composition pins.

App-specific navigation, theme storage keys, bootstrap scripts and generated-site templates remain separate. This command does not claim to synchronize those implementations. Extend the shared source list only when behaviour is actually common; keep owner configuration out of it.

## Verification

Use focused checks while editing:

```sh
node --test tests/public-ui-assets.test.mjs tests/page-share.test.mjs
node --test tests/miniapp-admin.test.mjs tests/miniapp-*-ui.test.mjs
pnpm check:types
```

For editor changes, exercise app switching, unsaved inputs, refresh/conflict recovery and explicit saves with fictional fixtures. Check the protected live editor after release using an existing authorized administrator session. Source cleanup does not justify mutating owner content. Existing production deployment checks remain the release boundary.

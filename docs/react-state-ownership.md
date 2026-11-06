# React state ownership

Reviewed 6 November 2026 for
[#402](https://github.com/loftwah/app-composer/issues/402). Composer's admin
surfaces use local React state heavily and that is not a defect. The rule is
ownership: an authenticated server record is the authority for anything the
owner did not type into the current form.

## Decision table

| Kind of value | Owner | Where it lives | Examples |
| --- | --- | --- | --- |
| Form draft the person is editing | The current component | `useState` (or a controlled field) | Settings text, link editor fields, share-card image draft |
| Disclosure, filter, tab, page size | The current view | `useState` | Hidden-items toggle, order filter, visible count |
| Ephemeral feedback | The current action | `useState` | "Saving…", "Saved", validation message |
| Selection intent | The current view | local state plus the URL when it should survive reload | Selected app, order, workspace hint |
| Derived value | Nobody new | Compute during render | Counts, filtered lists, labels |
| Authenticated server record | EmDash / the app Worker | Fetched into state, never edited as if it were the store | Orders, stacks, resource inventory, mini-app snapshots |
| Cross-page preference | The person | Existing versioned browser storage | Theme, assistance level, readiness progress |
| Effectful workflow | The server workflow record | Existing persisted runs and receipts | Inbox journey, notifications, releases |

Rules for a new surface:

1. Name the owner before adding state. If the server owns it, the UI may hold a
   copy, but the next read must replace it and a stale read must not.
2. A component that performs its own data call and stores the result in
   `useState` must also carry a stale or unmount guard: a generation ref, an
   active/live ref, or an `AbortController` tied to the effect cleanup.
3. Do not copy server data into a second global store. The existing
   authenticated API remains the authority.
4. Form drafts may survive a reload only through the existing bounded browser
   storage, not by assuming an unsaved draft is published.

## Review ledger

| Surface | Server authority | Local state kept | Decision |
| --- | --- | --- | --- |
| `src/components/ReadyPlatform.tsx` | Member session, platform assessment | Selected workspace, busy/status, observed account | Keep. Generation plus live ref; an account change clears the selection before any write. |
| `src/plugins/resource-inventory-page.tsx` | Resource inventory read | Workspace hint, provider report import, busy/error | Keep. Generation/active refs and a workspace confirmation reject stale scope. |
| `src/plugins/orders-page.tsx` | Orders snapshot | Filters, selected order, fixture draft, operation references | Keep. Live ref and generation guard; a stale scope cannot silently replace the current one. |
| `src/plugins/miniapps/use-miniapps.ts` | Per-app snapshots | Link achievement and profile drafts, visible count | Keep. Independent apps load with `Promise.allSettled`; drafts are local and saves reload the owned snapshot. |
| `src/plugins/stacks-admin.tsx` | Stack, history and configuration | Drafts and review state | Keep. Independent reads use `Promise.allSettled`; expected revisions are passed back on write. |
| `src/plugins/plugin-trust-page.tsx` | Read-only trust report | Error/loading and a refresh counter | Keep. An `AbortController` cancels the effect and guards each write. |
| `src/plugins/miniapps/settings.tsx`, `link-editor.tsx` | The parent hook's save | Field draft and status | Keep. These are controlled form parts; the guarded parent owns the request. |
| `src/components/EffectRunDemo.tsx` | A committed replay fixture | Phase selection and copy status | Keep. Static evidence, no server record. |

No material duplicate-server-state or stale-read defect was found in this pass,
so no component was rewritten and no global store was introduced.

## Enforced boundary

`scripts/state-ownership.mjs` runs through `pnpm lint`. It fails when a
`.tsx` file under `src/plugins` or `src/components` keeps `useState` **and**
performs a direct data call without a stale guard (`useRef`, `AbortController`
or `controller.signal`). `tests/state-ownership.test.mjs` proves the unsafe
fixture fails and that a guarded fetch and an ordinary form pass.

The guard deliberately does not ban `useState`. Form drafts, filters, toggles
and ephemeral messages remain local by design.

# Public prompt library

`/prompts` is a public task desk. Choose a job, enter a safe project reference and
the requested outcome, inspect the preview, then copy or download it. It makes
no model calls and performs no provisioning or privileged action.

`src/lib/prompt-library.ts` owns the module metadata, prerequisites and renderer.
The resource kit consumes the same `renderPrompt(id, values, { template })`
result. Setup/check/resume import the existing `readyTasks` handoffs directly;
the library is not a second setup engine. Content-model and composition jobs
link to the real Init editor and require its validated specification.

Each job has a stable fragment such as `/prompts#change` or
`/prompts#incident`. Links contain only the module ID. Search and job navigation
retain typed details in memory. The project reference is reused across otherwise
untouched modules. No field values are sent to analytics or encoded in URLs.

Saving is an explicit **Save details on this device** action. Restore replaces
the prompt library's current entries with its versioned, validated saved data;
Clear removes only prompt-library entries from the tab and its own local-storage
key, `composer:prompt-library:v1`. Existing Init drafts are never read or written.
Do not enter keys, passwords or private customer records. Browser storage remains
available to other scripts on the same origin and people using that browser.

**Copy completed prompt** checks required fields and focuses the first missing
answer. **Copy template** explicitly displays and copies the bracketed template.
The preview is the copied text. Clipboard failure exposes a labelled selectable
textarea. Without JavaScript every complete template remains readable and can
be selected manually. Markdown download uses the completed renderer output.

Admin, authentication, webhook and commerce modules use **Assess and prepare**
where runtime/provider qualification is incomplete. Their presence does not
claim that a connector exists, that mail was delivered, or that a payment or
fulfilment occurred. Resource examples and agent prompts never grant authority.

Focused verification:

```sh
node --test tests/prompt-library.test.mjs
```

Release qualification also needs the integrated type/build/test gates and real
browser journeys: setup, completed existing-project change, Composer self-use,
missing required fields, manual clipboard fallback, search/no-results,
Back/Forward, explicit save/restore/clear, no-script templates, both themes and
phone/intermediate/desktop layouts. Production, provider and physical-device
acceptance remain separate from this source/fixture proof.

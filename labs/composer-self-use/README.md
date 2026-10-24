# Composer authoring a Composer change

The 24 October 2026 trial used the actual public `/prompts#composer` form in a
fresh browser context to author and download
[the complete request](2026-10-24-request.md). Its SHA-256 is
`e75cc5d8831420133d325cd78b44d64fda7a0fd10f494c8bf5cdc6ac42280bab`.
No Init model was needed for this small existing-interface change. Existing
owner drafts were not loaded or overwritten.

A fresh agent received that exported request and an isolated checkout at
`a9309ab`. The generated output was the request, not implementation code.
The agent subsequently authored a focused accessibility change and regression
assertion, committed as `bddc509`, integrated as `86adc5f`.

The change moves the existing `resource` fragment onto the selected runbook's
heading with `tabindex="-1"` and preserves its native URL and no-JavaScript
navigation. No new framework, dependency, event interception or storage was added.
The targeted regression failed before the change; eight resource tests and the
Astro component compiler then passed.

The release browser journey must verify Enter on a resource link focuses that
heading and the next Tab reaches its selected Markdown download, including
same-resource selection, phone/desktop and JavaScript disabled. #11 owns the
exact deployed source and completed live receipt. A copied request alone does
not establish tool installation, autonomous self-development or human acceptance.

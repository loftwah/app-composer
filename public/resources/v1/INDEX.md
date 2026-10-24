# App Composer operating kit

Version: composer.operating-kit/1
Reviewed: 2026/10/24 (Australia/Melbourne)

## Start with one job

- [Make a change](change.md): A small, reviewed improvement with evidence that it works.
- [Handle an incident](incident.md): A bounded investigation, a permitted response and an independently checked recovery.
- [Set up or repair a pipeline](pipeline.md): A release sequence that stops on failure and checks the deployed result.
- [Connect a hook](hook.md): A small event handler with a clear trust boundary and visible failures.
- [Add the operating kit to my project](operating-kit.md): A portable set of instructions, diagrams and examples that fits your existing project.

## Use in your project

Read the selected Markdown runbook and its complete prompt template. Answer its labelled placeholders or delegate discoverable details to project inspection. Reconcile existing project instructions before adopting files. No previous chat or Composer website is needed to read the kit. External tools and access are still required to act.

## Runnable fictional examples

Requires Node 22. From this unpacked folder run:

```sh
node examples/exercise.mjs
```

This exercises failed-check publication blocking, ordered local stages, missing access, duplicate suppression, authentication/scope rejection, uncertain-effect reconciliation and a bounded synthetic incident. It creates no files, makes no network requests, sends no mail and publishes nothing. The event fixture is not a provider webhook endpoint; its in-memory Map is not a production outbox.

## Editable files

The diagrams are Mermaid source (.mmd) plus readable SVG exports. Open the PDF in a PDF viewer. To regenerate it, use Python 3 with ReportLab and run `python3 operating-cheatsheet.py`; the included Space Grotesk font is under the accompanying OFL licence. The mark is Composer's approved merging-block identity. Share PNGs are composed explanatory artwork, never product screenshots.

## Scope and proof

Local fixtures prove only their named behaviour. Real provider, production, physical-device and fresh-agent longitudinal acceptance remain separate. Do not treat a downloaded prompt as authority to deploy, spend or change access. See the selected runbook for prerequisites, failure and continuation.

Source: https://composer.loftwah.com/resources
Evidence: https://github.com/loftwah/app-composer/issues/11
Licence: MIT; bundled Space Grotesk uses OFL.

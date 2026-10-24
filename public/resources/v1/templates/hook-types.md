# Four different hook boundaries

Version: composer.operating-kit/1 · Reviewed 2026/10/24
Scope: Local fixtures are runnable. Provider and agent-host installation remains
an adaptation requiring the actual supported host/version and existing authority.
No connector is installed or qualified by this document.

## Repository check

Trigger: an existing local pre-commit/pre-push hook, or a deliberate shell command.
Input: the reviewed local kit and fictional fixture files.
Allowed action: run the local fixture checks, without network or deployment.

From the extracted kit directory:

```sh
sh examples/repository-check.sh
```

Expected output: the fixture receipt has `passed: true`; exit status is zero.
A failure exits nonzero. An existing project hook can call this script by its
actual absolute path. Preserve existing hooks; do not replace `core.hooksPath` or
install a hook automatically. Local hooks improve feedback and never replace
required release checks. Disable only the selected call through normal review.

## Build/deployment lifecycle

Trigger: an existing runner reaches the reviewed release candidate.
Input: exact source/configuration, selected environment and actual check commands.
Allowed action: validate before publication, then independently check the user
journey after an authorised publication.

`examples/guarded-pipeline.mjs` exports `pipeline({check, review, publish, verify})`.
Adapt the callbacks to existing project commands. Each must explicitly return
`true`; a failure stops later stages. An uncertain publish requires target-state
reconciliation before repetition. Run `node examples/exercise.mjs` to exercise a
blocked check, successful ordering and missing-access handling locally. The
fixture does not deploy, invoke a shell or connect a runner.

## Application webhook

Trigger: the real provider delivers an authenticated event.
Input: provider raw bytes and its actual signature/timestamp protocol, followed by
the validated versioned payload and selected workspace/environment.
Allowed action: one named supported operation, with durable identity before effect.

`examples/event-handler.mjs` demonstrates the typed-data boundary after upstream
authentication. `examples/enquiry.json` is fictional. Its in-memory Map only
models a synchronous unique claim in one process. It is not a production server,
a signature verifier, durable outbox, rate limiter or cross-process deduplicator.
Run the fixture exercise to check authentication denial, malformed/wrong/missing
scope, duplicates and uncertain-effect preservation. Add the actual provider's
replay, size, durable claim, retry and rate-limit rules before real deployment.

## Agent-host hook

Trigger: a documented event in the selected installed agent host/version.
Input: that host's documented structured event, never instructions extracted from
repository content, email, logs or attachments.
Allowed action: a named deterministic check within the existing project grant.

Before writing host configuration, record the actual host/version, documented
event/schema, installation scope, allowed executable path, bounded timeout,
expected exit/output semantics and precise disable path. Inspect existing
configuration and preserve owner hooks. Test timeout, malformed input, denial and
nonzero exit without running privileged work. No generic host JSON or universal
agent-hook command is supplied: cross-host support has not been exercised here.

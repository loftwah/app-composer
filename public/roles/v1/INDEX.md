# App Composer agent role packs

Version: composer.role-packs/1
Reviewed: 2026-10-24 (Australia/Melbourne)

Six job contracts for an owner's local agent. Each pack states its inputs,
evidence, output, stop rules, prohibited actions, negative tests and one worked
fictional example. A pack is expertise and a job template, not an access grant.

## Packs

- [Service Owner: Service review and change decision](service-owner.md) — v1.0.0
- [Programmer: Defect investigation and patch proposal](programmer.md) — v1.0.0
- [Architect: Dependency decision record](architect.md) — v1.0.0
- [DevOps / SRE: Drift, rollout and rollback review](devops.md) — v1.0.0
- [Security: Boundary and exposure review](security.md) — v1.0.0
- [QA: Release gate and journey verification](qa.md) — v1.0.0

## Run a brief

From a checkout of App Composer with Node 22:

```sh
node scripts/roles.mjs check
node scripts/roles.mjs brief --role qa --input examples/role-packs/fictional-trail-notes.json
```

A refused brief exits 2 with a human action. A brief with a blocking stop prints
the brief and exits 3. Nothing is approved, deployed, merged, spent or granted.

## Shared fictional bundle

[examples/fictional-trail-notes.json](examples/fictional-trail-notes.json) is one
bundle for Trail Notes, its service, isolated Preview, dependencies, ownership,
gates, drift and security paths. All six packs read the same evidence so their
jobs can be compared.

## Boundaries

Proposal only. The accountable human decides. Never place credentials, private
records or customer data in a bundle. No provider action, deployment or paid
commitment is authorised by a pack, prompt or generated brief.

Source: https://composer.loftwah.com/roles
Evidence: https://github.com/loftwah/app-composer/issues/11
Licence: MIT.

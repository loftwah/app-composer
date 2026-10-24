# Post-incident review

Version: composer.operating-kit/1 · Reviewed 2026/10/24
Scope: Adapt to the actual incident. This is not proof that an incident occurred.

## Outcome and impact

State the affected user journey, actual impact and measured duration. Separate
known observations from unavailable measurements. Name the selected application,
account, environment, source and release. Keep fictional rehearsals labelled.

## Timeline

Use YYYY/MM/DD HH:mm with Australia/Melbourne and UTC for each entry. Include
detection, investigation, each authorised intervention, independently observed
recovery and relevant failed attempts. Distinguish event time from log-reading time.

## What the evidence supports

- Initial symptom and reproducible failure:
- Confirmed contributing cause, with evidence:
- Hypotheses rejected and the observations that rejected them:
- Unknowns that remain:
- Actual recovery action and its existing authority:
- Original user journey and negative case exercised after the response:
- What did not work, including tooling or permission gaps:

Do not fill unknown causes from confidence or a recent deployment alone. Review
systems and decisions without inventing blame. Preserve bounded evidence while
respecting retention, revocations, deleted data and private records.

## Follow-up work

| Action | Observable success | Owner | Due date | Owning issue/reference |
| --- | --- | --- | --- | --- |
| Describe a concrete improvement | A test or observed journey | Assign explicitly | YYYY/MM/DD | Keep existing ownership |

Separate prevention, detection, response and recovery. Prefer useful changes to
existing mechanisms over a new orchestration platform. Record deferred checks,
code/configuration rollback limits and whether isolated data restoration was
actually exercised. Close follow-ups only when their individual evidence exists.

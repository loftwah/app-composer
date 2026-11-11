import type { PromptField, PromptModule } from './prompt-library.ts';

const project: PromptField = {
  key: 'project', label: 'Your project', example: 'The selected app or project folder',
};
const scope: PromptField = {
  key: 'scope', label: 'Area to check (optional)', example: 'The main user journey, or inspect the project and choose a useful starting point',
};
const details: PromptField = {
  key: 'details', label: 'Context or constraints (optional)', example: 'Keep existing behaviour and account for the current release policy',
};
const changes: PromptField = {
  key: 'changes', label: 'Changes already authorised (optional)', example: 'Fix confirmed issues in the selected area using the existing review and release policy',
};

const assessmentMode = `Assess and report first. If the optional "Changes already authorised" field is blank or absent, keep this task read-only: report findings and recommendations without editing project files, installing packages, changing configuration, committing or deploying. Use existing checks and isolated safe fixtures where permitted; preserve project files and user data. A task title or proposed fix is not authorisation.

If that field explicitly records changes the user has already authorised, implement only that scope under the project's actual permissions, review and release policy. Do not ask again for the same authority. Use relevant installed skills, reading their instructions before applying them. Verify affected behaviour with proportionate checks and preserve unrelated work. Report evidence, any changes made, verification, unresolved decisions and significant coverage gaps. A no-finding result is valid; do not invent defects or claim exhaustive coverage.`;

function maintenanceModule(
  id: MaintenancePromptTargetId,
  title: string,
  description: string,
  task: string,
  result: string,
  related: string,
  fields: PromptField[] = [scope],
  category = 'Check & improve',
): PromptModule {
  return {
    id, title, category, description, support: 'Ready to use',
    fields: [project, ...fields, details, changes], prerequisites: [], related, result,
    task: `${assessmentMode}\n\n${task}`,
  };
}

/** Optional maintenance tasks. These are portable instructions, not an executor. */
export const maintenancePromptModules: readonly PromptModule[] = [
  maintenanceModule('health', 'Check my app’s health',
    'Look for important problems and show what needs attention.',
    `Map the project's main components and user journeys, and establish the current state of relevant checks. Inspect important bugs, inconsistent behaviour, avoidable waste and obsolete code. Follow callers, configuration and data flows before deciding something is broken or unused. Support findings with a reproduction, failing check or clearly incorrect code path. Prioritise by user impact. For authorised fixes, make coherent changes and verify the affected behaviour. Finish with inspected areas, supported findings, verified fixes and decisions that remain.`,
    'A prioritised health report with evidence, inspected scope and the outcome of any authorised fixes.', 'verify'),

  maintenanceModule('find-bug', 'Find an important bug',
    'Investigate incorrect results and failures in common journeys.',
    `Find the highest-impact bug you can substantiate in the selected area. Prioritise incorrect results, broken common journeys and data integrity. Trace the behaviour far enough to distinguish a defect from an intentional trade-off. Record the triggering conditions, affected code and realistic impact. If a fix is authorised, correct the cause and repeat the original scenario; add a regression check where useful. If no bug is substantiated, report what you investigated and the limits of that conclusion.`,
    'One supported defect and its impact, or a clear no-finding report; verification for any authorised fix.', 'incident'),

  maintenanceModule('fix-checks', 'Investigate failing checks',
    'Find why a build, test or existing pipeline is failing.',
    `Inspect the existing checks and retrieve logs from the actual failing run. If no failure is supplied, inspect the current branch's available results or relevant existing local checks. Reproduce the failure where practical. Distinguish code defects from test, environment and workflow problems; an unavailable resource is not proof of a code defect. Propose the root-cause correction. For authorised changes, preserve the checks' intent, fix the cause and rerun affected checks. Do not create a replacement pipeline to satisfy this task.`,
    'The failing check, supporting logs, identified cause and actual rerun result, or the precise investigation limit.', 'pipeline',
    [{ key: 'failure', label: 'Failing check or log (optional)', example: 'The current branch’s failing build, or inspect the existing check results' }]),

  maintenanceModule('regressions', 'Check recent changes',
    'Look for behaviour that broke between two versions.',
    `Resolve and record the requested base and current revision before reviewing the diff. Follow changed interfaces into their callers, configuration, jobs and migrations where relevant. Look for behaviour that previously worked and now fails, including missing cases at changed boundaries. Support each finding with the affected path and evidence. Prioritise concrete regressions over style preferences. For authorised fixes, verify the changed behaviour and relevant consumers. Report a clean review with its scope if no regression is substantiated.`,
    'A review tied to exact revisions, with evidenced regressions and the outcome of any authorised fixes.', 'review',
    [{ key: 'comparison', label: 'Which versions should be compared?', example: 'This branch against main, or the last released version against this branch', required: true }]),

  maintenanceModule('remove-unused', 'Find unused code',
    'Identify code, packages and assets that can be removed with evidence.',
    `Inspect candidates for obsolete code, dependencies, configuration and assets. Check dynamic loading, public interfaces, background jobs, deployment configuration and possible external consumers before concluding that something is unused. Static search results alone may be insufficient. Explain the evidence and expected effect of each proposed removal. Remove confirmed leftovers only within the authorised scope, then verify affected build and runtime paths. Keep uncertain candidates separate and identify what would resolve the uncertainty.`,
    'Evidence-backed removal candidates, verified authorised removals and clearly labelled uncertainty.', 'health'),

  maintenanceModule('simplify', 'Simplify part of my app',
    'Find unnecessary branching, duplication and difficult abstractions.',
    `Inspect the selected module or feature for complexity that makes its actual uses harder to understand or change. Trace callers and state ownership before suggesting a simpler structure. Prefer a focused improvement that preserves public behaviour and established conventions. Explain the trade-off and why the proposal reduces complexity. If changes are authorised, implement the clearest case and verify its callers and interactions. Avoid unrelated architecture changes and report when the existing design is already appropriate.`,
    'A concrete simplification proposal or verified authorised change, with its effect on behaviour and maintenance.', 'review'),

  maintenanceModule('updates', 'Check for updates',
    'Review dependencies, runtimes and supported upgrade paths.',
    `Inspect actual dependency versions, runtime pins, lockfiles and build or release configuration. Check the maintainers' current support guidance, release notes and relevant security advisories. Distinguish compatible updates from migrations and unsupported combinations. Coordinate with existing upgrade work. Apply only authorised updates, keeping related pins and lockfiles consistent, then verify the build and affected behaviour. Report remaining upgrades with their benefits, breaking changes and required work; do not describe an unverified upgrade as complete.`,
    'A supported update plan with current sources, and exact versions and checks for any authorised upgrades.', 'verify'),

  maintenanceModule('performance', 'Find what is slow',
    'Measure a slow journey, request, job or build before proposing changes.',
    `Investigate the named slow path, or select one important representative path and explain the choice. Establish a useful baseline with stated data, environment and measurement conditions. Use available profiling or measurements to identify the actual bottleneck. Propose a worthwhile focused improvement. If authorised, implement it, check correctness and repeat the same measurement. Report before and after results with limitations. If the path is not demonstrably slow or measurements are unavailable, say so instead of inventing a bottleneck or speedup.`,
    'Measured bottleneck evidence and a focused recommendation, with comparable results for any authorised improvement.', 'query-performance',
    [{ key: 'target', label: 'What feels slow? (optional)', example: 'Opening the main list, submitting a form, or building the app' }]),

  maintenanceModule('accessibility', 'Check accessibility',
    'Inspect how people navigate and use an important page or flow.',
    `Run the selected page or flow and combine available automated checks with direct keyboard and browser inspection. Check focus order and visibility, accessible names, form errors, contrast and relevant dynamic states. Trace confirmed problems to the rendered behaviour. For authorised fixes, preserve the intended experience and repeat affected interactions. Explain the scope of the checks and remaining manual or specialist assessment. An automated pass alone does not establish complete accessibility; report unavailable checks honestly.`,
    'Practical accessibility findings, inspected interactions and verification of any authorised improvements.', 'verify',
    [{ key: 'journey', label: 'Page or flow (optional)', example: 'The sign-up form, or the app’s main user journey' }]),

  maintenanceModule('security', 'Review security',
    'Examine the app’s reachable access and data boundaries.',
    `Map the selected application's actual trust boundaries. Prioritise authentication, authorisation, untrusted input, secrets, dependencies and sensitive data where they exist. Trace potential weaknesses to reachable behaviour and distinguish supported findings from hypotheses. Use safe fixtures and the project's existing review boundaries. Propose focused protections; implement and verify only authorised remediation. Rank remaining findings by realistic impact and prerequisites. Keep sensitive evidence in the appropriate private record, and avoid claiming that a bounded review proves the app secure.`,
    'Prioritised security findings with reachable paths, evidence and the verification status of authorised remediation.', 'review'),

  maintenanceModule('data-integrity', 'Check data stays correct',
    'Look for lost, duplicated or inconsistent data when operations fail or overlap.',
    `Inspect a relevant data-changing workflow or migration. Consider partial failure, retries, duplicate requests, concurrent updates and invalid input. Trace database constraints, transaction boundaries and external effects as well as application code. Use isolated representative fixtures rather than valuable user data. Support each finding with a concrete failure path. For authorised fixes, verify the relevant failure and recovery cases. Identify existing-data repair and rollout decisions separately; do not treat permission to inspect as permission to alter production records.`,
    'Supported integrity risks and failure-case evidence, with repair or rollout decisions clearly separated.', 'verify',
    [{ key: 'workflow', label: 'Workflow or data (optional)', example: 'Saving a draft, importing a file, or processing the same event twice' }]),

  maintenanceModule('query-performance', 'Check database queries',
    'Find unnecessary data loading using the app’s actual storage tools.',
    `Inspect the relevant endpoint, page or job using its query logs, profiling tools and representative data. For Rails, check N+1 queries, unnecessary loading and repeated work; for other stacks, use the equivalent data-access evidence. Establish query counts or timings before suggesting a correction. If authorised, apply a focused improvement and repeat the same scenario, checking correctness. Explain proposed schema or index changes separately with evidence. If the app has no relevant query or storage path, report that rather than adding one.`,
    'Measured data-access findings and comparable verification for authorised changes, or a justified non-applicable result.', 'performance',
    [{ key: 'scope', label: 'Data path (optional)', example: 'The list page, search endpoint or job that loads records' }]),

  maintenanceModule('docs-check', 'Check the docs match the app',
    'Compare setup instructions and feature claims with working behaviour.',
    `Compare the selected README, setup guidance, UI copy and documented capabilities with current code and the running application. Verify important setup steps and user journeys where access allows. Distinguish incorrect documentation from an implementation gap against an accepted requirement. Propose accurate wording or a focused fix. Make only authorised changes; preserve intended product requirements rather than silently redefining them to match a defect. Report larger missing capabilities and decisions with supporting evidence and any unverified claims.`,
    'A list of factual mismatches, their evidence and the outcome of authorised documentation or implementation fixes.', 'verify'),

  maintenanceModule('unfinished', 'Find unfinished features',
    'Trace features that look complete but stop short of a usable result.',
    `Inspect a meaningful feature for placeholders, disconnected controls, unused handlers, mocked production behaviour and incomplete error handling. Follow what a user can actually do through to its result. Distinguish an intentionally labelled demonstration from an unfinished supported capability. Identify the smallest complete outcome established by the requirements. Complete gaps only where that work is authorised, then exercise the full journey. List product decisions that cannot be inferred and avoid expanding the task into unrelated feature work.`,
    'Evidence of incomplete journeys and their intended outcomes, with actual verification for authorised completion work.', 'change'),

  maintenanceModule('review', 'Review a change',
    'Get an evidence-based review of a branch, pull request or diff.',
    `Independently inspect the requested diff against the original request, code, checks and observable results. Record the exact revision or comparison. Look for missing cases, incorrect assumptions, regressions and unsupported completion claims. Follow changed boundaries into their consumers. Report actionable findings with locations, evidence and impact; distinguish defects from preferences. Use the existing review stage where available. Fix defects only within the stated change authority. A no-finding review is valid and must state its coverage and remaining limits.`,
    'An independent review of the specified change, with actionable evidence or a scoped no-finding result.', 'regressions',
    [{ key: 'change', label: 'Which change should be reviewed?', example: 'The current branch compared with main, or a pull request or diff reference', required: true }]),

  maintenanceModule('instructions', 'Improve project instructions',
    'Check that the agent gets concise, accurate guidance for this project.',
    `Inspect the actual agent or editor, loaded instruction files, imports and relevant skills. Check AGENTS.md or its supported equivalent against verified project commands, durable constraints and current behaviour. Identify duplicated rules, conflicts, obsolete workarounds and triggers that load too much unrelated guidance. Preserve intentional requirements and existing authority. Propose a concise index with specialised guidance loaded when relevant. If edits are authorised, update the canonical files and exercise a representative task to verify discovery and useful behaviour. Report unavailable loading evidence honestly.`,
    'A grounded instruction review, with verified commands and observed workflow evidence for any authorised changes.', 'operating-kit',
    [scope, { key: 'agent', label: 'Agent or editor (optional)', example: 'Inspect the agent and configuration used for this project' }], 'Agent workflow'),

  maintenanceModule('skill-check', 'Check an agent skill',
    'See whether a selected skill can be found and used for useful work.',
    `Inspect the named installed skill, its trusted source and the current agent's discovery and invocation rules. Confirm it can be found and loaded, then apply it to a suitable representative task within the stated authority. Inspect the resulting artefact or behaviour rather than accepting a claim that the skill ran. Identify missing tools, overly broad triggers, duplicate copies or unsupported capabilities. Repair discovery or configuration only if authorised. Report availability, loading, application and verification separately; installation alone does not prove useful execution.`,
    'An observed skill-use result and precise capability or discovery gaps, with authorised repairs verified.', 'local-agent',
    [
      { key: 'skill', label: 'Which skill should be checked?', example: 'The installed design, debugging or browser-testing skill', required: true },
      { key: 'task', label: 'Representative task (optional)', example: 'Review the settings page or investigate a known local failure' },
    ], 'Agent workflow'),

  maintenanceModule('capture-skill', 'Make a useful workflow reusable',
    'Turn demonstrated repeatable work into a focused skill when it is worthwhile.',
    `Review the completed task and evidence of its successful procedure. Decide whether it contains reusable knowledge beyond ordinary instructions, and check for an existing skill to improve. Propose a precise trigger, inputs, workflow, verification and expected output. Keep detailed references separate and add scripts only where they improve reliability. If creation or updates are authorised, use the agent's supported skill-creator and storage workflow, then evaluate a representative case, an important edge case and a nearby non-trigger. Report a no-skill recommendation when reuse is not demonstrated; do not fabricate a successful trial.`,
    'A reasoned reuse recommendation, or an authorised skill with observed evaluation and discovery results.', 'skill-check',
    [{ key: 'workflow', label: 'Which completed workflow should be reused?', example: 'The successful bug investigation or release check from this session', required: true }], 'Agent workflow'),
];

export type MaintenancePromptSourceId =
  | 'H0' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
  | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22;

export type MaintenancePromptTargetId =
  | 'health' | 'find-bug' | 'fix-checks' | 'regressions' | 'remove-unused'
  | 'simplify' | 'updates' | 'performance' | 'accessibility' | 'security'
  | 'data-integrity' | 'query-performance' | 'docs-check' | 'unfinished'
  | 'review' | 'instructions' | 'skill-check' | 'capture-skill'
  | 'incident' | 'verify' | 'operating-kit';

/** Full source coverage, including existing modules reused by the catalogue.
 * Source 22 can use setup and local-agent as companions when prerequisites are missing. */
export const maintenancePromptSourceMap = {
  H0: 'health',
  1: 'find-bug',
  2: 'incident',
  3: 'fix-checks',
  4: 'regressions',
  5: 'remove-unused',
  6: 'simplify',
  7: 'updates',
  8: 'performance',
  9: 'verify',
  10: 'accessibility',
  11: 'security',
  12: 'data-integrity',
  13: 'query-performance',
  14: 'docs-check',
  15: 'unfinished',
  16: 'review',
  17: 'verify',
  18: 'instructions',
  19: 'skill-check',
  20: 'capture-skill',
  21: 'instructions',
  22: 'operating-kit',
} as const satisfies Readonly<Record<MaintenancePromptSourceId, MaintenancePromptTargetId>>;

const source = 'Use App Composer’s current Get Ready implementation at https://github.com/loftwah/app-composer. Read its trusted AGENTS.md and supported setup instructions in README.md; use the one lib/get-ready engine, not a new checklist or planner. Work in this authorised Codex folder. Keep credentials out of chat and specifications, preserve existing files and save resumable evidence privately. Report what you actually checked, the next step and any precise human action. Give me a redacted progress JSON export using the doctor’s --report flag; never share its private receipt.';

export const readyTasks = {
 setup: {
  label: 'Set up my first app',
  help: 'The agent checks what you already have, then prepares the supported starter. You handle sign-in and approve changes that need your say.',
  prompt: 'Prepare my environment before asking for an app idea. '+source+' Check the available tools, GitHub access and my selected Cloudflare account. Handle ordinary missing-tool repairs using official instructions. Continue independent checks when one step is blocked. Use supported operations to acquire the maintained Hello starter, prepare my private source and tools, then deploy to an unused workers.dev address in my existing authorised account. Confirm the intended owner and destination; never use the launch operator’s account or domain for me. Recheck the exact source over HTTPS. First accounts, new domains and unsupported runtimes still need separate setup: explain the gap honestly. Ask MP for unavoidable sign-in, purchases, expanded permissions or consequential approvals. Do not stop at a plan.',
 },
 check: {
  label: 'Check what is ready',
  help: 'A read-only check. Find missing tools or access without installing, creating repositories or deploying.',
  prompt: 'Check my environment without changing it. '+source+' Run the read-only doctor against this actual workspace, using only my explicitly selected account and existing deployment target if available. Do not install tools, create repositories, change origins or DNS, or deploy. Do not select another person’s account or domain. Separate missing tools, human sign-in, denied access, provider interruptions and unsupported cases. Continue independent checks and report their actual results; saving the private receipt is allowed. Explain the next safe step without executing it.',
 },
 resume: {
  label: 'Continue after sign-in',
  help: 'The agent rechecks saved progress after you finish an account login. Failed setup operations are inspected before another attempt.',
  prompt: 'I have finished the account sign-in step. Recheck my saved Get Ready progress. '+source+' Find the private receipt in this actual workspace and verify that its account, repository and target still match my intended environment. Run fresh read-only checks; a saved green receipt grants no permission. Do not install, create repositories, change origins or DNS, or deploy during this recheck. Do not automatically retry an unfinished operation, change its destination, overwrite partial work or delete anything. If no matching receipt exists, say so and inspect the current environment read-only. Report which checks recovered and the next specific setup step, with any needed approval.',
 },
} as const;

// Default consumers retain the complete setup handoff.
export const readyHandoff = readyTasks.setup.prompt;

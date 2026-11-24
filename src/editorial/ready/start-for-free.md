# Start for free

Bring one small idea and use the AI agent you already have. Start with a compatible app on Cloudflare Workers Free and keep the source in your own GitHub repository. You can browse examples and copy the setup guide before choosing any paid plan.

## Choose an agent and a hosting plan

- **Start with the agent you already use.** Confirm it can read your project and run the tools this job needs. For browser tasks, use the [Get Ready browser check](https://composer.loftwah.com/ready/browser-check).
- **Try a free agent option.** Check the [OpenCode catalogue](https://opencode.ai/docs/console/models/), use `/models` in OpenCode, or run `opencode models` to see what your account can use. Look for a model marked free. [Codex](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan), [Antigravity](https://antigravity.google/pricing) and [Cursor](https://cursor.com/pricing) offer free access with usage limits. [Claude Code](https://claude.com/pricing) is included in Claude Pro.
- **Check temporary offers if you already have Go.** On 24 November 2026 AEDT, HungerG Free (`opencode-go/hungerg-free`) was available through [OpenCode Go](https://opencode.ai/docs/console/go/). OpenCode lists it as a limited-time offer and excludes its prompts and completions from model training. Check current eligibility. If you want to avoid paid overages, keep Go's Extra Usage off.
- **Use Workers Free when the app fits.** It includes 100,000 Worker requests per day and 10 ms of CPU time per invocation. A [GitHub Free repository](https://docs.github.com/en/get-started/learning-about-github/githubs-plans) and an unused `workers.dev` address are enough to start a compatible app. [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- **Upgrade when you have a reason.** [OpenCode Go](https://opencode.ai/docs/console/go/) is US$10/month and has an optional extra-usage setting. Workers Paid starts at US$5/month per account, plus any additional usage. A free agent and compatible Free Worker can cost US$0. Go with Free Workers can cost US$10/month, and Go with Paid Workers starts at US$15/month. Runtime AI and other services may be charged separately.

Prices checked 24 November 2026 AEDT. Prices are in USD and exclude tax and exchange fees. Check current limits and eligibility before spending.

## Build one useful thing

1. **Bring an idea.** Paste your existing concept into your agent, or ask for a small starting idea. Pick one thing you can check, such as a page that remembers a favourite colour.
2. **Open [Get Ready](https://composer.loftwah.com/ready#agent-start).** Copy the maintained setup handoff into your agent. Ask it to inspect the tools you already have and pick a supported recipe that fits your budget.
3. **Sign in to your accounts.** Use GitHub and Cloudflare's official pages. Complete sign-in and verification yourself. Ask the agent to show which account it will use before it changes anything.
4. **Approve the target.** Choose a new repository you control and an unused `workers.dev` address. Ask for the proposed cost before approving any paid plan, additional service or domain.
5. **Open your app.** Ask the agent for the live HTTPS address, repository and deployed revision. Open the app and try its one feature.
6. **Make one follow-up change.** Ask for an edit in the same repository, then refresh your live app to check it. Keep both accounts and the repository so you can come back later.

[Follow the step-by-step setup guide](https://composer.loftwah.com/ready/guide) if your agent needs help with the supported tools or deployment steps.

## Use fewer tokens

1. Give the agent one outcome and a concrete way to check it.
2. Use a smaller capable model for simple work and a stronger one when complexity or an actual failure warrants it.
3. Point to the relevant files and error instead of sending the whole repository or log.
4. Run focused tests, type checks and HTTP checks before asking for another model pass.
5. Keep a short handoff with decisions, relevant paths, the last verified result and the next action.
6. Start with one agent. Investigate repeated failures before retrying.
7. Use the CLI for repeatable work and the browser for sign-in and visual checks.
8. Compare time, retries and cost per verified change across models.
9. Check quotas and approve any extra usage before it can cost money.
10. Finish when the requested feature is deployed and you have checked it live.

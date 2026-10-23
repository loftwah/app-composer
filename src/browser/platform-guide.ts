/** Teaching-only policy example. No network, storage, identity or execution authority. */
function initialisePolicyExplorer() {
  const explorer = document.querySelector<HTMLElement>(
    "[data-policy-explorer]",
  );
  if (!explorer || explorer.dataset.initialised) return;
  explorer.dataset.initialised = "true";
  const selection = (name: string) =>
    explorer.querySelector<HTMLSelectElement>(`select[name="${name}"]`)?.value;
  const render = () => {
    let decision = "Allowed";
    let reason =
      "The current team member’s supported Workers update fits this example’s standing policy.";
    let next =
      "A trusted runner would recheck identity, candidate and policy before any provider effect, then verify the service independently.";
    if (selection("membership") !== "current") {
      decision = "Denied";
      reason =
        "The requester has no current authority over the owning team’s application. An approval cannot replace membership.";
      next =
        "Stop. An authorised operator must resolve access through the configured identity and Composer membership path.";
    } else if (selection("runtime") !== "workers") {
      decision = "Unsupported";
      reason =
        "This example has no qualified Kubernetes delivery path. Provider capability alone does not qualify Composer on that target.";
      next =
        "Choose a qualified target or complete the alternate runtime’s compatibility, recovery and operating evidence.";
    } else if (selection("location") === "australia") {
      decision = "Unsupported";
      reason =
        "Australian-only handling is not substantiated for this example’s complete Workers, D1, media, metadata and support paths.";
      next =
        "Keep the requirement. Assess a controlled regional design and its contracts rather than silently weakening it.";
    } else if (selection("change") === "exception") {
      decision = "Requires approval";
      reason =
        "The requested exception exceeds this example’s standing policy. Routine supported work does not need this extra decision.";
      next =
        "An authorised reviewer would accept, send back or deny the exact candidate. Changed or stale inputs require a fresh decision.";
    }
    for (const [selector, value] of [
      ["[data-decision]", decision],
      ["[data-reason]", reason],
      ["[data-next]", next],
    ]) {
      const element = explorer.querySelector(selector!);
      if (element) element.textContent = value!;
    }
  };
  explorer.addEventListener("change", render);
  render();
}
initialisePolicyExplorer();
document.addEventListener("astro:page-load", initialisePolicyExplorer);

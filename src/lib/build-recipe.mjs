// Reviewed build facts for the independent apps App Composer can hand to an
// agent. Each fact comes from that app's own repository at the pinned commit:
// its wrangler configuration, its manifest and its documented deployment path.
// Reviewed 2026-11-11. This is not a deployment engine and grants no authority;
// it is the ordered work an authorised agent must actually perform, written for
// someone who does not know what a D1 database or a service binding is.
export const recipeReviewed = "2026-11-11";

const apps = {
  guestbook: {
    name: "Here / there",
    order: 1,
    role: "provider",
    storage: [
      "a D1 database bound as DB, with that app's forward migrations applied from its migrations/ directory",
      "an R2 bucket bound as MEDIA for owner-approved photos",
    ],
    secret: "OWNER_API_TOKEN",
    wiring: [],
    verify: [
      "/api/items returns only currently approved public items",
    ],
  },
  showcase: {
    name: "Linkarooie",
    order: 2,
    role: "consumer",
    storage: [
      "a D1 database bound as DB, with that app's forward migrations applied from its migrations/ directory",
    ],
    secret: "OWNER_API_TOKEN",
    wiring: [
      "a service binding named ITEM_PROVIDER that points at the deployed Here / there Worker",
      "PROVIDER_ORIGIN set to that Worker's verified HTTPS origin, with PROVIDER_ID guestbook and PROVIDER_MOUNT /guestbook",
    ],
    verify: [
      "the public profile shows the requested curated links with the intended visibility",
    ],
  },
};

const configurationContract = {
  guestbook:
    "title, introduction, theme, layout and guestAccess through its own configuration contract",
  showcase:
    "profile fields and the curated cards through its own configuration contract",
};

function orderedIds(spec) {
  return [...spec.apps].sort(
    (a, b) => (apps[a]?.order ?? 99) - (apps[b]?.order ?? 99),
  );
}

function source(spec, id) {
  return spec.sources.find((entry) => entry.id === id);
}

// One ordered, app-specific plan. Returns an empty list for the Hello reference,
// which has its own supported configuration path in the handoff.
export function buildRecipe(spec) {
  const ids = orderedIds(spec).filter((id) => Object.hasOwn(apps, id));
  if (!ids.length) return [];
  const steps = [];
  const showcaseOnly = ids.includes("showcase") && !ids.includes("guestbook");
  if (showcaseOnly) {
    steps.push({
      actor: "human",
      title: "Choose an existing Here / there provider",
      detail:
        "This Linkarooie revision requires a Here / there service binding even for a profile with only curated links. Confirm which existing provider your agent may connect in the same Cloudflare account. If none is available, choose Guestbook + Linkarooie before provisioning. Keep the operator's provider and credentials out of this deployment.",
    });
  }
  steps.push({
    actor: "agent",
    title: "Create the owner's own copy of each app",
    detail:
      ids
        .map((id) => {
          const app = apps[id];
          const pinned = source(spec, id);
          return `${app.name} from ${pinned.repository} at ${pinned.commit}`;
        })
        .join("; ") +
      ". Clone each pinned commit into its own directory and push it to a repository the owner controls. Keep each app's own history, manifest and release boundary. If the owner wants one repository, give each app its own subdirectory with its own package file and Wrangler configuration rather than merging their source.",
  });
  steps.push({
    actor: "agent",
    title: "Verify the owner's deployment targets",
    detail:
      "Run Get Ready against the owner's selected Cloudflare account before any remote write. Replace the reviewed operator's account, Worker names, routes, storage identifiers and service destinations in each Wrangler configuration with the owner's targets. Leave unresolved bindings unset until their owned resources are verified. Set PUBLIC_ORIGIN to the app's own HTTPS origin and set PROFILE_ORIGIN to the same owned origin where the app declares it. Review the diff before creating resources, applying migrations, writing secrets or deploying.",
  });
  for (const id of ids) {
    const app = apps[id];
    steps.push({
      actor: "agent",
      title: `Provision storage for ${app.name}`,
      detail:
        "In the owner's Cloudflare account, create " +
        app.storage.join(", and ") +
        ". Replace the placeholders with the verified IDs or names of the resources created for this app before running any migrations. Keep each app's database and bucket separate.",
    });
    steps.push({
      actor: "human",
      title: `Set the owner credential for ${app.name}`,
      detail: `The owner creates a long random value for ${app.secret} and sets it only on this app's verified Worker using \`wrangler secret put ${app.secret}\`. Confirm the Worker name and account first. Keep the value out of the repository, this specification, prompts, screenshots and logs. The agent verifies that the app accepts it after deployment.`,
    });
    if (app.wiring.length)
      steps.push({
        actor: "agent",
        title: `Connect ${app.name} to the provider`,
        detail:
          "Add " +
          app.wiring.join(", and ") +
          ". Read the provider's verified HTTPS origin from its own deployment; do not guess a hostname.",
      });
    steps.push({
      actor: "agent",
      title: `Deploy ${app.name}`,
      detail: `If the release script uses a fixed hostname for source identity or sharing checks, update both checks to use this deployment's own PUBLIC_ORIGIN. Review and push the target and release changes to the owner's main. Record the upstream pin and the new owned commit separately. From the app's repository root run \`pnpm install --frozen-lockfile\` and its guarded \`pnpm deploy\`, which runs the app's checks and build. Record the Worker version and the HTTPS address you actually reached.`,
    });
  }
  steps.push({
    actor: "agent",
    title: "Apply this specification to each app",
    detail:
      ids
        .map((id) => `${apps[id].name} accepts ${configurationContract[id]}`)
        .join(". ") +
      ". Send each app only its own values. Do not post the same shared payload to both apps, and do not overwrite collections, published items or owner settings the specification does not name.",
  });
  steps.push({
    actor: "agent",
    title: "Verify the release",
    detail:
      "For each app, check that /build.json and /healthz report the exact owned commit that was deployed. Retain the upstream pin as source provenance. " +
      ids.map((id) => `For ${apps[id].name}: ${apps[id].verify.join(", ")}`).join(". ") +
      "." +
      (ids.includes("guestbook") && ids.includes("showcase")
        ? " With an approved fictional contribution, check that Linkarooie can feature it and that hiding it at the source removes it."
        : "") +
      " Then load the public pages in a browser and confirm the configuration you applied is what a visitor sees.",
  });
  steps.push({
    actor: "agent",
    title: "Report what actually happened",
    detail:
      "Return each app's repository, upstream pin, deployed owned commit, Worker version, verified HTTPS address, configuration applied and remaining blockers. Verify the live app before reporting delivery.",
  });
  return steps;
}

// The smallest set of actions that genuinely need the owner. Everything else is
// the agent's to run and check.
export function humanOnlyActions(spec) {
  const actions = orderedIds(spec)
    .filter((id) => Object.hasOwn(apps, id))
    .map((id) => `create ${apps[id].secret} for ${apps[id].name}`);
  actions.unshift(
    "sign in to Cloudflare and authorise the account the apps deploy into",
  );
  if (spec.apps.includes("showcase") && !spec.apps.includes("guestbook"))
    actions.push("confirm the existing Here / there provider Linkarooie may use");
  if (spec.deployment.mode === "new-domain")
    actions.push("buy a domain, if you choose to");
  if (spec.deployment.mode === "existing-domain")
    actions.push(
      `confirm you control ${spec.deployment.hostname} and approve the DNS change`,
    );
  actions.push("approve any destructive change");
  return actions;
}

export function recipeText(spec) {
  const steps = buildRecipe(spec);
  if (!steps.length) return "";
  return (
    "Build and deployment plan for the selected apps:\n" +
    steps
      .map((step, index) => `${index + 1}. [${step.actor}] ${step.title}. ${step.detail}`)
      .join("\n") +
    "\n\nOnly these actions need the owner: " +
    humanOnlyActions(spec).join("; ") +
    ". Run and verify everything else yourself.\n\n" +
    "The `pnpm compose` command in the App Composer repository applies settings only to the operator's already verified pair. It is not a deployment path for a new owner.\n\n"
  );
}

export { apps as recipeApps };

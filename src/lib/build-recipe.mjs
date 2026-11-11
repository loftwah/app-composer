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
      "/build.json returns the pinned commit",
      "/healthz returns the same revision",
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
      "/build.json returns the pinned commit",
      "/healthz returns the same revision",
      "an approved photo from Here / there appears as a featured item, and revoking it removes it from the public view",
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
  for (const id of ids) {
    const app = apps[id];
    steps.push({
      actor: "agent",
      title: `Provision storage for ${app.name}`,
      detail:
        "In the owner's Cloudflare account, create " +
        app.storage.join(", and ") +
        ". No app may share another app's database or bucket; that separation is what keeps the two apps independent.",
    });
    steps.push({
      actor: "human",
      title: `Set the owner credential for ${app.name}`,
      detail: `The owner creates a long random value for ${app.secret} and gives it to the agent only as a Worker secret (\`wrangler secret put ${app.secret}\`). It never belongs in the repository, this specification, a prompt, a screenshot or a log. The agent sets it and confirms the app accepts it without printing it.`,
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
      detail: `Remove the reviewed operator's custom domain and account id from that app's Wrangler configuration, set PUBLIC_ORIGIN to the owner's verified hostname, then run the app's own \`pnpm install --frozen-lockfile\`, \`pnpm check\` and \`pnpm deploy\` from its repository root. If the app's release script verifies a fixed hostname, point it at this deployment's own PUBLIC_ORIGIN first; otherwise the release refuses or checks someone else's site. Record the deployed Worker version and the HTTPS address you actually reached.`,
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
      ids.map((id) => `For ${apps[id].name}: ${apps[id].verify.join(", ")}`).join(". ") +
      ". Then load the public pages in a browser and confirm the configuration you applied is what a visitor sees.",
  });
  steps.push({
    actor: "agent",
    title: "Report what actually happened",
    detail:
      "Return each app's repository, pinned commit, deployed Worker version, verified HTTPS address, the configuration you applied and anything still blocked. A copied prompt, a passing build or an uploaded Worker is not a verified release.",
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

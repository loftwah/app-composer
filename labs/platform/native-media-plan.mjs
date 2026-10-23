// Receipt and edit validation is filesystem-only. It launches no browser, codec,
// application, provider, installer or native qualification run.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const sha = /^[a-f0-9]{64}$/;
const sourceSHA = /^[a-f0-9]{40}$/;
const identifier = /^[a-zA-Z0-9_-]{1,128}$/;
const nativeAuthors = [
  "labs/platform/native-run.mjs",
  "labs/platform/native-auth.mjs",
  "labs/platform/native-journey.mjs",
  "docs/platform/native-demo.md",
];
export const actors = ["owner", "creator-a", "creator-b", "app-user"];
export const scope =
  "LOCAL DEMO · workerd/native sessions · virtual passkeys · fictional synthetic data · public edge unqualified";
export const chapters = {
  authority: "1 · Get Ready and current authority",
  teams: "2 · Two teams and role-10 delegation",
  content: "3 · Private canvas, moderation and media",
  update: "4 · Content-preserving update and Team B control",
  boundaries: "5 · Denials and the recovery contract",
  limits: "6 · Exact limits and source receipt",
};
export const captions = {
  authority: {
    chapter: "authority",
    text: "Get Ready observes this signed-in workspace. Creator permission and current ownership permit policy setup; the observation grants no authority.",
  },
  delegation: {
    chapter: "teams",
    text: "Two teams retain different requests, stacks and app resources. Explicit editor delegation enables self-service while the member stays global role 10.",
  },
  canvas: {
    chapter: "content",
    text: "The native canvas submits fictional content through the exact app grant and named Guestbook v2 service. Its pending media remains private.",
  },
  moderation: {
    chapter: "content",
    text: "The authorised moderator approves, hides and reapproves the same postcard. Anonymous media follows 404 → 200 → 404 → 200; public contributions stay closed.",
  },
  update: {
    chapter: "update",
    text: "Team A's compatible title update retains its request, stack, resource, postcard and media. Team B is checked unchanged in this same run.",
  },
  denials: {
    chapter: "boundaries",
    text: "Cross-team access, ungranted app actions and role-10 operator actions are denied. The sensitive-data request creates no stack or app resource.",
  },
  recovery: {
    chapter: "boundaries",
    text: "Recovery contract explanation: retain the operation identity and inspect its receipt before retrying. This native run does not inject an outage or prove incident recovery.",
  },
  limits: {
    chapter: "limits",
    text: "This local run proves the recorded native path only. Production SSO, provider permissions, regional storage, full restore, retirement and the incident foundation remain unqualified.",
  },
  "authority-session": {
    chapter: "authority",
    text: "These fictional actors register and sign in through native EmDash sessions with local virtual passkeys. The harness does not insert identity or session rows. Production Access admission and physical credentials are separate gates.",
  },
  "authority-source": {
    chapter: "authority",
    text: "The run selects exact clean Composer, Guestbook and Linkarooie sources. Copied runtime source identities must match them. Guestbook's named member-service descriptor is qualified against the mounted app; a later source promotion needs its own run.",
  },
  "authority-capability": {
    chapter: "authority",
    text: "A creator who owns the selected workspace can establish policy. A creator invited as editor cannot. A global role-10 member never gains native policy configuration from an invitation or an application grant.",
  },
  "authority-observation": {
    chapter: "authority",
    text: "Get Ready reads current session, workspace and adapter configuration, then links to the protected workspace. Its dated observation neither establishes upstream provider permission nor executes a build. Changing accounts or access requires a fresh check.",
  },
  "authority-scope": {
    chapter: "authority",
    text: "The operator deliberately enables the supported Guestbook recipe, synthetic preview requests and member-only contributions. Public guest admission remains closed. This is an app-owned resource on existing infrastructure, not a newly provisioned Worker or database per team.",
  },
  "teams-invitation": {
    chapter: "teams",
    text: "The owner creates two workspaces and invites each creator as editor. Native acceptance persists each membership. The workspace selector is an explicit scope choice; a URL parameter cannot add membership or silently substitute another team.",
  },
  "teams-member": {
    chapter: "teams",
    text: "The ordinary member first receives HTTP 403 for both native and member platform routes. After a deliberate Team A editor invitation, the member can request an application through the delegated member route while global EmDash role remains 10.",
  },
  "teams-mode": {
    chapter: "teams",
    text: "Team A explicitly requests member-only contributions. Team B requests a closed visitor book. The completed records retain distinct request, stack and Guestbook resource identities. Their synthetic preview policy does not establish separate physical staging infrastructure.",
  },
  "teams-delegation": {
    chapter: "teams",
    text: "Self-service and policy administration use different protected routes. Even after editor delegation, role 10 cannot configure policy or approve requests through either route. A saved plan, profile or imported receipt cannot widen that role.",
  },
  "teams-complete": {
    chapter: "teams",
    text: "Complete means the adapter recorded the app configuration and checked the composed and application pages in this run. This isolated lab reaches those handlers through a fixed host binding; it does not qualify the public production edge.",
  },
  "content-grants": {
    chapter: "content",
    text: "Before an exact app grant, the member cannot submit. The operator grants contribute on Team A's existing Guestbook resource and separately grants moderate to its creator. Membership or a profile grant alone grants neither action.",
  },
  "content-canvas": {
    chapter: "content",
    text: "The maintained 1200 by 900 canvas supplies the PNG, short message, alias and explicit consent. Composer derives synthetic eligibility from the governed request and current resource. A browser-supplied data-class flag cannot select trusted admission.",
  },
  "content-private": {
    chapter: "content",
    text: "The named Guestbook v2 service receives the current source, exact active configuration and stable actor-scoped operation identity. The pending contribution is app-owned synthetic content. An anonymous read of its private media returns 404.",
  },
  "content-moderator": {
    chapter: "content",
    text: "The authorised creator loads the real review queue and approves the postcard. The receipt and app list confirm the pending item, not just a toast. The contributor and the other team's creator cannot use this moderation capability.",
  },
  "content-revocation": {
    chapter: "content",
    text: "Approval makes the same media readable anonymously; hiding removes that public access. Reapproval restores visibility of retained bytes with the same digest. Restoring visibility is exercised here; recovering a lost database or object store is not.",
  },
  "update-plan": {
    chapter: "update",
    text: "The requester plans a compatible update to the existing completed service. Member-only contributions stay explicit. The server evaluates the current request revision, source and standing policy instead of treating the earlier completion as continuing permission.",
  },
  "update-identity": {
    chapter: "update",
    text: "The updated Team A record retains its original request, stack and Guestbook resource. Only its compatible configuration and resulting publication advance. The edit's source and identity footer distinguishes that native run from the media renderer's later source.",
  },
  "update-content": {
    chapter: "update",
    text: "The native journey compares the complete contribution list before and after the title change. Content, moderation state and item revision remain equal. It also reads the updated public page and confirms the approved media's SHA-256 remains unchanged.",
  },
  "update-control": {
    chapter: "update",
    text: "Team B is the control: its request record is compared with the original complete record after Team A's content and title changes. Its distinct resource remains closed. This two-team check does not claim portfolio-wide isolation acceptance.",
  },
  "update-public": {
    chapter: "update",
    text: "A separate anonymous browser reads both teams' composed and app pages without native sessions. The isolated TLS bridge marker and expected application names bind those observations to this local run, not to production browser cookies or a public hostname check.",
  },
  "boundaries-scope": {
    chapter: "boundaries",
    text: "The other team's native read and write requests are denied. The contributor also cannot select Team B's resource for contribution-status lookup. The selected workspace, current membership and exact app resource remain separate checks.",
  },
  "boundaries-policy": {
    chapter: "boundaries",
    text: "A request labelled sensitive is evaluated as denied and has no stack or app resources. This demonstrates the supported refusal before allocation. It does not exercise real sensitive data; all test content and actors remain fictional.",
  },
  "boundaries-operation": {
    chapter: "boundaries",
    text: "An uncertain submission must keep its original operation identity and payload. Read-only contribution-status lookup uses current grants and the current configuration to inspect the original receipt. Do not replace an unknown operation with a new send identity.",
  },
  "boundaries-test": {
    chapter: "boundaries",
    text: "Source tests cover changed-payload conflicts, duplicate receipts, configuration drift and interrupted PNG or storage work. This chapter explains that tested contract over captured stills. It is not footage of an outage or a successful production incident response.",
  },
  "boundaries-privacy": {
    chapter: "boundaries",
    text: "Closed public guest admission remains independent of member contribution permission. App private states, source/configuration checks and moderation still apply. A guest puzzle, public page, downloaded report or media film grants no owner or member authority.",
  },
  "limits-runtime": {
    chapter: "limits",
    text: "The qualified scope is native local EmDash sessions, actual local workerd service bindings, app-owned SQLite and private object storage, and fictional synthetic content. Host-resolved TLS and fixed self-binding verification are disclosed local seams.",
  },
  "limits-source": {
    chapter: "limits",
    text: "Every caption retains the native Composer and independent app sources, both teams' identifiers and the canonical receipt hash. The renderer's own source and edit hash are separate. Matching a source hash does not establish a later deployment or permissions.",
  },
  "limits-edit": {
    chapter: "limits",
    text: "The edit manifest declares normal-speed source intervals, cuts, genuine still holds and any explicit still crop. Raw per-actor WebM and capture-time screenshot hashes must match. No missing operation is replaced by a generated success frame or an automatic padding loop.",
  },
  "limits-gates": {
    chapter: "limits",
    text: "Production SSO, fresh-person provider onboarding, Australian-only storage and vendor interoperability have no acceptance claim here. Full backup restoration, retirement and the broader incident foundation also remain outside this demonstrated product journey.",
  },
  "limits-review": {
    chapter: "limits",
    text: "The encoded H.264 MP4s, WebVTT, transcripts, chapters, posters and asset hashes travel together. Final pixel and playback review remains a separate step. Keep original native evidence private; publish only the reviewed, correctly scoped media package.",
  },
};
function requireValue(value, message) {
  if (!value) throw Error(message);
}
function keys(value, allowed, required = allowed) {
  requireValue(
    value && typeof value === "object" && !Array.isArray(value),
    "Use an object in the native edit.",
  );
  requireValue(
    Object.keys(value).every((key) => allowed.includes(key)) &&
      required.every((key) => Object.hasOwn(value, key)),
    "The native edit contains missing or unsupported fields.",
  );
}
const time = (value) =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
async function boundedFile(path, limit) {
  const info = await lstat(path);
  requireValue(
    info.isFile() &&
      !info.isSymbolicLink() &&
      info.size > 0 &&
      info.size <= limit,
    "A selected receipt or capture is missing, linked, empty or oversized.",
  );
  const bytes = await readFile(path);
  requireValue(
    bytes.length === info.size,
    "A selected capture changed during inspection.",
  );
  return bytes;
}
async function captureFile(directory, name, digest, limit) {
  requireValue(
    typeof name === "string" &&
      name === basename(name) &&
      /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(name) &&
      sha.test(digest),
    "Use a capture-time hash and a single local capture filename.",
  );
  const path = join(directory, name);
  requireValue(
    dirname(await realpath(path)) === (await realpath(directory)),
    "A capture escaped its receipt directory.",
  );
  const bytes = await boundedFile(path, limit);
  requireValue(
    sha256(bytes) === digest,
    "Capture bytes disagree with their native capture-time hash.",
  );
  return { path, name, sha256: digest, bytes: bytes.length, data: bytes };
}

export async function inspectNativeMedia(receiptPath, expectedReceiptSHA256) {
  requireValue(
    isAbsolute(receiptPath) && sha.test(expectedReceiptSHA256),
    "Select the canonical native receipt by absolute path and its independently supplied SHA-256.",
  );
  const receiptBytes = await boundedFile(receiptPath, 4 * 1024 * 1024);
  requireValue(
    sha256(receiptBytes) === expectedReceiptSHA256,
    "The selected native receipt does not match its approved hash.",
  );
  const receipt = JSON.parse(receiptBytes);
  requireValue(
    receipt.schema === "composer.platform-native/1" &&
      receipt.qualification === "passed" &&
      !receipt.failure &&
      !receipt.videoDeadlineExceeded,
    "Only a passed native run can supply final media.",
  );
  requireValue(
    ["browserClosed", "ownedRootRemoved", "pointerRemoved"].every(
      (key) => receipt.cleanup?.[key] === true,
    ) && !receipt.cleanup.error,
    "The native run must confirm browser, process-pointer and owned-root cleanup.",
  );
  requireValue(
    receipt.authentication?.nativeSessions === true &&
      receipt.authentication.virtualPasskeys === true &&
      receipt.authentication.productionAccess === false &&
      receipt.authentication.insertedIdentityOrSessionRows === false,
    "The receipt must identify the actual native session and local admission boundary.",
  );
  requireValue(
    time(receipt.startedAt) &&
      time(receipt.finishedAt) &&
      Date.parse(receipt.finishedAt) >= Date.parse(receipt.startedAt),
    "The native receipt has no valid run interval.",
  );
  const sources = {};
  for (const name of ["composer", "guestbook", "showcase"]) {
    const selected = receipt.preflight?.sources?.[name];
    requireValue(
      sourceSHA.test(selected?.head) &&
        selected.dirty === false &&
        receipt.copiedSource?.[name]?.head === selected.head,
      "Final native media requires matching clean selected and copied source identities.",
    );
    sources[name] = selected.head;
  }
  const authoredHashes = Object.fromEntries(
    nativeAuthors.map((name) => {
      const digest = receipt.preflight.authoredHashes?.[name];
      requireValue(
        sha.test(digest),
        "The canonical native source-author hashes are incomplete.",
      );
      return [name, digest];
    }),
  );
  requireValue(
    receipt.preflight.memberContract?.qualified === true &&
      receipt.preflight.memberContract.source === sources.guestbook &&
      receipt.preflight.memberContract.sourceOverride === false &&
      receipt.journey?.memberSource?.revision === sources.guestbook &&
      receipt.journey.memberSource.sourceOverride === false,
    "The actual native run must qualify its exact Guestbook member source without overrides.",
  );
  const journey = receipt.journey;
  const captureInspectionHoldMs = Object.hasOwn(
    journey,
    "captureInspectionHoldMs",
  )
    ? journey.captureInspectionHoldMs
    : 0;
  requireValue(
    typeof captureInspectionHoldMs === "number" &&
      Number.isFinite(captureInspectionHoldMs) &&
      captureInspectionHoldMs >= 0 &&
      captureInspectionHoldMs <= 5000,
    "Recorded capture inspection holds must be finite milliseconds between 0 and 5000.",
  );
  requireValue(
    Array.isArray(journey.setup) &&
      journey.setup.length >= 2 &&
      journey.setup.length <= 10 &&
      journey.setup.every(
        (entry) =>
          entry.action === "configure" &&
          entry.configurationObservationOnly === true,
      ),
    "Actual selected-workspace Get Ready observations are required.",
  );
  const teams = {};
  for (const key of ["a", "b"]) {
    const row = journey.initial?.[key];
    const resource = row?.resources?.[0]?.resource;
    requireValue(
      row?.status === "complete" &&
        [row.id, row.stackId, resource].every(
          (value) => typeof value === "string" && identifier.test(value),
        ),
      "Both actual team requests must have complete retained identities.",
    );
    const workspace = journey.workspaces?.find(
      (entry) => entry.key === key,
    )?.id;
    requireValue(
      typeof workspace === "string" && identifier.test(workspace),
      "Both actual workspace identities are required.",
    );
    teams[key] = { workspace, request: row.id, stack: row.stackId, resource };
  }
  requireValue(
    teams.a.workspace !== teams.b.workspace &&
      teams.a.request !== teams.b.request &&
      teams.a.stack !== teams.b.stack &&
      teams.a.resource !== teams.b.resource,
    "The two-team control must use distinct identities.",
  );
  requireValue(
    journey.ordinaryUser?.role === 10 &&
      [
        "nativeConfigure",
        "memberConfigure",
        "nativeReview",
        "memberReview",
      ].every((key) => journey.ordinaryUser[key]?.status === 403),
    "The native role-10 operator denial evidence is incomplete.",
  );
  requireValue(
    journey.contribution?.dataClass === "synthetic" &&
      journey.contribution.resource === teams.a.resource &&
      journey.publicAdmission?.accepts === false &&
      journey.publicAdmission.state === "closed",
    "Native synthetic authoring must retain closed public contribution admission.",
  );
  requireValue(
    JSON.stringify(
      journey.visibility?.slice(0, 4).map((entry) => entry.status),
    ) === "[404,200,404,200]",
    "The same native run must contain private/approved/hidden/reapproved media evidence.",
  );
  const updated = journey.updated;
  requireValue(
    updated?.contentPreserved === true &&
      updated.bUnchanged === true &&
      updated.a?.id === teams.a.request &&
      updated.a?.stackId === teams.a.stack &&
      updated.a?.resources?.[0]?.resource === teams.a.resource,
    "The native content-preserving update and unchanged Team B control are required.",
  );
  requireValue(
    journey.crossTeamRead?.status === 403 &&
      journey.crossTeamWrite?.status === 403 &&
      journey.policyDenied?.decision?.outcome === "denied" &&
      !journey.policyDenied.stackId &&
      journey.policyDenied.resources?.length === 0,
    "The native access and sensitive-data denials are incomplete.",
  );
  requireValue(
    receipt.capture?.status === "complete" &&
      receipt.capture.expectedActors === 4 &&
      receipt.capture.retainedActors === 4 &&
      receipt.videos?.length === 4,
    "All four continuous native actor captures are required.",
  );
  const assets = new Map();
  const directory = dirname(receiptPath);
  for (const video of receipt.videos) {
    requireValue(
      actors.includes(video.actor) &&
        ![...assets.values()].some((entry) => entry.actor === video.actor) &&
        video.continuous === true &&
        video.privateStateExported === false &&
        time(video.startedAt) &&
        Date.parse(video.startedAt) >= Date.parse(receipt.startedAt) &&
        Date.parse(video.startedAt) + video.durationSeconds * 1000 <=
          Date.parse(receipt.finishedAt) + 5000 &&
        Number.isFinite(video.durationSeconds) &&
        video.durationSeconds > 0 &&
        video.durationSeconds <= 365,
      "A native actor recording is incomplete, duplicated or outside its capture bound.",
    );
    requireValue(
      Object.entries(sources).every(
        ([name, head]) => video.source?.[name]?.head === head,
      ),
      "An actor recording names a different native source.",
    );
    const file = await captureFile(
      directory,
      video.path,
      video.sha256,
      32 * 1024 * 1024,
    );
    requireValue(
      file.name.endsWith(".webm") &&
        file.bytes === video.bytes &&
        file.data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
      "A raw actor capture lacks matching WebM identity.",
    );
    const { data: _, ...metadata } = file;
    assets.set(file.name, {
      ...metadata,
      kind: "clip",
      actor: video.actor,
      duration: video.durationSeconds,
      startedAt: video.startedAt,
    });
  }
  requireValue(
    Array.isArray(journey.captureAssets) &&
      journey.captureAssets.length >= 6 &&
      journey.captureAssets.length <= 40 &&
      journey.screenshots?.length === journey.captureAssets.length,
    "Capture-time screenshot hashes are required; legacy filename-only captures cannot supply final media.",
  );
  for (const shot of journey.captureAssets) {
    requireValue(
      [...actors, "anonymous"].includes(shot.actor) &&
        time(shot.capturedAt) &&
        Date.parse(shot.capturedAt) >= Date.parse(receipt.startedAt) &&
        Date.parse(shot.capturedAt) <= Date.parse(receipt.finishedAt) &&
        journey.screenshots.includes(shot.path) &&
        !assets.has(shot.path),
      "A screenshot lacks its native actor, capture time or unique captured filename.",
    );
    const file = await captureFile(
      directory,
      shot.path,
      shot.sha256,
      16 * 1024 * 1024,
    );
    requireValue(
      file.name.endsWith(".png") &&
        file.data
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        file.data.length >= 24,
      "Use genuine captured PNG stills.",
    );
    const width = file.data.readUInt32BE(16),
      height = file.data.readUInt32BE(20);
    requireValue(
      width > 0 && height > 0 && width <= 32768 && height <= 32768,
      "The captured PNG dimensions exceed the supported bound.",
    );
    const { data: _, ...metadata } = file;
    assets.set(file.name, {
      ...metadata,
      kind: "still",
      actor: shot.actor,
      capturedAt: shot.capturedAt,
      width,
      height,
    });
  }
  return {
    receiptSHA256: expectedReceiptSHA256,
    sources,
    teams,
    startedAt: receipt.startedAt,
    finishedAt: receipt.finishedAt,
    assets,
    authoredHashes,
    captureInspectionHoldMs,
    recordedInspectionHoldSeconds: captureInspectionHoldMs / 1000,
  };
}

export function planNativeEdit(edit, native) {
  keys(edit, ["schema", "nativeReceiptSHA256", "films"]);
  requireValue(
    edit.schema === "composer.platform-native-edit/1" &&
      edit.nativeReceiptSHA256 === native.receiptSHA256,
    "The edit must name this exact native run receipt.",
  );
  keys(edit.films, ["overview", "technical-walkthrough"]);
  const films = [];
  for (const [name, entries] of Object.entries(edit.films)) {
    requireValue(
      Array.isArray(entries) && entries.length >= 6 && entries.length <= 60,
      "Use six to sixty explicit edits per film.",
    );
    let position = 0;
    const order = [],
      ranges = new Map(),
      kinds = new Set();
    const segments = entries.map((entry) => {
      keys(
        entry,
        ["chapter", "caption", "kind", "asset", "duration", "start", "crop"],
        ["chapter", "caption", "kind", "asset", "duration"],
      );
      requireValue(
        Object.hasOwn(chapters, entry.chapter) &&
          captions[entry.caption]?.chapter === entry.chapter,
        "Use a maintained caption in its corresponding technical chapter.",
      );
      const asset = native.assets.get(entry.asset);
      requireValue(
        asset &&
          entry.kind === asset.kind &&
          Number.isFinite(entry.duration) &&
          entry.duration >= 1 &&
          entry.duration <= (entry.kind === "still" ? 30 : 60) &&
          Math.abs(entry.duration * 30 - Math.round(entry.duration * 30)) <
            0.00001,
        "An edit must select a bounded real capture at normal speed, using whole 30fps output frames.",
      );
      requireValue(
        !entry.crop || entry.kind === "still",
        "Only an explicitly declared genuine still may be cropped.",
      );
      if (entry.kind === "clip") {
        requireValue(
          Number.isFinite(entry.start) &&
            entry.start >= 0 &&
            entry.start + entry.duration <= asset.duration + 0.01,
          "A clip extends beyond its actual continuous recording.",
        );
        const previous = ranges.get(entry.asset) ?? [];
        requireValue(
          !previous.some(
            ([start, end]) =>
              entry.start < end && entry.start + entry.duration > start,
          ),
          "A film cannot replay or loop the same source clip interval.",
        );
        ranges.set(entry.asset, [
          ...previous,
          [entry.start, entry.start + entry.duration],
        ]);
      } else
        requireValue(
          entry.start === undefined,
          "A captured still has an explicit hold duration, not a video offset.",
        );
      if (entry.crop) {
        keys(entry.crop, ["x", "y", "width", "height"]);
        requireValue(
          Object.values(entry.crop).every(Number.isSafeInteger) &&
            entry.crop.x >= 0 &&
            entry.crop.y >= 0 &&
            entry.crop.width > 0 &&
            entry.crop.height > 0 &&
            entry.crop.x + entry.crop.width <= asset.width &&
            entry.crop.y + entry.crop.height <= asset.height,
          "The declared crop escapes the genuine captured still.",
        );
      }
      if (order.at(-1) !== entry.chapter) order.push(entry.chapter);
      kinds.add(entry.kind);
      const start = position;
      position += entry.duration;
      const provenance = [
        `${scope} · ${asset.actor} · ${entry.kind === "clip" ? `normal speed / source ${entry.start.toFixed(3)}–${(entry.start + entry.duration).toFixed(3)}s` : `captured still / edited hold ${entry.duration}s`} · recorded inspection ${native.recordedInspectionHoldSeconds}s/snapshot · receipt ${native.receiptSHA256}`,
        `Composer ${native.sources.composer} · Guestbook ${native.sources.guestbook} · Linkarooie ${native.sources.showcase}`,
        ...["a", "b"].map((key) => {
          const team = native.teams[key];
          return `Team ${key.toUpperCase()} · workspace ${team.workspace} · request ${team.request} · stack ${team.stack} · resource ${team.resource}`;
        }),
      ];
      return {
        ...entry,
        start,
        sourceStart: entry.kind === "clip" ? entry.start : null,
        end: position,
        actor: asset.actor,
        sourceSHA256: asset.sha256,
        body: captions[entry.caption].text,
        heading: chapters[entry.chapter],
        provenance,
      };
    });
    requireValue(
      JSON.stringify(order) === JSON.stringify(Object.keys(chapters)),
      "Both films must cover all six chapters in order, without invented replacement chapters.",
    );
    requireValue(
      kinds.has("clip") && kinds.has("still"),
      "Each film must use actual continuous footage and genuine captured stills.",
    );
    if (name === "technical-walkthrough") {
      for (const chapter of Object.keys(chapters)) {
        const explanations = segments.filter(
          (entry) => entry.chapter === chapter,
        );
        requireValue(
          explanations.every((entry) => entry.caption.includes("-")) &&
            new Set(explanations.map((entry) => entry.caption)).size >= 3,
          "Each technical chapter needs at least three distinct maintained technical explanations; duration alone is insufficient.",
        );
      }
      requireValue(
        actors.every((actor) =>
          segments.some(
            (entry) => entry.kind === "clip" && entry.actor === actor,
          ),
        ) &&
          segments
            .filter((entry) => entry.kind === "clip")
            .reduce((seconds, entry) => seconds + entry.duration, 0) >= 60,
        "The technical film must retain at least a minute of normal-speed footage across all four actual actor recordings.",
      );
    }
    const [minimum, maximum] = name === "overview" ? [60, 90] : [300, 480];
    requireValue(
      position >= minimum && position <= maximum,
      `${name} needs an explicit ${minimum}–${maximum} second edit; unavailable flows are never padded automatically.`,
    );
    films.push({
      name,
      duration: position,
      target: name === "overview" ? 75 : 360,
      segments,
    });
  }
  return {
    schema: "composer.platform-native-media-plan/1",
    nativeReceiptSHA256: native.receiptSHA256,
    sources: native.sources,
    teams: native.teams,
    qualification: scope,
    captureInspectionHoldMs: native.captureInspectionHoldMs,
    recordedInspectionHoldSeconds: native.recordedInspectionHoldSeconds,
    films,
  };
}

export async function loadNativeEdit(path, native) {
  requireValue(
    isAbsolute(path),
    "Select the reviewed native edit by absolute path.",
  );
  const bytes = await boundedFile(path, 128 * 1024);
  return {
    plan: planNativeEdit(JSON.parse(bytes), native),
    editSHA256: sha256(bytes),
  };
}

export function mediaOutput(workspace, selected, receiptSHA256) {
  const output = resolve(
    selected ??
      join(
        workspace,
        "output/platform/native-media-" + receiptSHA256.slice(0, 12),
      ),
  );
  const path = relative(join(workspace, "output"), output);
  assert.ok(
    path && !path.startsWith("..") && !isAbsolute(path),
    "Media output must be a new directory inside this worktree's ignored output.",
  );
  return output;
}

import test from "node:test";
import assert from "node:assert/strict";
import { sqliteD1, migration } from "./helpers/stacks-sqlite.mjs";
import {
  createStack,
  publishStack,
  saveStack,
  unpublishStack,
  workspaceForUser,
} from "../src/lib/stacks.mjs";
import {
  buildShareCalendarIcs,
  calendarExportItems,
  canonicalInstant,
  captionProblem,
  captionUsage,
  isSafeShareLink,
  itemApprovalAndDelivery,
  localTimeLabel,
  melbourneLocalInstant,
  upcomingQueueSlots,
  primaryCaptionProblem,
  SHARE_CHANNELS,
  SHARE_STATES,
  SHARE_QUEUE_PRESET_MAX,
  shareCalendarCommand,
  shareCalendarReadInput,
  shareCalendarSnapshot,
  shareQueuePresetsReplySchema,
  shareListFilterForItem,
  shareListItemFilters,
  hasPublishedBlueskyRevision,
} from "../src/lib/share-calendar.ts";
import {
  approvalPackageForItem,
  sharePackageFilename,
  sharePackageJson,
  sharePackageMarkdown,
  sharePackagePlainText,
  SHARE_PACKAGE_NOT_RECORDED,
  SHARE_PACKAGE_POSTING_STATEMENT,
} from "../src/lib/share-package.ts";
import { manageShareCalendar } from "../src/lib/share-calendar-admin.ts";

const origin = "https://composer.loftwah.com";
const schema = [
  "0003_stacks.sql",
  "0004_stack_publications.sql",
  "0031_share_calendar.sql",
  "0032_share_calendar_packages.sql",
  "0034_share_approvals.sql",
  "0035_bluesky_deliveries.sql",
  "0037_portfolio_no_stack.sql",
  "0039_share_x_export_caption.sql",
  "0038_queue_presets.sql",
]
  .map(migration)
  .join("\n");
const owner = { id: "fictional-calendar-owner", role: 20 };
const other = { id: "fictional-calendar-other", role: 20 };

test("share calendar list filter classifies only genuine published deliveries and attention", () => {
  const item = (over = {}) => ({
    id: "fictional-item",
    sourceCurrent: true,
    state: "scheduled",
    ...over,
  });
  const snapshot = (states) => ({
    approvals: [{ itemId: "fictional-item", approvalRevision: 2 }],
    deliveries: states.map((state, index) => ({
      itemId: "fictional-item",
      approvalRevision: index === 0 ? 2 : 3,
      state,
    })),
  });
  const classify = (states, over) =>
    shareListFilterForItem(snapshot(states), item(over));

  assert.equal(classify([], {}), null, "a scheduled item has no receipt");
  assert.equal(
    classify([], { state: "shared" }),
    null,
    "a local export is never published",
  );
  assert.equal(classify(["published"]), "published");
  assert.equal(
    classify(["approved", "published"]),
    null,
    "a receipt from another approval revision cannot mark this item published",
  );
  assert.equal(classify(["unknown"]), "attention");
  assert.equal(classify(["failed"]), "attention");
  assert.equal(classify(["needs_auth"]), "attention");
  assert.equal(classify(["sending"]), null);
  assert.equal(classify(["approved"]), null);
  assert.equal(classify(["cancelled"]), null);
  assert.equal(
    classify([], { sourceCurrent: false }),
    "attention",
    "a stale source without a published receipt needs attention",
  );
  assert.equal(classify(["failed"], { sourceCurrent: false }), "attention");
  assert.equal(
    classify(["published"], { sourceCurrent: false }),
    "published",
    "a published receipt clears a stale source",
  );
  assert.equal(
    shareListFilterForItem(
      { approvals: [], deliveries: [] },
      item({ sourceCurrent: false }),
    ),
    "attention",
    "a stale item without an approval needs attention",
  );
});

test("the list filters use local state for drafts and scheduled while keeping delivery views", () => {
  const item = (over = {}) => ({
    id: "fictional-item",
    sourceCurrent: true,
    state: "draft",
    ...over,
  });
  const snapshot = (states) => ({
    approvals: [{ itemId: "fictional-item", approvalRevision: 2 }],
    deliveries: states.map((state, index) => ({
      itemId: "fictional-item",
      approvalRevision: index === 0 ? 2 : 3,
      state,
    })),
  });
  const empty = { approvals: [], deliveries: [] };

  assert.deepEqual(shareListItemFilters(empty, item()), ["all", "drafts"]);
  assert.deepEqual(
    shareListItemFilters(empty, item({ state: "scheduled" })),
    ["all", "scheduled"],
    "Scheduled is the local calendar state, not a job or delivery claim",
  );
  assert.deepEqual(shareListItemFilters(empty, item({ state: "shared" })), [
    "all",
  ]);
  assert.deepEqual(
    shareListItemFilters(empty, item({ sourceCurrent: false })),
    ["all", "drafts", "attention"],
    "a stale item still appears in its local Drafts view",
  );
  assert.deepEqual(
    shareListItemFilters(snapshot(["failed"]), item({ state: "scheduled" })),
    ["all", "scheduled", "attention"],
    "an error item also appears in Scheduled when its local state matches",
  );
  assert.deepEqual(
    shareListItemFilters(snapshot(["published"]), item({ state: "scheduled" })),
    ["all", "scheduled", "published"],
    "a published receipt does not hide the item from its local calendar view",
  );
  assert.deepEqual(shareListItemFilters(snapshot(["published"]), item()), [
    "all",
    "drafts",
    "published",
  ]);
});

test("only the exact item and approval revision can display a published badge", () => {
  const item = { id: "fictional-item", revision: 1 };
  const approval = { itemId: item.id, draftRevision: 1, approvalRevision: 2 };
  const receipt = {
    itemId: item.id,
    approvalRevision: 2,
    state: "published",
    permalink: "https://bsky.app/profile/example.test/post/receipt",
  };
  assert.equal(hasPublishedBlueskyRevision(item, approval, receipt), true);

  for (const state of ["approved", "sending", "failed", "unknown", "cancelled", "needs_auth"]) {
    assert.equal(hasPublishedBlueskyRevision(item, approval, { ...receipt, state }), false);
  }
  assert.equal(hasPublishedBlueskyRevision(item, approval, null), false);
  assert.equal(hasPublishedBlueskyRevision(item, approval, { ...receipt, permalink: null }), false);
  assert.equal(hasPublishedBlueskyRevision({ ...item, revision: 2 }, approval, receipt), false);
  assert.equal(hasPublishedBlueskyRevision(item, { ...approval, approvalRevision: 3 }, receipt), false);
  assert.equal(hasPublishedBlueskyRevision(item, approval, { ...receipt, itemId: "sibling" }), false);

  const resolved = itemApprovalAndDelivery(
    { approvals: [approval], deliveries: [{ ...receipt, approvalRevision: 0 }] },
    item,
  );
  assert.equal(hasPublishedBlueskyRevision(item, resolved.approval, resolved.delivery), false);
});

function sample(name, description = "A published stack for the calendar.") {
  return {
    version: 1,
    name,
    description,
    theme: "midnight",
    instances: [
      {
        id: "fictional-calendar-instance",
        app: "hello",
        label: "Hello World",
      },
    ],
  };
}

async function seeded(db, user = owner, name = "Calendar example") {
  const workspace = await workspaceForUser(db, user);
  const draft = await createStack(db, workspace.id, name);
  const saved = await saveStack(
    db,
    workspace.id,
    draft.id,
    sample(name),
    draft.revision,
  );
  const published = await publishStack(
    db,
    workspace.id,
    saved.id,
    saved.revision,
  );
  return { workspace, stack: published };
}

function input(db, user, value, method = "POST", workspace) {
  const read = method === "GET";
  return manageShareCalendar(
    {
      user,
      input: { ...value, ...(workspace ? { workspace } : {}) },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/" +
          (read ? "shareCalendarRead" : "shareCalendarWrite"),
        {
          method,
          headers: read
            ? {}
            : {
                Origin: origin,
                "X-EmDash-Request": "1",
                "Content-Type": "application/json",
              },
        },
      ),
    },
    { DB: db, PUBLIC_ORIGIN: origin },
  );
}

const read = (db, user = owner, workspace) =>
  input(db, user, { action: "list" }, "GET", workspace);
const write = (db, user, value, workspace) =>
  input(db, user, value, "POST", workspace);

function unescapeText(value) {
  let output = "";
  for (let index = 0; index < value.length; index++) {
    if (value[index] !== "\\") {
      output += value[index];
      continue;
    }
    const next = value[++index];
    output += next === "n" || next === "N" ? "\n" : next;
  }
  return output;
}

function valueColon(line) {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    else if (line[index] === ":" && !quoted) return index;
  }
  return -1;
}

// Unpack RFC 5545 the way a client does: check CRLF, unfold before parsing,
// then unescape TEXT. A physical line is also decoded as strict UTF-8, which
// fails if a fold split a multi-byte character.
function parseCalendar(source) {
  assert.ok(source.endsWith("\r\n"), "the calendar ends with CRLF");
  assert.ok(!/(?<!\r)\n/.test(source), "every newline is CRLF");
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const physical = source.slice(0, -2).split("\r\n");
  for (const line of physical) {
    assert.ok(line.length > 0, "no empty physical lines");
    assert.ok(
      encoder.encode(line).length <= 75,
      "physical line is at most 75 octets: " + line.slice(0, 20),
    );
    assert.doesNotThrow(
      () => decoder.decode(encoder.encode(line)),
      "a physical line is complete UTF-8: " + line.slice(0, 20),
    );
  }
  const logical = [];
  for (const line of physical) {
    if (line.startsWith(" ")) {
      assert.ok(logical.length > 0, "a continuation follows a line");
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }
  const root = { name: "ROOT", properties: [], components: [] };
  const stack = [root];
  for (const line of logical) {
    const colon = valueColon(line);
    assert.ok(colon > 0, "a content line has a value colon: " + line);
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [rawName, ...params] = head.split(";");
    const name = rawName.toUpperCase();
    if (name === "BEGIN") {
      const component = { name: value, properties: [], components: [] };
      stack[stack.length - 1].components.push(component);
      stack.push(component);
      continue;
    }
    if (name === "END") {
      assert.equal(stack.pop().name, value, "END matches BEGIN");
      continue;
    }
    assert.ok(stack.length > 1, "a property belongs to a component");
    stack[stack.length - 1].properties.push({ name, params, value });
  }
  assert.equal(stack.length, 1, "every component closes");
  assert.equal(root.components.length, 1, "one top-level calendar");
  const calendar = root.components[0];
  assert.equal(calendar.name, "VCALENDAR");
  return {
    calendar,
    events: calendar.components.filter(
      (component) => component.name === "VEVENT",
    ),
  };
}

function eventProperty(event, name) {
  const matches = event.properties.filter((property) => property.name === name);
  assert.equal(matches.length, 1, name + " appears once per event");
  return matches[0];
}

// Compatibility view for the single-event assertions above.
function parseIcs(source) {
  const parsed = parseCalendar(source);
  assert.equal(parsed.events.length, 1, "one event");
  const properties = new Map();
  for (const property of [
    ...parsed.calendar.properties,
    ...parsed.events[0].properties,
  ])
    properties.set(property.name, property.value);
  return {
    physical: source.slice(0, -2).split("\r\n"),
    unfolded: [],
    properties,
  };
}

function icsInstant(value) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  assert.ok(match, "UTC DATE-TIME: " + value);
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    ),
  ).toISOString();
}

function calendarItem(overrides) {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    stack: "fictional-calendar-stack",
    stackName: "Calendar example",
    stackSlug: "calendar-example",
    publication: 1,
    sourceCurrent: true,
    channel: "instagram",
    destination: "",
    caption: "A caption",
    variants: [],
    link: "",
    scheduledAt: null,
    state: "draft",
    sharedAt: null,
    revision: 1,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

test("the .ics export is valid VCALENDAR with CRLF, folding and escaped TEXT", () => {
  const caption =
    "Line one\nLine two; commas, a backslash \\ and a long sentence that needs folding across physical lines. " +
    "Emoji keep their bytes together: 🧑‍🚀🚀 and more words to force another fold.";
  const ics = buildShareCalendarIcs(
    [
      {
        id: "9f1c0d9e-7f34-4e27-9d67-2a3f3f0b1c22",
        revision: 3,
        channel: "instagram",
        caption,
        link: "https://composer.loftwah.com/s/calendar-example?utm_source=calendar",
        scheduledAt: "2026-11-20T23:30:00.000Z",
        stackName: "Calendar; example, with commas",
      },
    ],
    {
      now: new Date("2026-11-16T05:00:00.000Z"),
      calendarName: "Share calendar · Fictional workspace",
    },
  );
  const parsed = parseIcs(ics);
  assert.equal(parsed.properties.get("DTSTART"), "20261120T233000Z");
  assert.equal(parsed.properties.get("DTEND"), "20261121T000000Z");
  assert.equal(parsed.properties.get("DTSTAMP"), "20261116T050000Z");
  assert.equal(
    parsed.properties.get("UID"),
    "9f1c0d9e-7f34-4e27-9d67-2a3f3f0b1c22@composer.loftwah.com",
  );
  assert.equal(
    unescapeText(parsed.properties.get("SUMMARY")),
    "Instagram · Calendar; example, with commas",
  );
  const description = unescapeText(parsed.properties.get("DESCRIPTION"));
  assert.ok(description.startsWith(caption), "caption survives escaping");
  assert.match(description, /Link: https:\/\/composer\.loftwah\.com/);
  assert.match(description, /Composer never posts automatically\./);
  assert.equal(
    parsed.properties.get("URL"),
    "https://composer.loftwah.com/s/calendar-example?utm_source=calendar",
  );
  assert.equal(parsed.properties.get("SEQUENCE"), "2");
});

test("the state vocabulary stays local and the command rejects invented states", () => {
  assert.deepEqual(
    SHARE_STATES.map((state) => state.id),
    ["draft", "scheduled", "shared"],
  );
  assert.deepEqual(
    SHARE_CHANNELS.map((channel) => channel.id),
    ["instagram", "facebook", "linkedin", "bluesky", "other"],
  );
  for (const state of SHARE_STATES)
    assert.doesNotMatch(
      state.label + " " + state.note,
      /posted|published to|live on/i,
    );
  const base = {
    action: "save",
    item: "9f1c0d9e-7f34-4e27-9d67-2a3f3f0b1c22",
    expectedRevision: 1,
    channel: "instagram",
    caption: "A real caption",
    link: "https://composer.loftwah.com/s/example",
    scheduledAt: "2026-11-20T09:30:00.000Z",
  };
  assert.equal(shareCalendarCommand.safeParse(base).success, true);
  assert.equal(
    shareCalendarCommand.safeParse({ ...base, state: "posted" }).success,
    false,
  );
  assert.equal(
    shareCalendarCommand.safeParse({ ...base, channel: "threads" }).success,
    false,
  );
  assert.equal(
    shareCalendarCommand.safeParse({
      ...base,
      link: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    shareCalendarCommand.safeParse({ ...base, caption: "   " }).success,
    false,
  );
  assert.equal(
    shareCalendarCommand.safeParse({
      ...base,
      scheduledAt: "2026-11-20T09:30:00",
    }).success,
    false,
  );
  assert.equal(
    shareCalendarCommand.safeParse({
      ...base,
      link: "https://user:secret@example.com/post",
    }).success,
    false,
  );
  assert.equal(isSafeShareLink("https://example.com/a?b=c"), true);
  assert.equal(isSafeShareLink("http://example.com"), true);
  assert.equal(isSafeShareLink("mailto:owner@example.com"), false);
  assert.equal(
    canonicalInstant("2026-11-20T20:30:00+11:00"),
    "2026-11-20T09:30:00.000Z",
  );
});

test("the calendar is private per workspace and writes need the save capability", async () => {
  const db = sqliteD1({ schema });
  try {
    const first = await seeded(db, owner, "Owner calendar");
    const second = await seeded(db, other, "Other calendar");
    assert.equal(
      (await read(db, null)).ok,
      false,
      "signed-out read is refused",
    );
    const own = await read(db, owner);
    assert.equal(own.ok, true);
    assert.deepEqual(
      own.sources.map((source) => source.id),
      [first.stack.id],
      "only this workspace's published stack is offered",
    );
    assert.equal(own.sources[0].imagePath.startsWith("/s/"), true);
    assert.equal(
      (await read(db, owner, second.workspace.id)).code,
      "FORBIDDEN",
      "another workspace id is only a selector",
    );
    assert.equal(
      (
        await manageShareCalendar(
          {
            user: owner,
            input: { action: "list" },
            request: new Request(
              origin +
                "/_emdash/api/plugins/composer-stacks/shareCalendarWrite",
              {
                method: "POST",
                headers: {
                  Origin: "https://evil.example",
                  "X-EmDash-Request": "1",
                },
              },
            ),
          },
          { DB: db, PUBLIC_ORIGIN: origin },
        )
      ).code,
      "FORBIDDEN",
    );
    const created = await write(db, owner, {
      action: "create",
      stack: first.stack.id,
      channel: "linkedin",
      caption: "A real published caption",
      link: first.stack.slug ? origin + "/s/" + first.stack.slug : "",
      scheduledAt: "2026-11-20T09:30:00.000Z",
    });
    assert.equal(created.ok, true);
    assert.equal(created.items.length, 1);
    assert.equal(created.items[0].sourceCurrent, true);
    assert.equal(created.items[0].state, "scheduled");
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM creator_share_calendar_items")
          .first()
      ).count,
      1,
    );
    await db
      .prepare(
        "INSERT INTO creator_members (workspace_id,user_id,role) VALUES (?,?,?)",
      )
      .bind(first.workspace.id, "fictional-calendar-viewer", "viewer")
      .run();
    const viewer = { id: "fictional-calendar-viewer", role: 20 };
    assert.equal((await read(db, viewer)).ok, true, "viewer may read");
    assert.equal(
      (
        await write(db, viewer, {
          action: "create",
          stack: first.stack.id,
          channel: "instagram",
          caption: "A viewer cannot save",
          link: "",
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await write(
          db,
          other,
          {
            action: "create",
            stack: first.stack.id,
            channel: "instagram",
            caption: "Another workspace cannot write here",
            link: "",
          },
          first.workspace.id,
        )
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await write(db, owner, {
          action: "create",
          stack: first.stack.id,
          channel: "instagram",
          caption: "Bad link",
          link: "javascript:alert(1)",
        })
      ).code,
      "INVALID",
    );
  } finally {
    db.cleanup();
  }
});

test("scheduled, shared and stale source states are recorded honestly", async () => {
  const db = sqliteD1({ schema });
  try {
    const { workspace, stack } = await seeded(db);
    const created = await write(db, owner, {
      action: "create",
      stack: stack.id,
      channel: "instagram",
      caption: "Copy this caption; do not invent a post.",
      link: origin + "/s/" + stack.slug,
      scheduledAt: "2026-11-20T09:30:00.000Z",
    });
    assert.equal(created.ok, true);
    const item = created.items[0];
    assert.equal(item.state, "scheduled");
    const calendar = buildShareCalendarIcs(
      created.items
        .filter((entry) => entry.state === "scheduled" && entry.sourceCurrent)
        .map((entry) => ({
          id: entry.id,
          revision: entry.revision,
          channel: entry.channel,
          caption: entry.caption,
          link: entry.link,
          scheduledAt: entry.scheduledAt,
          stackName: entry.stackName,
        })),
      { now: new Date("2026-11-16T05:00:00.000Z") },
    );
    assert.equal(
      parseIcs(calendar).properties.get("DTSTART"),
      "20261120T093000Z",
    );

    const shared = await write(db, owner, {
      action: "shared",
      item: item.id,
      expectedRevision: item.revision,
    });
    assert.equal(shared.ok, true);
    assert.equal(shared.items[0].state, "shared");
    assert.match(shared.items[0].sharedAt, /^2026-/);
    const exported = buildShareCalendarIcs(
      shared.items
        .filter((entry) => entry.state === "scheduled" && entry.sourceCurrent)
        .map((entry) => ({
          id: entry.id,
          revision: entry.revision,
          channel: entry.channel,
          caption: entry.caption,
          link: entry.link,
          scheduledAt: entry.scheduledAt,
          stackName: entry.stackName,
        })),
    );
    assert.ok(exported.endsWith("END:VCALENDAR\r\n"));
    assert.equal(
      exported.includes("BEGIN:VEVENT"),
      false,
      "a locally shared item is not an upcoming calendar event",
    );
    const reopened = await write(db, owner, {
      action: "reopen",
      item: item.id,
      expectedRevision: shared.items[0].revision,
    });
    assert.equal(reopened.items[0].state, "scheduled");
    assert.equal(reopened.items[0].sharedAt, null);

    await unpublishStack(db, workspace.id, stack.id, stack.revision);
    const stale = await read(db, owner);
    assert.equal(stale.items[0].sourceCurrent, false);
    assert.equal(
      (
        await write(db, owner, {
          action: "shared",
          item: item.id,
          expectedRevision: stale.items[0].revision,
        })
      ).code,
      "SOURCE_STALE",
    );
    assert.equal(
      (
        await write(db, owner, {
          action: "save",
          item: item.id,
          expectedRevision: stale.items[0].revision,
          channel: "instagram",
          caption: "An edit that must wait for a current source.",
          link: "",
        })
      ).code,
      "SOURCE_STALE",
      "editing a stale item is refused too",
    );
    assert.equal(
      (
        await write(db, owner, {
          action: "refresh",
          item: item.id,
          expectedRevision: stale.items[0].revision,
        })
      ).code,
      "NOT_FOUND",
    );
    const deleted = await write(db, owner, {
      action: "delete",
      item: item.id,
      expectedRevision: stale.items[0].revision,
    });
    assert.equal(deleted.ok, true);
    assert.equal(deleted.items.length, 0);
  } finally {
    db.cleanup();
  }
});

test("channel limits use real character and grapheme counts", () => {
  assert.equal(captionUsage("instagram", "a".repeat(2200)).withinLimit, true);
  assert.equal(captionUsage("instagram", "a".repeat(2201)).withinLimit, false);
  assert.equal(captionUsage("linkedin", "a".repeat(3000)).withinLimit, true);
  assert.equal(captionUsage("linkedin", "a".repeat(3001)).withinLimit, false);
  assert.match(captionUsage("linkedin", "").behaviour, /truncat/i);
  const astronaut = "🧑‍🚀";
  assert.equal(
    Array.from(astronaut).length,
    3,
    "the emoji is three code points",
  );
  assert.equal(
    captionUsage("bluesky", astronaut.repeat(300)).count,
    300,
    "Bluesky counts 300 graphemes, not 900 code points",
  );
  assert.equal(
    captionUsage("bluesky", astronaut.repeat(300)).withinLimit,
    true,
  );
  assert.equal(
    captionUsage("bluesky", astronaut.repeat(301)).withinLimit,
    false,
  );
  assert.equal(
    primaryCaptionProblem("facebook", "a".repeat(2201)),
    "The main caption is limited to 2200 characters; this caption has 2201.",
  );
  assert.match(captionProblem("instagram", "a".repeat(2201)), /2200/);
  assert.equal(captionProblem("instagram", "a".repeat(2200)), null);
  assert.match(
    captionProblem("instagram", "🚀".repeat(1800)),
    /UTF-8 bytes/,
    "a caption under the channel limit still has to fit one save request",
  );
  const command = {
    action: "variant",
    item: "9f1c0d9e-7f34-4e27-9d67-2a3f3f0b1c22",
    expectedRevision: 1,
    channel: "bluesky",
    destination: "MP profile",
    caption: "a".repeat(300),
  };
  assert.equal(shareCalendarCommand.safeParse(command).success, true);
  assert.equal(
    shareCalendarCommand.safeParse({ ...command, caption: null }).success,
    true,
  );
  assert.equal(
    shareCalendarCommand.safeParse({ ...command, channel: "threads" }).success,
    false,
  );
  assert.equal(
    shareCalendarCommand.safeParse({
      ...command,
      destination: "x".repeat(121),
    }).success,
    false,
  );
});

test("per-channel drafts persist, replace and delete exact text", async () => {
  const db = sqliteD1({ schema });
  try {
    const { stack } = await seeded(db, owner, "Channel drafts");
    const created = await write(db, owner, {
      action: "create",
      stack: stack.id,
      channel: "instagram",
      destination: "MP personal Instagram",
      caption: "Main caption\nwith a second line",
      link: origin + "/s/" + stack.slug,
      scheduledAt: "2026-11-20T09:30:00.000Z",
    });
    assert.equal(created.ok, true);
    const id = created.changed;
    assert.ok(id);
    let item = created.items.find((entry) => entry.id === id);
    assert.ok(item);
    assert.equal(item.destination, "MP personal Instagram");
    assert.deepEqual(item.variants, []);
    assert.equal(item.state, "scheduled");

    const longCaption =
      "Review this exact draft:\n\n````\nconst x = 1;\n````\n\nNo post is sent.";
    const linkedin = await write(db, owner, {
      action: "variant",
      item: id,
      expectedRevision: item.revision,
      channel: "linkedin",
      destination: "Acme company page",
      caption: "L".repeat(3000),
    });
    assert.equal(linkedin.ok, true);
    item = linkedin.items.find((entry) => entry.id === id);
    assert.ok(item);
    assert.equal(item.variants.length, 1);
    assert.equal(item.variants[0].channel, "linkedin");
    assert.equal(item.variants[0].destination, "Acme company page");
    assert.equal(item.variants[0].caption, "L".repeat(3000));
    assert.equal(item.variants[0].caption.length, 3000);
    assert.equal(linkedin.changed, id);

    const astronaut = "🧑‍🚀";
    const bluesky = await write(db, owner, {
      action: "variant",
      item: id,
      expectedRevision: item.revision,
      channel: "bluesky",
      destination: "",
      caption: astronaut.repeat(300),
    });
    assert.equal(bluesky.ok, true);
    item = bluesky.items.find((entry) => entry.id === id);
    assert.ok(item);
    assert.equal(item.variants.length, 2);
    assert.equal(
      item.variants.find((variant) => variant.channel === "bluesky").caption,
      astronaut.repeat(300),
    );

    const tooLong = await write(db, owner, {
      action: "variant",
      item: id,
      expectedRevision: item.revision,
      channel: "linkedin",
      destination: "Acme company page",
      caption: "L".repeat(3001),
    });
    assert.equal(tooLong.code, "INVALID");
    assert.match(tooLong.message, /3000/);

    const tooManyGraphemes = await write(db, owner, {
      action: "variant",
      item: id,
      expectedRevision: item.revision,
      channel: "bluesky",
      destination: "",
      caption: astronaut.repeat(301),
    });
    assert.equal(tooManyGraphemes.code, "INVALID");
    assert.match(tooManyGraphemes.message, /300 graphemes/);

    const tooManyBytes = await write(db, owner, {
      action: "variant",
      item: id,
      expectedRevision: item.revision,
      channel: "facebook",
      destination: "",
      caption: "🚀".repeat(1800),
    });
    assert.equal(tooManyBytes.code, "INVALID");
    assert.match(tooManyBytes.message, /UTF-8 bytes/);

    const duplicateMain = await write(db, owner, {
      action: "variant",
      item: id,
      expectedRevision: item.revision,
      channel: "instagram",
      destination: "",
      caption: "The main caption already occupies this channel.",
    });
    assert.equal(duplicateMain.code, "INVALID");
    assert.match(duplicateMain.message, /main caption/i);

    const replaced = await write(db, owner, {
      action: "variant",
      item: id,
      expectedRevision: item.revision,
      channel: "linkedin",
      destination: "Acme company page",
      caption: longCaption,
    });
    assert.equal(replaced.ok, true);
    item = replaced.items.find((entry) => entry.id === id);
    assert.ok(item);
    assert.equal(item.variants.length, 2, "an upsert does not duplicate a row");
    assert.equal(
      item.variants.find((variant) => variant.channel === "linkedin").caption,
      longCaption,
    );

    const removed = await write(db, owner, {
      action: "variant",
      item: id,
      expectedRevision: item.revision,
      channel: "bluesky",
      caption: null,
    });
    assert.equal(removed.ok, true);
    item = removed.items.find((entry) => entry.id === id);
    assert.ok(item);
    assert.equal(item.variants.length, 1);
    assert.equal(item.variants[0].channel, "linkedin");

    const listed = await read(db, owner);
    const persisted = listed.items.find((entry) => entry.id === id);
    assert.ok(persisted);
    assert.equal(persisted.destination, "MP personal Instagram");
    assert.equal(persisted.variants[0].caption, longCaption);
    assert.equal(persisted.variants[0].destination, "Acme company page");
    assert.equal(persisted.state, "scheduled");
  } finally {
    db.cleanup();
  }
});

test("the additive migration keeps a legacy caption as the default destination", async () => {
  const legacySchema = [
    "0003_stacks.sql",
    "0004_stack_publications.sql",
    "0031_share_calendar.sql",
  ]
    .map(migration)
    .join("\n");
  const db = sqliteD1({ schema: legacySchema });
  try {
    const { workspace, stack } = await seeded(db, owner, "Legacy calendar");
    const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const at = "2026-11-02T01:02:03.000Z";
    await db
      .prepare(
        `INSERT INTO creator_share_calendar_items
         (id,workspace_id,stack_id,stack_revision,channel,caption,link,scheduled_at,state,shared_at,created_by,updated_by,revision,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?,?,?,?)`,
      )
      .bind(
        id,
        workspace.id,
        stack.id,
        stack.revision,
        "linkedin",
        "Legacy caption; with comma",
        origin + "/s/" + stack.slug,
        "2026-11-20T09:30:00.000Z",
        "scheduled",
        owner.id,
        owner.id,
        4,
        at,
        at,
      )
      .run();
    db.migrate(migration("0032_share_calendar_packages.sql"));
    db.migrate(migration("0034_share_approvals.sql"));
    db.migrate(migration("0035_bluesky_deliveries.sql"));
    db.migrate(migration("0037_portfolio_no_stack.sql"));
    db.migrate(migration("0039_share_x_export_caption.sql"));
    const listed = await read(db, owner);
    assert.equal(listed.ok, true);
    assert.equal(listed.items.length, 1);
    const item = listed.items[0];
    assert.equal(item.id, id, "the existing id is preserved");
    assert.equal(item.caption, "Legacy caption; with comma");
    assert.equal(item.revision, 4);
    assert.equal(item.destination, "", "an old row has no guessed destination");
    assert.deepEqual(item.variants, []);
    const frozen = JSON.stringify(item);
    const pkg = approvalPackageForItem(listed, item);
    assert.equal(
      JSON.stringify(item),
      frozen,
      "building a package changes no saved value",
    );
    assert.equal(pkg.destinations.length, 1);
    assert.equal(pkg.destinations[0].caption, "Legacy caption; with comma");
    assert.equal(pkg.destinations[0].exactDestination, null);
    assert.equal(
      pkg.destinations[0].exactDestinationLabel,
      SHARE_PACKAGE_NOT_RECORDED,
    );
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM creator_share_calendar_items")
          .first()
      ).count,
      1,
    );
  } finally {
    db.cleanup();
  }
});

test("the main save stays compatible and keeps channel drafts", async () => {
  const db = sqliteD1({ schema });
  try {
    const { stack } = await seeded(db, owner, "Compatible save");
    const created = await write(db, owner, {
      action: "create",
      stack: stack.id,
      channel: "linkedin",
      destination: "MP personal LinkedIn",
      caption: "First main caption",
      link: origin + "/s/" + stack.slug,
    });
    let item = created.items.find((entry) => entry.id === created.changed);
    assert.ok(item);
    const added = await write(db, owner, {
      action: "variant",
      item: item.id,
      expectedRevision: item.revision,
      channel: "bluesky",
      destination: "MP Bluesky",
      caption: "A Bluesky draft",
    });
    item = added.items.find((entry) => entry.id === created.changed);
    assert.ok(item);
    const saved = await write(db, owner, {
      action: "save",
      item: item.id,
      expectedRevision: item.revision,
      channel: "linkedin",
      caption: "Second main caption",
      link: origin + "/s/" + stack.slug,
    });
    assert.equal(
      saved.ok,
      true,
      "an old client without destination still saves",
    );
    item = saved.items.find((entry) => entry.id === created.changed);
    assert.ok(item);
    assert.equal(item.destination, "MP personal LinkedIn");
    assert.equal(item.caption, "Second main caption");
    assert.equal(item.variants.length, 1);
    assert.equal(item.variants[0].caption, "A Bluesky draft");
    assert.equal(item.destination, "MP personal LinkedIn");
  } finally {
    db.cleanup();
  }
});

test("the approval package uses the exact persisted values and is deterministic", async () => {
  const db = sqliteD1({ schema });
  try {
    const { stack } = await seeded(db, owner, "Package example");
    const caption =
      "Main caption with a newline\nand an emoji 🧑‍🚀, a semicolon; and a backslash \\.";
    const created = await write(db, owner, {
      action: "create",
      stack: stack.id,
      channel: "instagram",
      destination: "MP personal Instagram",
      caption,
      link: origin + "/s/" + stack.slug + "?utm_source=package",
      scheduledAt: "2026-11-20T09:30:00.000Z",
    });
    let item = created.items.find((entry) => entry.id === created.changed);
    assert.ok(item);
    const variantCaption =
      "Review this exact draft:\n\n````\nconst x = 1;\n````\n\nNo post is sent.";
    const added = await write(db, owner, {
      action: "variant",
      item: item.id,
      expectedRevision: item.revision,
      channel: "linkedin",
      destination: "Acme company page",
      caption: variantCaption,
    });
    assert.equal(added.ok, true);
    const listed = await read(db, owner);
    const persisted = listed.items.find(
      (entry) => entry.id === created.changed,
    );
    assert.ok(persisted);
    const pkg = approvalPackageForItem(listed, persisted);

    assert.equal(pkg.schema, "composer.share-approval-package/v1");
    assert.equal(pkg.item.id, persisted.id);
    assert.equal(pkg.item.revision, persisted.revision);
    assert.equal(pkg.item.state, "scheduled");
    assert.equal(pkg.workspace.name, listed.workspace.name);
    assert.equal(pkg.source.stackId, persisted.stack);
    assert.equal(pkg.source.name, persisted.stackName);
    assert.equal(pkg.source.slug, persisted.stackSlug);
    assert.equal(pkg.source.publication, persisted.publication);
    assert.equal(pkg.source.url, listed.sources[0].url);
    assert.equal(pkg.source.current, true);
    assert.equal(pkg.schedule.scheduledAt, persisted.scheduledAt);
    assert.equal(pkg.schedule.local, localTimeLabel(persisted.scheduledAt));
    assert.equal(
      pkg.schedule.utc,
      localTimeLabel(persisted.scheduledAt, "UTC"),
    );
    assert.equal(pkg.link, persisted.link);
    assert.equal(pkg.shareImage.path, listed.sources[0].imagePath);
    assert.equal(
      pkg.shareImage.url,
      new URL(listed.sources[0].imagePath, listed.sources[0].url).href,
    );
    assert.equal(
      pkg.shareImage.downloadName,
      `${persisted.stackSlug}-r${persisted.publication}-share-card.png`,
    );
    assert.equal(pkg.destinations.length, 2);
    assert.equal(pkg.destinations[0].channel, "instagram");
    assert.equal(pkg.destinations[0].primary, true);
    assert.equal(pkg.destinations[0].caption, persisted.caption);
    assert.equal(pkg.destinations[0].exactDestination, "MP personal Instagram");
    assert.equal(pkg.destinations[1].channel, "linkedin");
    assert.equal(pkg.destinations[1].primary, false);
    assert.equal(pkg.destinations[1].caption, variantCaption);
    assert.equal(pkg.destinations[1].exactDestination, "Acme company page");
    assert.equal(pkg.destinations[1].count, variantCaption.length);
    assert.equal(pkg.destinations[1].limit, 3000);
    assert.equal(pkg.destinations[1].withinLimit, true);
    assert.equal(pkg.posting.statement, SHARE_PACKAGE_POSTING_STATEMENT);
    assert.match(pkg.posting.statement, /does not post/i);
    assert.match(pkg.posting.statement, /you perform this share yourself/i);
    assert.equal(pkg.provenance.preparedAt, persisted.updatedAt);
    assert.equal(pkg.provenance.itemRevision, persisted.revision);
    assert.equal(pkg.provenance.sourceRevision, persisted.publication);

    const firstJson = sharePackageJson(pkg);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const second = approvalPackageForItem(listed, persisted);
    const secondJson = sharePackageJson(second);
    assert.equal(firstJson, secondJson, "the same saved item exports twice");
    assert.equal(
      sharePackageMarkdown(pkg),
      sharePackageMarkdown(second),
      "Markdown is deterministic too",
    );
    const decoded = JSON.parse(firstJson);
    assert.equal(decoded.destinations[0].caption, caption);
    assert.equal(decoded.destinations[1].caption, variantCaption);
    assert.equal(decoded.destinations[1].exactDestination, "Acme company page");
    assert.equal(decoded.shareImage.path, listed.sources[0].imagePath);
    assert.equal(
      decoded.provenance.preparedAt,
      persisted.updatedAt,
      "the package has no export clock",
    );

    const markdown = sharePackageMarkdown(pkg);
    assert.ok(markdown.includes(caption));
    assert.ok(markdown.includes(variantCaption));
    assert.match(markdown, /# Approval package/);
    assert.match(markdown, /you perform this share yourself/i);
    const plain = sharePackagePlainText(pkg);
    assert.ok(plain.includes(caption));
    assert.ok(plain.includes(variantCaption));
    assert.ok(plain.includes("Exact destination: Acme company page"));
    assert.ok(plain.includes("This approval package does not post"));
    assert.equal(
      sharePackageFilename(persisted, "json"),
      `approval-${persisted.stackSlug}-r${persisted.publication}-${persisted.id.slice(0, 8)}-rev${persisted.revision}.json`,
    );
    assert.equal(sharePackageFilename(persisted, "md").endsWith(".md"), true);
    assert.equal(
      JSON.stringify(persisted),
      JSON.stringify(listed.items.find((entry) => entry.id === persisted.id)),
      "reading and packaging do not change the persisted item",
    );
  } finally {
    db.cleanup();
  }
});

test("an unknown exact destination is reported as not recorded, never guessed", async () => {
  const db = sqliteD1({ schema });
  try {
    const { workspace, stack } = await seeded(db, owner, "Unknown destination");
    const created = await write(db, owner, {
      action: "create",
      stack: stack.id,
      channel: "bluesky",
      caption: "A Bluesky draft without a recorded account",
      link: "",
    });
    const item = created.items.find((entry) => entry.id === created.changed);
    assert.ok(item);
    let listed = await read(db, owner);
    let pkg = approvalPackageForItem(
      listed,
      listed.items.find((entry) => entry.id === item.id),
    );
    assert.equal(pkg.item.state, "draft");
    assert.equal(pkg.schedule.scheduledAt, null);
    assert.equal(pkg.schedule.label, "Not scheduled");
    assert.equal(pkg.schedule.local, null);
    assert.equal(pkg.destinations[0].exactDestination, null);
    assert.equal(
      pkg.destinations[0].exactDestinationLabel,
      SHARE_PACKAGE_NOT_RECORDED,
    );
    assert.equal(pkg.link, null);
    assert.ok(sharePackageJson(pkg).includes(SHARE_PACKAGE_NOT_RECORDED));
    assert.ok(
      sharePackagePlainText(pkg).includes("Exact destination: not recorded"),
    );
    assert.ok(sharePackageMarkdown(pkg).includes("Bluesky · not recorded"));

    await unpublishStack(db, workspace.id, stack.id, stack.revision);
    listed = await read(db, owner);
    const stale = listed.items.find((entry) => entry.id === item.id);
    assert.ok(stale);
    assert.equal(stale.sourceCurrent, false);
    pkg = approvalPackageForItem(listed, stale);
    assert.equal(pkg.source.current, false);
    assert.equal(pkg.source.url, null);
    assert.equal(pkg.shareImage.path, null);
    assert.equal(pkg.shareImage.status, "not available");
    assert.equal(pkg.item.state, "draft", "the package changes no state");
    assert.equal(stale.state, "draft");
  } finally {
    db.cleanup();
  }
});

test("the .ics round-trips one event per scheduled item with CRLF, folding and UTC", () => {
  const firstId = "aaaaaaaa-1111-4111-8111-111111111111";
  const secondId = "bbbbbbbb-2222-4222-8222-222222222222";
  const draftId = "cccccccc-3333-4333-8333-333333333333";
  const sharedId = "dddddddd-4444-4444-8444-444444444444";
  const staleId = "eeeeeeee-5555-4555-8555-555555555555";
  const caption =
    "Line one\nLine two; commas, a backslash \\ and a long sentence that needs folding across physical lines. " +
    "Emoji keep their bytes together: 🧑‍🚀🚀 and more words to force another fold.";
  const emojiCaption = "🚀".repeat(80);
  const link =
    "https://composer.loftwah.com/s/calendar-example?utm_source=calendar";
  const items = [
    calendarItem({
      id: firstId,
      channel: "instagram",
      destination: "MP personal Instagram",
      caption,
      link,
      scheduledAt: "2026-11-20T23:30:00.000Z",
      state: "scheduled",
      revision: 3,
    }),
    calendarItem({
      id: secondId,
      stackName: "Second; stack, with commas",
      stackSlug: "second-stack",
      publication: 7,
      channel: "bluesky",
      destination: "",
      caption: emojiCaption,
      link: "",
      scheduledAt: "2026-11-21T10:15:00.000Z",
      state: "scheduled",
      revision: 2,
    }),
    calendarItem({
      id: draftId,
      caption: "A draft must never become an event",
      state: "draft",
    }),
    calendarItem({
      id: sharedId,
      caption: "A locally shared item must not reappear",
      state: "shared",
      scheduledAt: "2026-11-22T00:00:00.000Z",
      sharedAt: "2026-11-16T00:00:00.000Z",
    }),
    calendarItem({
      id: staleId,
      caption: "A stale source must not be exported",
      state: "scheduled",
      scheduledAt: "2026-11-23T00:00:00.000Z",
      sourceCurrent: false,
    }),
  ];
  const icsItems = calendarExportItems(items);
  assert.deepEqual(
    icsItems.map((item) => item.id),
    [firstId, secondId],
    "only current scheduled items are exported",
  );
  const ics = buildShareCalendarIcs(icsItems, {
    now: new Date("2026-11-16T05:00:00.000Z"),
    calendarName: "Share calendar · Fictional workspace",
  });
  const parsed = parseCalendar(ics);
  assert.equal(parsed.events.length, 2, "one VEVENT per scheduled item");
  assert.equal(
    parsed.calendar.properties.find((property) => property.name === "VERSION")
      .value,
    "2.0",
  );
  assert.ok(
    parsed.calendar.properties.some(
      (property) =>
        property.name === "PRODID" && /App Composer/.test(property.value),
    ),
  );
  assert.equal(
    parsed.calendar.properties.find((property) => property.name === "CALSCALE")
      .value,
    "GREGORIAN",
  );
  assert.equal(
    parsed.calendar.properties.find((property) => property.name === "METHOD")
      .value,
    "PUBLISH",
  );
  assert.ok(!ics.includes(draftId));
  assert.ok(!ics.includes(sharedId));
  assert.ok(!ics.includes(staleId));

  const byUid = new Map(
    parsed.events.map((event) => [eventProperty(event, "UID").value, event]),
  );
  const first = byUid.get(firstId + "@composer.loftwah.com");
  assert.ok(first);
  assert.equal(eventProperty(first, "DTSTAMP").value, "20261116T050000Z");
  assert.equal(eventProperty(first, "DTSTART").value, "20261120T233000Z");
  assert.equal(
    icsInstant(eventProperty(first, "DTSTART").value),
    "2026-11-20T23:30:00.000Z",
  );
  assert.equal(
    eventProperty(first, "DTEND").value,
    "20261121T000000Z",
    "the UTC end crosses midnight correctly",
  );
  assert.equal(
    icsInstant(eventProperty(first, "DTEND").value),
    "2026-11-21T00:00:00.000Z",
  );
  assert.equal(
    unescapeText(eventProperty(first, "SUMMARY").value),
    "Instagram · Calendar example",
  );
  assert.equal(eventProperty(first, "CATEGORIES").value, "Instagram");
  assert.equal(eventProperty(first, "URL").value, link);
  assert.equal(eventProperty(first, "SEQUENCE").value, "2");
  assert.equal(eventProperty(first, "STATUS").value, "CONFIRMED");
  assert.equal(eventProperty(first, "TRANSP").value, "TRANSPARENT");
  const description = unescapeText(eventProperty(first, "DESCRIPTION").value);
  assert.ok(
    description.startsWith(
      caption + "\n\nExact destination: MP personal Instagram\n\nLink: " + link,
    ),
    "the caption and destination round-trip exactly",
  );
  assert.match(description, /Composer never posts automatically\./);

  const second = byUid.get(secondId + "@composer.loftwah.com");
  assert.ok(second);
  assert.equal(eventProperty(second, "DTSTART").value, "20261121T101500Z");
  assert.equal(
    unescapeText(eventProperty(second, "SUMMARY").value),
    "Bluesky · Second; stack, with commas",
  );
  const secondDescription = unescapeText(
    eventProperty(second, "DESCRIPTION").value,
  );
  assert.ok(
    secondDescription.startsWith(
      emojiCaption + "\n\nExact destination: not recorded",
    ),
    "an unknown destination says not recorded and the emoji survive folding",
  );
  assert.equal(
    second.properties.some((property) => property.name === "URL"),
    false,
    "an item without a link has no URL property",
  );

  const hugeRevision = buildShareCalendarIcs(
    [{ ...icsItems[0], revision: Number.MAX_SAFE_INTEGER }],
    { now: new Date("2026-11-16T05:00:00.000Z") },
  );
  assert.equal(
    eventProperty(parseCalendar(hugeRevision).events[0], "SEQUENCE").value,
    "2147483647",
    "SEQUENCE stays inside the signed 32-bit range",
  );
});

test("the .ics builder refuses a link that could inject calendar properties", () => {
  const item = {
    id: "aaaaaaaa-1111-4111-8111-111111111111",
    revision: 1,
    channel: "instagram",
    destination: "",
    caption: "A real caption",
    link: "https://example.com/post",
    scheduledAt: "2026-11-20T09:30:00.000Z",
    stackName: "Calendar example",
  };
  const now = new Date("2026-11-16T05:00:00.000Z");
  assert.throws(
    () =>
      buildShareCalendarIcs(
        [{ ...item, link: "https://example.com/post\r\nBEGIN:VEVENT" }],
        { now },
      ),
    /unsafe link/i,
  );
  assert.throws(
    () =>
      buildShareCalendarIcs(
        [{ ...item, link: "https://user:secret@example.com/post" }],
        { now },
      ),
    /unsafe link/i,
  );
});

test("Queue Next skips exact-now and the Melbourne daylight-saving gap", () => {
  const first = upcomingQueueSlots(
    1,
    "11:00",
    new Date("2026-11-16T00:00:00Z"),
  );
  assert.equal(first[0], melbourneLocalInstant("2026-11-23T11:00"));
  const spring = upcomingQueueSlots(
    7,
    "02:30",
    new Date("2026-10-01T00:00:00Z"),
  );
  assert.equal(spring[0], melbourneLocalInstant("2026-10-11T02:30"));
  const autumn = upcomingQueueSlots(
    7,
    "02:30",
    new Date("2027-04-02T00:00:00Z"),
  );
  assert.equal(autumn[0], melbourneLocalInstant("2027-04-04T02:30"));
  assert.deepEqual(
    spring,
    upcomingQueueSlots(7, "02:30", new Date("2026-10-01T00:00:00Z")),
  );
});

test("Queue Next reads occupied minutes from the authorized workspace without writes", async () => {
  const db = sqliteD1({ schema });
  try {
    const { workspace, stack } = await seeded(db);
    const { workspace: otherWorkspace } = await seeded(
      db,
      other,
      "Other queue",
    );
    const first = melbourneLocalInstant("2026-11-18T09:00");
    const occupied = new Date(Date.parse(first) + 30_000).toISOString();
    const created = await write(db, owner, {
      action: "create",
      stack: stack.id,
      channel: "bluesky",
      caption: "An occupied Bluesky slot",
      link: origin + "/s/" + stack.slug,
      scheduledAt: occupied,
    });
    assert.equal(created.ok, true, JSON.stringify(created));

    function preview(id, query = "3") {
      const url = new URL(
        origin + "/_emdash/api/plugins/composer-stacks/shareCalendarRead",
      );
      url.search = new URLSearchParams({
        action: "queueNextPreview",
        weekday: query,
        time: "09:00",
        workspace: id,
      }).toString();
      return manageShareCalendar(
        {
          user: owner,
          input: Object.fromEntries(url.searchParams),
          request: new Request(url),
        },
        {
          DB: db,
          PUBLIC_ORIGIN: origin,
          now: new Date("2026-11-16T00:00:00Z"),
          SHARE_BLUESKY_HANDLE: "queue.example.com",
        },
      );
    }
    const reply = await preview(workspace.id);
    assert.deepEqual(reply, {
      ok: true,
      action: "queueNextPreview",
      nextInstant: melbourneLocalInstant("2026-11-25T09:00"),
    });
    assert.equal((await preview(workspace.id, "3.0")).code, "INVALID");
    assert.equal((await preview(otherWorkspace.id)).code, "FORBIDDEN");
    const after = await read(db, owner);
    assert.equal(after.items.length, 1);
    assert.equal(after.items[0].scheduledAt, occupied);
    assert.equal(after.items[0].revision, created.items[0].revision);
  } finally {
    db.cleanup();
  }
});

// Queue presets (#604 follow-up). Separate GET/POST actions return one bounded
// reply; they do not touch the snapshot, a schedule or any provider.
const queueHandle = "queue.example.com";

function queueInput(
  db,
  user,
  value,
  method = "POST",
  workspace,
  handle = queueHandle,
) {
  const reading = method === "GET";
  return manageShareCalendar(
    {
      user,
      input: { ...value, ...(workspace ? { workspace } : {}) },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/" +
          (reading ? "shareCalendarRead" : "shareCalendarWrite"),
        {
          method,
          headers: reading
            ? {}
            : {
                Origin: origin,
                "X-EmDash-Request": "1",
                "Content-Type": "application/json",
              },
        },
      ),
    },
    { DB: db, PUBLIC_ORIGIN: origin, SHARE_BLUESKY_HANDLE: handle },
  );
}
const queueGet = (db, user = owner, workspace, handle) =>
  queueInput(db, user, { action: "queuePresets" }, "GET", workspace, handle);
const queueSave = (db, user, value, workspace, handle) =>
  queueInput(
    db,
    user,
    { action: "queuePresetSave", account: queueHandle, ...value },
    "POST",
    workspace,
    handle,
  );
const queueDelete = (db, user, value, workspace, handle) =>
  queueInput(
    db,
    user,
    { action: "queuePresetDelete", account: queueHandle, ...value },
    "POST",
    workspace,
    handle,
  );

test("queue presets keep the exact contract and leave the snapshot schema intact", () => {
  assert.equal(
    shareCalendarReadInput.safeParse({ action: "queuePresets" }).success,
    true,
    "queuePresets is a declared read action",
  );
  const valid = shareCalendarCommand.parse({
    action: "queuePresetSave",
    account: "queue.example.com",
    category: "  Launch Week  ",
    weekday: 3,
    time: "09:30",
  });
  assert.equal(valid.category, "Launch Week", "the category is trimmed");
  assert.equal(valid.weekday, 3);
  assert.equal(valid.time, "09:30");
  assert.equal(
    shareCalendarCommand.safeParse({
      action: "queuePresetDelete",
      account: "queue.example.com",
      category: " Launch ",
    }).success,
    true,
  );
  for (const bad of [
    { weekday: 0 },
    { weekday: 8 },
    { weekday: 3.5 },
    { time: "25:00" },
    { time: "09:60" },
    { time: "9:30" },
    { category: "" },
    { category: "x".repeat(49) },
    { account: "" },
    { provenance: "owner" },
  ])
    assert.equal(
      shareCalendarCommand.safeParse({
        action: "queuePresetSave",
        account: "queue.example.com",
        category: "Launch",
        weekday: 3,
        time: "09:30",
        ...bad,
      }).success,
      false,
      "invalid: " + JSON.stringify(bad),
    );

  const reply = {
    ok: true,
    action: "queuePresets",
    workspace: "queue-workspace-01",
    account: "queue.example.com",
    presets: [{ category: "Launch", weekday: 3, time: "09:30" }],
  };
  assert.deepEqual(shareQueuePresetsReplySchema.parse(reply), reply);
  assert.equal(
    shareQueuePresetsReplySchema.safeParse({
      ...reply,
      presets: Array.from({ length: SHARE_QUEUE_PRESET_MAX + 1 }, () => ({
        category: "x",
        weekday: 1,
        time: "09:30",
      })),
    }).success,
    false,
    "the reply is capped at 12",
  );
  // Widening the snapshot would break every existing reader; prove it kept its
  // exact field set and does not accept the queue reply as a snapshot.
  assert.equal(Object.hasOwn(shareCalendarSnapshot.shape, "presets"), false);
  assert.equal(shareCalendarSnapshot.safeParse(reply).success, false);
});

test("queue presets save, upsert and delete atomically without touching a schedule", async () => {
  const db = sqliteD1({ schema });
  try {
    const { workspace, stack } = await seeded(db);
    const scheduled = await write(db, owner, {
      action: "create",
      stack: stack.id,
      channel: "bluesky",
      caption: "A scheduled item that must stay exact",
      link: origin + "/s/" + stack.slug,
      scheduledAt: "2026-11-20T09:30:00.000Z",
    });
    assert.equal(scheduled.ok, true);
    const before = await read(db, owner);

    const empty = await queueGet(db, owner, workspace.id);
    assert.deepEqual(empty, {
      ok: true,
      action: "queuePresets",
      workspace: workspace.id,
      account: queueHandle,
      presets: [],
    });
    assert.deepEqual(shareQueuePresetsReplySchema.parse(empty), empty);

    const saved = await queueSave(db, owner, {
      category: "  Launch Week  ",
      weekday: 3,
      time: "09:30",
    }, workspace.id);
    assert.deepEqual(saved.presets, [
      { category: "Launch Week", weekday: 3, time: "09:30" },
    ]);
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM creator_share_queue_presets")
          .first()
      ).count,
      1,
      "one stored row",
    );

    const updated = await queueSave(db, owner, {
      category: "Launch Week",
      weekday: 5,
      time: "11:45",
    }, workspace.id);
    assert.deepEqual(updated.presets, [
      { category: "Launch Week", weekday: 5, time: "11:45" },
    ]);
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM creator_share_queue_presets")
          .first()
      ).count,
      1,
      "an update is an upsert, not a second row",
    );

    const second = await queueSave(db, owner, {
      category: "Review",
      weekday: 7,
      time: "16:00",
    }, workspace.id);
    assert.equal(second.presets.length, 2);
    const removed = await queueDelete(db, owner, {
      category: "Launch Week",
    }, workspace.id);
    assert.deepEqual(removed.presets, [
      { category: "Review", weekday: 7, time: "16:00" },
    ]);
    const missing = await queueDelete(db, owner, {
      category: "Ghost",
    }, workspace.id);
    assert.deepEqual(missing.presets, removed.presets, "delete is idempotent");

    const after = await read(db, owner);
    assert.deepEqual(after.items, before.items, "calendar items are unchanged");
    assert.deepEqual(
      after.deliveries,
      before.deliveries,
      "deliveries are unchanged",
    );
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM creator_share_calendar_items")
          .first()
      ).count,
      1,
      "no schedule row was added or removed",
    );
  } finally {
    db.cleanup();
  }
});

test("queue presets are capped at 12 per workspace/account and updates still work at the cap", async () => {
  const db = sqliteD1({ schema });
  try {
    const { workspace } = await seeded(db);
    for (let index = 0; index < SHARE_QUEUE_PRESET_MAX; index += 1) {
      const reply = await queueSave(db, owner, {
        category: "Preset " + index,
        weekday: (index % 7) + 1,
        time: "09:30",
      }, workspace.id);
      assert.equal(reply.presets.length, index + 1);
    }
    const overflow = await queueSave(db, owner, {
      category: "One too many",
      weekday: 1,
      time: "09:30",
    }, workspace.id);
    assert.equal(overflow.code, "INVALID");
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM creator_share_queue_presets")
          .first()
      ).count,
      SHARE_QUEUE_PRESET_MAX,
    );

    const atCap = await queueSave(db, owner, {
      category: "Preset 0",
      weekday: 4,
      time: "07:15",
    }, workspace.id);
    assert.equal(atCap.presets.length, SHARE_QUEUE_PRESET_MAX);
    assert.deepEqual(
      atCap.presets.find((preset) => preset.category === "Preset 0"),
      { category: "Preset 0", weekday: 4, time: "07:15" },
      "an existing category can still be updated at the cap",
    );

    await queueDelete(db, owner, { category: "Preset 0" }, workspace.id);
    const afterRoom = await queueSave(db, owner, {
      category: "One too many",
      weekday: 2,
      time: "10:00",
    }, workspace.id);
    assert.equal(afterRoom.presets.length, SHARE_QUEUE_PRESET_MAX);
  } finally {
    db.cleanup();
  }
});

test("queue presets are isolated per workspace and refuse non-owner members", async () => {
  const db = sqliteD1({ schema });
  try {
    const first = await seeded(db);
    const second = await seeded(db, other, "Other queue workspace");
    await queueSave(db, owner, {
      category: "First only",
      weekday: 1,
      time: "09:00",
    }, first.workspace.id);

    const readFirst = await queueGet(db, owner, first.workspace.id);
    const readSecond = await queueGet(db, other, second.workspace.id);
    assert.equal(readFirst.workspace, first.workspace.id);
    assert.equal(readSecond.workspace, second.workspace.id);
    assert.deepEqual(readFirst.presets, [
      { category: "First only", weekday: 1, time: "09:00" },
    ]);
    assert.deepEqual(readSecond.presets, [], "a second workspace is isolated");

    const editor = { id: "fictional-queue-editor", role: 20 };
    const viewer = { id: "fictional-queue-viewer", role: 20 };
    for (const [member, role] of [
      [editor, "editor"],
      [viewer, "viewer"],
    ])
      await db
        .prepare(
          "INSERT INTO creator_members (workspace_id,user_id,role) VALUES (?,?,?)",
        )
        .bind(first.workspace.id, member.id, role)
        .run();
    assert.equal((await queueGet(db, editor, first.workspace.id)).code, "FORBIDDEN");
    assert.equal((await queueGet(db, viewer, first.workspace.id)).code, "FORBIDDEN");
    assert.equal(
      (
        await queueSave(db, editor, {
          category: "Member write",
          weekday: 1,
          time: "09:00",
        }, first.workspace.id)
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await queueDelete(db, editor, { category: "First only" }, first.workspace.id)
      ).code,
      "FORBIDDEN",
    );
    // A workspace id from another scope is refused even for a real owner.
    assert.equal(
      (
        await queueSave(db, other, {
          category: "Cross scope",
          weekday: 1,
          time: "09:00",
        }, first.workspace.id)
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (await db.prepare("SELECT COUNT(*) AS count FROM creator_share_queue_presets").first()).count,
      1,
      "only the owner's scoped preset was stored",
    );
  } finally {
    db.cleanup();
  }
});

test("queue presets follow the configured account switch and refuse a stale expected account", async () => {
  const db = sqliteD1({ schema });
  try {
    const { workspace } = await seeded(db);
    const firstHandle = "first.example.com";
    const secondHandle = "second.example.com";

    const saved = await queueSave(
      db,
      owner,
      {
        account: firstHandle,
        category: "First account",
        weekday: 2,
        time: "09:30",
      },
      workspace.id,
      firstHandle,
    );
    assert.equal(saved.account, firstHandle);
    assert.equal(saved.presets.length, 1);
    assert.equal(
      (await queueGet(db, owner, workspace.id, firstHandle)).presets.length,
      1,
    );

    const switched = await queueGet(db, owner, workspace.id, secondHandle);
    assert.equal(switched.account, secondHandle);
    assert.deepEqual(switched.presets, [], "presets are keyed to the account");

    const stale = await queueSave(
      db,
      owner,
      { account: firstHandle, category: "Stale", weekday: 1, time: "09:00" },
      workspace.id,
      secondHandle,
    );
    assert.equal(stale.code, "CONFLICT", "an old expected account is refused");
    const staleDelete = await queueDelete(
      db,
      owner,
      { account: firstHandle, category: "First account" },
      workspace.id,
      secondHandle,
    );
    assert.equal(staleDelete.code, "CONFLICT");

    const added = await queueSave(
      db,
      owner,
      { account: secondHandle, category: "Second account", weekday: 4, time: "12:00" },
      workspace.id,
      secondHandle,
    );
    assert.equal(added.account, secondHandle);
    assert.deepEqual(added.presets, [
      { category: "Second account", weekday: 4, time: "12:00" },
    ]);
    const backToFirst = await queueGet(db, owner, workspace.id, firstHandle);
    assert.deepEqual(backToFirst.presets, [
      { category: "First account", weekday: 2, time: "09:30" },
    ], "switching accounts does not overwrite the other account's presets");
    assert.equal(
      (await queueGet(db, owner, workspace.id, null)).code,
      "INVALID",
      "no configured account is an explicit needs-account state",
    );
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM creator_share_queue_presets")
          .first()
      ).count,
      2,
    );
  } finally {
    db.cleanup();
  }
});

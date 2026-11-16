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
  canonicalInstant,
  isSafeShareLink,
  SHARE_CHANNELS,
  SHARE_STATES,
  shareCalendarCommand,
} from "../src/lib/share-calendar.ts";
import { manageShareCalendar } from "../src/lib/share-calendar-admin.ts";

const origin = "https://composer.loftwah.com";
const schema = [
  "0003_stacks.sql",
  "0004_stack_publications.sql",
  "0031_share_calendar.sql",
]
  .map(migration)
  .join("\n");
const owner = { id: "fictional-calendar-owner", role: 20 };
const other = { id: "fictional-calendar-other", role: 20 };

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

function parseIcs(source) {
  assert.ok(source.endsWith("\r\n"), "the calendar ends with CRLF");
  assert.ok(!/(?<!\r)\n/.test(source), "every newline is CRLF");
  const physical = source.split("\r\n").filter(Boolean);
  for (const line of physical)
    assert.ok(
      new TextEncoder().encode(line).length <= 75,
      "physical line is at most 75 octets: " + line.slice(0, 20),
    );
  const unfolded = [];
  for (const line of physical) {
    if (line.startsWith(" ")) unfolded[unfolded.length - 1] += line.slice(1);
    else unfolded.push(line);
  }
  assert.equal(unfolded[0], "BEGIN:VCALENDAR");
  assert.equal(unfolded.at(-1), "END:VCALENDAR");
  assert.equal(
    unfolded.filter((line) => line === "BEGIN:VEVENT").length,
    1,
    "one event",
  );
  assert.equal(
    unfolded.filter((line) => line === "END:VEVENT").length,
    1,
    "one event close",
  );
  const properties = new Map();
  for (const line of unfolded.slice(1, -1)) {
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const name = line.slice(0, colon).split(";")[0];
    properties.set(name, line.slice(colon + 1));
  }
  return { physical, unfolded, properties };
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
  assert.match(description, /Composer does not post to a social network\./);
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

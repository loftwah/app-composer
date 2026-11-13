import assert from "node:assert/strict";
import test from "node:test";
import {
  MediaContractError,
  disableNote,
  formatCost,
  generateImageCode,
  generateVideoCode,
  jobView,
  newRequestId,
  normaliseHost,
  readCatalogue,
  readExecuteReply,
  readGeneration,
  readJsonRpcReply,
  readRefusal,
  readStatusRow,
} from "../src/lib/media-capability.mjs";

const rawCatalogue = {
  models: [
    {
      id: "studio-still",
      label: "Studio still",
      kind: "image",
      tier: "balanced",
      maxPromptLength: 1200,
      input: {
        maxReferences: 4,
        defaultWidth: 1024,
        defaultHeight: 1024,
        maxDimension: 1920,
      },
      sizes: null,
      video: null,
      priceEstimate: { costMilliunits: 6561 },
    },
    {
      id: "studio-clip",
      label: "Studio clip",
      kind: "video",
      tier: "draft",
      maxPromptLength: 2000,
      input: { maxReferences: 1, defaultWidth: 1280, defaultHeight: 720, maxDimension: 1920 },
      video: {
        durations: [5, 10],
        defaultSeconds: 5,
        defaultResolution: "720p",
        defaultAspectRatio: "16:9",
        formats: [
          { resolution: "720p", aspectRatio: "16:9", width: 1280, height: 720 },
          { resolution: "480p", aspectRatio: "1:1", width: 480, height: 480 },
        ],
        maxReferenceImages: 1,
      },
      priceEstimate: { costMilliunits: 45000 },
    },
  ],
};

const catalogue = readCatalogue(rawCatalogue, "2026-11-13T10:00:00.000Z");

test("host addresses are https origins without credentials or paths", () => {
  assert.equal(normaliseHost("https://oyster.example.workers.dev"), "https://oyster.example.workers.dev");
  assert.equal(normaliseHost(" https://oyster.example.workers.dev/ "), "https://oyster.example.workers.dev");
  for (const bad of [
    "http://oyster.example",
    "https://user:pass@oyster.example",
    "https://oyster.example/some/path",
    "https://oyster.example?x=1",
    "not a url",
    "",
  ]) {
    assert.throws(() => normaliseHost(bad), MediaContractError);
  }
});

test("request ids satisfy the studio's one stable identity format", () => {
  const id = newRequestId();
  assert.match(id, /^media_request_[a-z0-9]{21}$/);
  const fixed = newRequestId(() => 1);
  assert.match(fixed, /^media_request_[a-z0-9]{21}$/);
  assert.equal(fixed.length, "media_request_".length + 21);
  assert.match(newRequestId(() => Number.NaN), /^media_request_[a-z0-9]{21}$/);
});

test("a generation request is checked against the live catalogue, not a form", () => {
  const image = readGeneration(
    { kind: "image", model: "studio-still", prompt: "  a ceramic bowl  " },
    catalogue,
  );
  assert.equal(image.prompt, "a ceramic bowl");
  assert.equal(image.width, 1024);
  assert.equal(image.referencePath, null);

  const video = readGeneration(
    {
      kind: "video",
      model: "studio-clip",
      prompt: "slow push in",
      durationSeconds: 10,
      resolution: "480p",
    },
    catalogue,
  );
  // Format drives the exact frame the provider records, not a guessed size.
  assert.equal(video.width, 480);
  assert.equal(video.height, 480);
  assert.equal(video.aspectRatio, "1:1");
  assert.equal(video.durationSeconds, 10);
});

test("unsupported model, kind, size, duration and reference fail closed", () => {
  assert.throws(
    () => readGeneration({ kind: "image", model: "missing", prompt: "x y z" }, catalogue),
    /not in the host's current catalogue/,
  );
  assert.throws(
    () => readGeneration({ kind: "video", model: "studio-still", prompt: "x y z" }, catalogue),
    /does not make video/,
  );
  assert.throws(
    () =>
      readGeneration(
        { kind: "image", model: "studio-still", prompt: "x y z", width: 4000 },
        catalogue,
      ),
    /largest dimension/,
  );
  assert.throws(
    () =>
      readGeneration(
        { kind: "video", model: "studio-clip", prompt: "x y z", durationSeconds: 7 },
        catalogue,
      ),
    /supports 5, 10 second clips/,
  );
  assert.throws(
    () =>
      readGeneration(
        { kind: "image", model: "studio-still", prompt: "x y z", referencePath: "../../etc/passwd" },
        catalogue,
      ),
    /absolute path/,
  );
  assert.throws(() => readGeneration({ kind: "image", model: "studio-still", prompt: "ab" }, catalogue), /three characters/);
});

test("code for the host embeds values as JSON literals, never as executable text", () => {
  const request = readGeneration(
    {
      kind: "image",
      model: "studio-still",
      prompt: '"; return await env.BONSAl.bash({command:"rm -rf /"}); //',
      referencePath: "/media/prints/a.png",
    },
    catalogue,
  );
  const code = generateImageCode(request);
  assert.match(code, /env\.PRINTS\.generateImage/);
  assert.ok(code.includes(JSON.stringify(request.requestId)));
  // The prompt appears only inside a JSON string literal.
  assert.ok(code.includes(JSON.stringify(request.prompt)));
  const first = code.split("\n")[0];
  const literal = JSON.parse(first.slice("const request = ".length).replace(/;$/, ""));
  assert.equal(literal.settings.prompt, request.prompt);
  const body = code.split("\n").slice(1).join("\n");
  assert.ok(!body.includes("BONSAl"));
  assert.equal(body.split("env.PRINTS.generateImage").length, 2);
  const videoCode = generateVideoCode(
    readGeneration({ kind: "video", model: "studio-clip", prompt: "drift" }, catalogue),
  );
  assert.match(videoCode, /env\.PRINTS\.generateVideo/);
  assert.match(videoCode, /durationSeconds\\?":5/);
});

test("cost labels use the studio's 100,000-unit dollar", () => {
  assert.equal(formatCost(0), "US$0");
  assert.equal(formatCost(6561), "US$0.066");
  assert.equal(formatCost(45000), "US$0.45");
  assert.equal(formatCost(240000), "US$2.40");
  assert.equal(formatCost(-1), "Unknown cost");
});

test("an MCP reply is read from JSON or SSE and a refusal is surfaced", () => {
  const jsonReply = JSON.stringify({ jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: "{\"ok\":1}" }] } });
  assert.deepEqual(readJsonRpcReply(jsonReply, 2), {
    content: [{ type: "text", text: "{\"ok\":1}" }],
  });
  const sse = [
    "event: message",
    "data: {\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"{\\\"models\\\":[]}\"}]}}",
    "",
  ].join("\n");
  const result = readJsonRpcReply(sse, 2);
  assert.deepEqual(readExecuteReply(result).payload, { models: [] });
  assert.throws(
    () => readJsonRpcReply('data: {"jsonrpc":"2.0","id":1,"error":{"message":"refused"}}', 1),
    /refused/,
  );
  assert.deepEqual(readRefusal({ error: "not_granted" }), {
    code: "not_granted",
    message: "The host refused this request (not_granted)",
  });
  assert.equal(readRefusal({ destination: { path: "/a" } }), null);
});

test("status rows keep their configuration when the catalogue is unreadable", () => {
  const status = readStatusRow({
    enabled: 1,
    host: "https://oyster.example.workers.dev",
    installation: "prints",
    models_json: "{not json",
    updated_at: "2026-11-13T10:00:00.000Z",
    updated_by: "owner",
  });
  assert.equal(status.enabled, true);
  assert.equal(status.catalogue, null);
  assert.equal(status.host, "https://oyster.example.workers.dev");
});

test("a job view exposes provenance, cost and the imported copy", () => {
  const view = jobView({
    id: "job_abcdefghijklmnopqrstu",
    request_id: "media_request_abcdefghijklmnopqrstu",
    kind: "image",
    state: "completed",
    prompt: "cover art",
    model: "studio-still",
    settings_json: "{\"width\":1024}",
    reference_path: null,
    cost_milliunits: 6561,
    output_json: "{\"format\":\"jpeg\"}",
    error_code: null,
    created_at: "2026-11-13T10:00:00.000Z",
    updated_at: "2026-11-13T10:01:00.000Z",
    imported_key: "media-studio/job_x.jpg",
    imported_sha256: "abc",
    imported_bytes: 10,
    imported_format: "jpg",
    created_by: "owner",
  });
  assert.equal(view.cost.label, "US$0.066");
  assert.equal(view.imported.key, "media-studio/job_x.jpg");
  assert.deepEqual(view.output, { format: "jpeg" });
});

test("disabling never claims to delete or revoke the independent host", () => {
  assert.match(disableNote, /Existing jobs, imported media/);
  assert.match(disableNote, /independently reachable/);
  assert.match(disableNote, /does not delete/);
});

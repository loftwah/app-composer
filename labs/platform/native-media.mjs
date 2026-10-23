// A finite edit of one selected, passed native run. This never starts the lab.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  captionHTML,
  captionStamp,
  readableCaptionVTT,
} from "./media-captions.mjs";
import {
  chapters,
  inspectNativeMedia,
  loadNativeEdit,
  mediaOutput,
  scope,
  sha256,
} from "./native-media-plan.mjs";

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const size = {
  width: 1600,
  height: 1200,
  stageHeight: 900,
  captionHeight: 300,
};
const quote = (path) => "'" + path.replaceAll("'", "'\\''") + "'";
const metadataText = (value) => String(value).replace(/[=;#\\\n\r]/g, " ");
function argumentsFor(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    assert.ok(
      [
        "--native-receipt",
        "--expect-native-sha256",
        "--native-edit",
        "--output",
        "--validate-only",
        "--render",
        "--admitted",
      ].includes(flag) && !Object.hasOwn(values, flag),
      "Use explicit, non-repeated native media arguments.",
    );
    if (["--validate-only", "--render", "--admitted"].includes(flag))
      values[flag] = true;
    else {
      assert.ok(
        argv[i + 1] && !argv[i + 1].startsWith("--"),
        "A native media path or hash is missing.",
      );
      values[flag] = argv[++i];
    }
  }
  assert.ok(
    Boolean(values["--validate-only"]) !== Boolean(values["--render"]),
    "Select --validate-only, or explicit --render --admitted after host admission.",
  );
  assert.ok(
    !values["--render"] || values["--admitted"],
    "Native media rendering requires explicit shared-host admission.",
  );
  return values;
}

export async function nativeMediaCLI(argv) {
  const args = argumentsFor(argv);
  const native = await inspectNativeMedia(
    args["--native-receipt"],
    args["--expect-native-sha256"],
  );
  const { plan, editSHA256 } = await loadNativeEdit(
    args["--native-edit"],
    native,
  );
  if (args["--validate-only"]) {
    console.log(
      JSON.stringify(
        {
          schema: plan.schema,
          nativeReceiptSHA256: native.receiptSHA256,
          editSHA256,
          sources: native.sources,
          teams: native.teams,
          films: plan.films.map(({ name, duration, target, segments }) => ({
            name,
            duration,
            target,
            cuts: segments.length,
          })),
          render: "not-run",
          browser: "not-started",
          assets: "capture-time hashes verified",
          qualification: scope,
          captureInspectionHoldMs: native.captureInspectionHoldMs,
          recordedInspectionHoldSeconds: native.recordedInspectionHoldSeconds,
        },
        null,
        2,
      ),
    );
    return;
  }
  assert.ok(
    /^[a-f0-9]{32}$/.test(process.env.LOFTWAH_VALIDATION_GENERATION ?? "") &&
      isAbsolute(process.env.LOFTWAH_VALIDATION_COMPLETION ?? ""),
    "Rendering requires the existing shared-host supervisor's inherited reservation lineage.",
  );
  const out = mediaOutput(workspace, args["--output"], native.receiptSHA256);
  // Refuse replacing owner captures, earlier renders, receipts or a linked output.
  await assert.rejects(lstat(out), { code: "ENOENT" });
  const modulePath = process.env.PLAYWRIGHT_MODULE;
  assert.ok(
    modulePath && isAbsolute(modulePath),
    "Select an existing absolute PLAYWRIGHT_MODULE; no installation is attempted.",
  );
  const ffmpeg = process.env.FFMPEG_PATH ?? "/opt/homebrew/bin/ffmpeg";
  const ffprobe = process.env.FFPROBE_PATH ?? "/opt/homebrew/bin/ffprobe";
  await Promise.all([access(modulePath), access(ffmpeg), access(ffprobe)]);
  const rendererSource = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: workspace,
    encoding: "utf8",
  }).trim();
  assert.equal(
    execFileSync("git", ["status", "--porcelain"], {
      cwd: workspace,
      encoding: "utf8",
    }).trim(),
    "",
    "Render only from a clean committed media source.",
  );
  const rendererPaths = [
    "labs/platform/capture-walkthrough.mjs",
    "labs/platform/native-media.mjs",
    "labs/platform/native-media-plan.mjs",
    "labs/platform/media-captions.mjs",
    "public/brand/space-latin-20261018.woff2",
  ];
  const rendererHashes = Object.fromEntries(
    await Promise.all(
      rendererPaths.map(async (path) => [
        path,
        sha256(await readFile(join(workspace, path))),
      ]),
    ),
  );
  const root = await mkdtemp(join(tmpdir(), "composer-platform-native-media-"));
  let browser,
    activeChild,
    interrupted = false,
    outputOwned = false;
  const previousTMPDIR = process.env.TMPDIR;
  const report = {
    schema: "composer.platform-native-media/1",
    status: "rendering",
    createdAt: new Date().toISOString(),
    rendererSource,
    rendererHashes,
    nativeReceiptSHA256: native.receiptSHA256,
    editSHA256,
    nativeRun: {
      startedAt: native.startedAt,
      finishedAt: native.finishedAt,
      sources: native.sources,
      teams: native.teams,
      authoredHashes: native.authoredHashes,
      captureInspectionHoldMs: native.captureInspectionHoldMs,
      recordedInspectionHoldSeconds: native.recordedInspectionHoldSeconds,
    },
    qualification: scope,
    limits: [
      "Edited excerpts of one continuous per-actor native run; source clips play at normal speed. Explicit still holds and cuts are declared in edit-manifest.json.",
      "Local virtual passkeys and synthetic app data; no production SSO, regional storage or upstream provider-permission claim.",
      "Recovery chapter explains the retained-operation contract; no incident injection, full restore or retirement footage exists in this native run.",
      "No narrated voice, music or unapproved audio.",
    ],
    viewport: size,
    films: [],
    artifacts: [],
  };
  const stop = () => {
    interrupted = true;
    activeChild?.kill("SIGTERM");
    if (browser) void browser.close().catch(() => {});
  };
  const run = (command, argv) =>
    new Promise((yes, no) => {
      if (interrupted) return no(Error("Native media rendering interrupted."));
      const child = execFile(
        command,
        argv,
        {
          timeout: 600000,
          maxBuffer: 200000,
          env: { ...process.env, TMPDIR: root },
        },
        (error, stdout) => {
          if (activeChild === child) activeChild = undefined;
          if (error)
            no(
              Error(
                "The bounded local media command failed; partial outputs are unqualified.",
              ),
            );
          else yes(stdout);
        },
      );
      activeChild = child;
    });
  const artifact = async (name) => {
    const bytes = await readFile(join(out, name));
    report.artifacts.push({
      path: name,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    process.env.TMPDIR = root;
    let parent = workspace;
    for (const component of relative(workspace, dirname(out)).split("/")) {
      parent = join(parent, component);
      try {
        const info = await lstat(parent);
        assert.ok(
          info.isDirectory() && !info.isSymbolicLink(),
          "The media output parent must remain a real worktree directory.",
        );
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await mkdir(parent);
      }
    }
    await mkdir(out);
    outputOwned = true;
    await mkdir(join(root, "captures"));
    const selectedAssets = new Set(
      plan.films.flatMap((film) => film.segments.map((entry) => entry.asset)),
    );
    const copied = new Map();
    for (const name of selectedAssets) {
      const asset = native.assets.get(name);
      const bytes = await readFile(asset.path);
      assert.equal(
        sha256(bytes),
        asset.sha256,
        "A capture changed after validation; no changed media may render.",
      );
      const destination = join(root, "captures", name);
      await writeFile(destination, bytes, { flag: "wx" });
      copied.set(name, destination);
      if (asset.kind === "clip") {
        const probe = JSON.parse(
          await run(ffprobe, [
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            destination,
          ]),
        );
        const video = probe.streams.find(
          (stream) => stream.codec_type === "video",
        );
        assert.ok(
          video &&
            ["vp8", "vp9", "av1"].includes(video.codec_name) &&
            Math.abs(Number(probe.format.duration) - asset.duration) <= 0.2,
          "Actual WebM stream/duration disagrees with its capture receipt.",
        );
      }
    }
    const { chromium } = await import(pathToFileURL(modulePath).href);
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      downloadsPath: join(root, "downloads"),
    });
    report.browser = await browser.version();
    report.ffmpeg = (await run(ffmpeg, ["-version"])).split("\n")[0];
    report.ffprobe = (await run(ffprobe, ["-version"])).split("\n")[0];
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.captionHeight },
      deviceScaleFactor: 1,
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    const font = (
      await readFile(join(workspace, "public/brand/space-latin-20261018.woff2"))
    ).toString("base64");
    for (const film of plan.films) {
      const clips = [];
      for (let i = 0; i < film.segments.length; i++) {
        const entry = film.segments[i];
        const prefix = film.name + "-" + String(i + 1).padStart(2, "0");
        await page.setContent(
          captionHTML({
            font,
            heading: entry.heading,
            body: entry.body,
            provenance: entry.provenance,
            height: size.captionHeight,
          }),
        );
        await page.evaluate(() => document.fonts.ready);
        assert.ok(
          await page.evaluate(() => document.fonts.check("26px Space")),
          "The existing local Space font did not load.",
        );
        assert.ok(
          await page.evaluate(
            () =>
              document.body.scrollHeight <= innerHeight &&
              document.body.scrollWidth <= innerWidth,
          ),
          "A caption or source identity overflows its visible strip; revise before publication.",
        );
        const caption = join(root, prefix + ".png");
        await page.screenshot({ path: caption });
        const destination = join(root, prefix + ".mp4");
        const input =
          entry.kind === "clip"
            ? [
                "-ss",
                entry.sourceStart.toFixed(3),
                "-i",
                copied.get(entry.asset),
              ]
            : ["-loop", "1", "-framerate", "30", "-i", copied.get(entry.asset)];
        const crop = entry.crop
          ? `crop=${entry.crop.width}:${entry.crop.height}:${entry.crop.x}:${entry.crop.y},`
          : "";
        const filter = `[0:v]${crop}scale=1600:900:force_original_aspect_ratio=decrease,pad=1600:900:(ow-iw)/2:(oh-ih)/2:color=0x0b100d,setsar=1[screen];[screen][1:v]vstack=inputs=2:shortest=1,format=yuv420p[v]`;
        await run(ffmpeg, [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          ...input,
          "-loop",
          "1",
          "-i",
          caption,
          "-filter_complex",
          filter,
          "-map",
          "[v]",
          "-an",
          "-t",
          entry.duration.toFixed(3),
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "20",
          "-pix_fmt",
          "yuv420p",
          "-fs",
          "33554432",
          destination,
        ]);
        clips.push(destination);
      }
      const contiguous = [];
      for (const entry of film.segments) {
        if (contiguous.at(-1)?.id === entry.chapter)
          contiguous.at(-1).end = entry.end;
        else
          contiguous.push({
            id: entry.chapter,
            title: chapters[entry.chapter],
            start: entry.start,
            end: entry.end,
          });
      }
      const concat = join(root, film.name + ".concat");
      await writeFile(
        concat,
        clips.map((path) => "file " + quote(path)).join("\n") + "\n",
      );
      const metadata = join(root, film.name + ".metadata");
      await writeFile(
        metadata,
        ";FFMETADATA1\ntitle=" +
          metadataText("App Composer · local native " + film.name) +
          "\ncomment=" +
          metadataText(scope + " / native receipt " + native.receiptSHA256) +
          "\n" +
          contiguous
            .map(
              (entry) =>
                `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(entry.start * 1000)}\nEND=${Math.round(entry.end * 1000)}\ntitle=${metadataText(entry.title)}`,
            )
            .join("\n"),
      );
      const name = film.name + ".mp4";
      await run(ffmpeg, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concat,
        "-i",
        metadata,
        "-map",
        "0:v",
        "-map_metadata",
        "1",
        "-map_chapters",
        "1",
        "-c",
        "copy",
        "-an",
        "-movflags",
        "+faststart",
        "-fs",
        "536870912",
        join(out, name),
      ]);
      const probe = JSON.parse(
        await run(ffprobe, [
          "-v",
          "error",
          "-show_format",
          "-show_streams",
          "-show_chapters",
          "-of",
          "json",
          join(out, name),
        ]),
      );
      const video = probe.streams.find(
        (stream) => stream.codec_type === "video",
      );
      assert.ok(
        video?.codec_name === "h264" &&
          video.pix_fmt === "yuv420p" &&
          video.width === size.width &&
          video.height === size.height &&
          probe.streams.every((stream) => stream.codec_type !== "audio") &&
          Math.abs(Number(probe.format.duration) - film.duration) <= 0.3 &&
          probe.chapters.length === 6,
        "The encoded MP4 does not satisfy the declared stream, duration or chapter contract.",
      );
      await writeFile(join(out, film.name + ".vtt"), readableCaptionVTT(film));
      await writeFile(
        join(out, film.name + ".transcript.md"),
        `# App Composer: ${film.name}\n\n${scope}\n\n` +
          film.segments
            .map(
              (entry) =>
                `## ${captionStamp(entry.start)} · ${entry.heading}\n\n${entry.body}\n\n${entry.provenance.join("\n\n")}\n\nSource: ${entry.asset}, SHA-256 ${entry.sourceSHA256}; ${entry.kind === "clip" ? `normal-speed cut ${entry.sourceStart}–${entry.sourceStart + entry.duration}s` : `genuine still held ${entry.duration}s`}.\n`,
            )
            .join("\n"),
      );
      await writeFile(
        join(out, film.name + ".chapters.json"),
        JSON.stringify(
          { nativeReceiptSHA256: native.receiptSHA256, chapters: contiguous },
          null,
          2,
        ) + "\n",
      );
      await run(ffmpeg, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        "2",
        "-i",
        join(out, name),
        "-frames:v",
        "1",
        "-q:v",
        "2",
        join(out, film.name + "-poster.jpg"),
      ]);
      const keyframes = [];
      for (const chapter of contiguous) {
        const at =
          chapter.start + Math.min(2, (chapter.end - chapter.start) / 2);
        const path = film.name + "-chapter-" + chapter.id + ".jpg";
        await run(ffmpeg, [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-ss",
          at.toFixed(3),
          "-i",
          join(out, name),
          "-frames:v",
          "1",
          "-q:v",
          "2",
          join(out, path),
        ]);
        await artifact(path);
        keyframes.push({ path, at, chapter: chapter.id });
      }
      for (const suffix of [
        ".mp4",
        ".vtt",
        ".transcript.md",
        ".chapters.json",
        "-poster.jpg",
      ])
        await artifact(film.name + suffix);
      report.films.push({
        name,
        duration: Number(probe.format.duration),
        codec: video.codec_name,
        pixelFormat: video.pix_fmt,
        width: video.width,
        height: video.height,
        frameRate: video.avg_frame_rate,
        chapters: contiguous,
        audio: "none; burned captions and VTT",
        normalSpeed: true,
        keyframes,
      });
      await Promise.all(clips.map((path) => rm(path)));
    }
    await context.close();
    await writeFile(
      join(out, "edit-manifest.json"),
      JSON.stringify(
        {
          ...plan,
          editSHA256,
          inputs: [...selectedAssets].map((name) => {
            const asset = native.assets.get(name);
            return {
              path: name,
              sha256: asset.sha256,
              bytes: asset.bytes,
              actor: asset.actor,
              kind: asset.kind,
              capturedAt: asset.capturedAt,
              startedAt: asset.startedAt,
            };
          }),
        },
        null,
        2,
      ) + "\n",
    );
    await artifact("edit-manifest.json");
    const inputEdit = await readFile(args["--native-edit"]);
    assert.equal(
      sha256(inputEdit),
      editSHA256,
      "The reviewed edit changed during rendering.",
    );
    await writeFile(join(out, "native-edit.json"), inputEdit);
    await artifact("native-edit.json");
    await writeFile(
      join(out, "render-instructions.md"),
      "# Reproduce this exact native edit\n\nKeep the canonical native receipt, its original capture files and the reviewed input edit together. This output does not copy private session state or re-run the application.\n\nUse the source recipe in docs/platform/native-media.md. Pass the same independently selected native receipt SHA-256 and the original input edit; edit-manifest.json records resolved cuts, durations, source identities and input hashes. Rendering requires shared-host admission, an existing Playwright module/Chrome, ffmpeg and ffprobe. No dependency installation or provider call is performed.\n\nReview final encoded pixels, full caption visibility, normal playback, chapters, posters and source/qualification labels before publication.\n",
    );
    await artifact("render-instructions.md");
    for (const [path, digest] of Object.entries(rendererHashes))
      assert.equal(
        sha256(await readFile(join(workspace, path))),
        digest,
        "The media renderer source changed during encoding.",
      );
    report.status = "encoded-awaiting-human-pixel-and-playback-review";
  } catch (error) {
    report.status = "failed-unqualified";
    report.failure = String(error.message).slice(0, 500);
    throw error;
  } finally {
    try {
      await browser?.close();
    } finally {
      activeChild?.kill("SIGTERM");
      if (previousTMPDIR === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = previousTMPDIR;
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
      await rm(root, { recursive: true, force: true });
      await assert.rejects(lstat(root), { code: "ENOENT" });
      report.cleanup = {
        browserClosed: !browser || !browser.isConnected(),
        ownedTemporaryRootRemoved: true,
      };
      if (outputOwned) {
        const receiptName =
          report.status === "failed-unqualified"
            ? "failure-receipt.json"
            : "receipt.json";
        const bytes = JSON.stringify(report, null, 2) + "\n";
        await writeFile(join(out, receiptName), bytes);
        await writeFile(
          join(out, receiptName + ".sha256"),
          sha256(bytes) + "  " + receiptName + "\n",
        );
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        status: report.status,
        nativeReceiptSHA256: native.receiptSHA256,
        sources: native.sources,
        films: report.films,
        artifacts: report.artifacts,
        cleanup: report.cleanup,
      },
      null,
      2,
    ),
  );
}

// Actual local browser recordings. No installation, provider credentials or external media.
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { captionHTML } from "./media-captions.mjs";

if (
  process.argv
    .slice(2)
    .some((argument) =>
      /^--(?:native-|expect-native-|validate-only$|render$|admitted$)/.test(
        argument,
      ),
    )
) {
  const { nativeMediaCLI } = await import("./native-media.mjs");
  await nativeMediaCLI(process.argv.slice(2));
} else {
  const { runPlatformDemo } = await import("../../scripts/platform-demo.mjs");

  const run = promisify(execFile);
  const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const out = join(workspace, "output/platform/media");
  const modulePath = process.env.PLAYWRIGHT_MODULE;
  assert.ok(
    modulePath && modulePath.startsWith("/"),
    "Select an existing PLAYWRIGHT_MODULE absolute path.",
  );
  const ffmpeg = process.env.FFMPEG_PATH ?? "/opt/homebrew/bin/ffmpeg";
  const ffprobe = process.env.FFPROBE_PATH ?? "/opt/homebrew/bin/ffprobe";
  const guide = "http://127.0.0.1:4390/platform";
  const size = { width: 1600, height: 900 };
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const escape = (text) =>
    String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const stamp = (seconds) => {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const report = {
    schema: "composer.platform-media/1",
    deliveryScope:
      "Local excerpts; complete #221 overview and technical walkthrough remain pending.",
    createdAt: new Date().toISOString(),
    sourceSha: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: workspace,
      encoding: "utf8",
    }).trim(),
    guideURL: guide,
    viewport: size,
    videos: [],
    screenshots: [],
    browserErrors: [],
    consoleErrors: [],
    limitations: [
      "Actual local browser recording at normal speed; no narrated audio.",
      "Synthetic trusted-host admission; no enterprise SSO or fresh-user admission.",
      "Pinned Guestbook Worker fetch executes on Node + real local SQLite and filesystem media, not workerd.",
      "Actual StackView SSR uses a labelled local wrapper; full Astro composition routing is not exercised by the demo.",
      "Public guide is a local workerd build; source/release identities and production proof are separate.",
      "Policy explorer is a teaching example; vendor execution and Kubernetes are unqualified.",
    ],
  };
  let browser;
  const previousTMPDIR = process.env.TMPDIR;
  const root = await mkdtemp(join(tmpdir(), "composer-platform-media-"));
  try {
    // All child demo/browser/transcode staging remains inside this invocation's root.
    process.env.TMPDIR = root;
    await mkdir(out, { recursive: true });
    const { chromium } = await import(pathToFileURL(modulePath).href);
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      downloadsPath: join(root, "downloads"),
    });
    report.browser = await browser.version();
    report.ffmpeg = (await run(ffmpeg, ["-version"])).stdout.split("\n")[0];
    report.guideRuntimeMetadata = await (
      await fetch("http://127.0.0.1:4390/healthz")
    ).json();
    assert.match(report.guideRuntimeMetadata.revision, /^[a-f0-9]{40}$/);
    const face = (
      await readFile(join(workspace, "public/brand/space-latin-20261018.woff2"))
    ).toString("base64");
    const captions = await browser.newContext({
      viewport: { width: size.width, height: 156 },
      deviceScaleFactor: 1,
    });
    const captionPage = await captions.newPage();
    async function captionImage(name, heading, body) {
      await captionPage.setContent(captionHTML({ font: face, heading, body }));
      await captionPage.evaluate(() => document.fonts.ready);
      const path = join(root, name + ".png");
      await captionPage.screenshot({ path });
      return path;
    }
    const rawReceiptPath = join(out, "local-runtime.json");
    let runtime;
    const demo = await runPlatformDemo({
      onReady: async (current) => {
        runtime = current;
        const evidencePath = join(root, "read-only-evidence.html");
        const subset = {
          label: "READ-ONLY LOCAL RUN RECEIPT — NOT THE PRODUCT UI",
          composerSource: current.composerSource,
          guestbookSource: current.guestbookSource,
          boundaries: current.boundaries,
          checks: current.checks,
          operations: current.operations,
          export: current.export,
        };
        await writeFile(
          evidencePath,
          `<!doctype html><meta charset="utf-8"><title>Local programme receipt</title><style>body{margin:32px;background:#151b18;color:#f5f1e9;font:23px/1.5 ui-monospace,monospace}h1{font:26px system-ui;color:#ff9761}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Read-only local run receipt · evidence, not a product dashboard</h1><pre>${escape(JSON.stringify(subset, null, 2))}</pre>`,
        );
        const [a, b] = current.services;
        async function capture(name, segments) {
          const rawDir = join(root, name);
          await mkdir(rawDir);
          const context = await browser.newContext({
            viewport: size,
            deviceScaleFactor: 1,
            reducedMotion: "reduce",
            recordVideo: { dir: rawDir, size },
          });
          // A capture cannot accidentally leave the owned loopback system through an app link/script.
          await context.route("**/*", (route) => {
            const u = new URL(route.request().url());
            return ["http:", "https:"].includes(u.protocol) &&
              !["127.0.0.1", "localhost"].includes(u.hostname)
              ? route.abort()
              : route.continue();
          });
          const page = await context.newPage();
          page.on("pageerror", (error) =>
            report.browserErrors.push({
              name,
              message: error.message.slice(0, 400),
            }),
          );
          page.on("console", (message) => {
            if (message.type() === "error")
              report.consoleErrors.push({
                name,
                message: message.text().slice(0, 400),
              });
          });
          const events = [],
            start = Date.now();
          for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const began = (Date.now() - start) / 1000;
            await segment.action(page);
            await page.evaluate(() => document.fonts.ready);
            await wait(300);
            if (segment.check) await segment.check(page);
            const screenshot = join(
              out,
              `${name}-${String(i + 1).padStart(2, "0")}.png`,
            );
            if (segment.shot) {
              await page.screenshot({ path: screenshot });
              report.screenshots.push({
                file: screenshot.split("/").pop(),
                sha256: hash(await readFile(screenshot)),
              });
            }
            const remaining =
              segment.seconds * 1000 - (Date.now() - start - began * 1000);
            if (remaining > 0) await wait(remaining);
            events.push({
              start: began,
              end: (Date.now() - start) / 1000,
              chapter: segment.chapter,
              heading: segment.heading,
              caption: segment.caption,
              frame: await captionImage(
                `${name}-${i}`,
                segment.heading,
                segment.caption,
              ),
            });
          }
          const video = page.video();
          await context.close();
          const raw = await video.path();
          for (let i = 0; i + 1 < events.length; i++)
            events[i].end = events[i + 1].start;
          const duration = events.at(-1).end;
          const concat = join(root, name + "-captions.txt");
          await writeFile(
            concat,
            events
              .map(
                (event) =>
                  `file '${event.frame}'\nduration ${(event.end - event.start).toFixed(3)}`,
              )
              .join("\n") + `\nfile '${events.at(-1).frame}'\n`,
          );
          const bars = join(root, name + "-caption-bars.mp4");
          await run(
            ffmpeg,
            [
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
              "-vf",
              "fps=30",
              "-c:v",
              "libx264",
              "-preset",
              "fast",
              "-crf",
              "18",
              "-pix_fmt",
              "yuv420p",
              bars,
            ],
            { maxBuffer: 200000 },
          );
          const metadata = join(root, name + "-metadata.txt");
          await writeFile(
            metadata,
            ";FFMETADATA1\ntitle=App Composer local platform " +
              name +
              "\ncomment=Actual browser recording; scope and simulations disclosed in captions.\n" +
              events
                .map(
                  (event) =>
                    `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(event.start * 1000)}\nEND=${Math.round(event.end * 1000)}\ntitle=${event.chapter}`,
                )
                .join("\n"),
          );
          const destination = join(out, name + ".mp4");
          await run(
            ffmpeg,
            [
              "-hide_banner",
              "-loglevel",
              "error",
              "-y",
              "-i",
              raw,
              "-i",
              bars,
              "-i",
              metadata,
              "-filter_complex",
              "[0:v][1:v]overlay=0:H-h:shortest=1,format=yuv420p[v]",
              "-map",
              "[v]",
              "-map_metadata",
              "2",
              "-c:v",
              "libx264",
              "-preset",
              "fast",
              "-crf",
              "20",
              "-an",
              "-t",
              duration.toFixed(3),
              "-movflags",
              "+faststart",
              destination,
            ],
            { maxBuffer: 200000 },
          );
          await writeFile(
            join(out, name + ".vtt"),
            "WEBVTT\n\n" +
              events
                .map(
                  (event, i) =>
                    `${i + 1}\n${stamp(event.start)} --> ${stamp(event.end)}\n${event.heading}\n${event.caption}\n`,
                )
                .join("\n"),
          );
          const probe = JSON.parse(
            (
              await run(ffprobe, [
                "-v",
                "error",
                "-show_format",
                "-show_streams",
                "-show_chapters",
                "-of",
                "json",
                destination,
              ])
            ).stdout,
          );
          assert.equal(probe.streams[0].width, size.width);
          assert.equal(probe.streams[0].height, size.height);
          assert.equal(probe.streams[0].codec_name, "h264");
          assert.ok(Number(probe.format.duration) >= duration - 0.2);
          const indices = [0, Math.floor(events.length / 2), events.length - 1];
          const keyframes = [];
          for (const i of indices) {
            const path = join(out, `${name}-keyframe-${i + 1}.jpg`),
              at = Math.min(
                duration - 0.2,
                events[i].start +
                  Math.min(2, (events[i].end - events[i].start) / 2),
              );
            await run(ffmpeg, [
              "-hide_banner",
              "-loglevel",
              "error",
              "-y",
              "-ss",
              at.toFixed(3),
              "-i",
              destination,
              "-frames:v",
              "1",
              "-q:v",
              "2",
              path,
            ]);
            keyframes.push({
              file: path.split("/").pop(),
              at,
              sha256: hash(await readFile(path)),
            });
          }
          report.videos.push({
            file: name + ".mp4",
            sha256: hash(await readFile(destination)),
            bytes: (await stat(destination)).size,
            duration: Number(probe.format.duration),
            codec: probe.streams[0].codec_name,
            width: size.width,
            height: size.height,
            frameRate: probe.streams[0].avg_frame_rate,
            audio: "none; burned captions and VTT",
            chapters: probe.chapters.map((chapter) => ({
              start: chapter.start_time,
              end: chapter.end_time,
              title: chapter.tags.title,
            })),
            keyframes,
          });
        }
        const goto = (url) => (page) =>
          page.goto(url, { waitUntil: "networkidle" });
        const section = (selector) => async (page) => {
          await page.goto(guide, { waitUntil: "networkidle" });
          await page.locator(selector).scrollIntoViewIfNeeded();
        };
        await capture("overview", [
          {
            seconds: 6,
            chapter: "A governed starting point",
            heading: "APP COMPOSER · INTERNAL PLATFORM",
            caption:
              "Approved application paths for teams. Local guide artifact " +
              report.guideRuntimeMetadata.revision.slice(0, 7) +
              "; demo source " +
              runtime.composerSource.slice(0, 7) +
              ".",
            action: goto(guide),
            shot: true,
          },
          {
            seconds: 6,
            chapter: "First supported scope",
            heading: "FIRST SUPPORTED PATH",
            caption:
              "Scoped Guestbook and published stack on existing app infrastructure; no new Worker or database per request.",
            action: section("#readiness"),
            shot: true,
          },
          {
            seconds: 7,
            chapter: "Atlas publication",
            heading: "ATLAS · VERIFIED LOCAL RESULT",
            caption:
              "Actual StackView React rendering. Admission and the local page wrapper are simulated.",
            action: goto(a.localPage),
            check: async (page) =>
              assert.match(
                await page.locator("h1").innerText(),
                /Atlas recovered/,
              ),
            shot: true,
          },
          {
            seconds: 7,
            chapter: "Atlas application",
            heading: "ATLAS · UPDATED AND RECOVERED",
            caption:
              "Actual pinned Guestbook Worker fetch on Node + SQLite. Synthetic content; no workerd or production claim.",
            action: goto(a.localApp),
            check: async (page) =>
              assert.match(
                await page.locator("h1").innerText(),
                /Atlas recovered/,
              ),
            shot: true,
          },
          {
            seconds: 6,
            chapter: "Beacon stays independent",
            heading: "BEACON · UNAFFECTED",
            caption:
              "Its separate resource keeps its original configuration while Atlas updates and recovers.",
            action: goto(b.localApp),
            check: async (page) =>
              assert.match(
                await page.locator("h1").innerText(),
                /Fictional Beacon/,
              ),
            shot: true,
          },
          {
            seconds: 6,
            chapter: "Policy explanation",
            heading: "POLICY EXPLORER · TEACHING EXAMPLE",
            caption:
              "Changing teams produces Denied in this explanation. Actual API denial is recorded separately in the run receipt.",
            action: async (page) => {
              await page.goto(guide, { waitUntil: "networkidle" });
              await page
                .locator("[data-policy-explorer]")
                .scrollIntoViewIfNeeded();
              await page
                .locator('select[name="membership"]')
                .selectOption("other");
            },
            check: async (page) =>
              assert.equal(
                await page.locator("[data-decision]").innerText(),
                "Denied",
              ),
            shot: true,
          },
        ]);
        await capture("technical-walkthrough", [
          {
            seconds: 9,
            chapter: "1 Scope and source",
            heading: "1 / SCOPE AND SOURCE",
            caption:
              "Guide artifact " +
              report.guideRuntimeMetadata.revision.slice(0, 7) +
              "; demo " +
              runtime.composerSource.slice(0, 7) +
              "; Guestbook " +
              runtime.guestbookSource.slice(0, 7) +
              ". Admission uses synthetic host actors.",
            action: section("#readiness"),
            shot: false,
          },
          {
            seconds: 9,
            chapter: "2 Published application reference",
            heading: "2 / PUBLISHED APPLICATION REFERENCE",
            caption:
              "The actual immutable stack document names Atlas’s exact app resource and configuration.",
            action: goto(a.localPage),
            shot: false,
          },
          {
            seconds: 9,
            chapter: "3 Actual application and media",
            heading: "3 / ACTUAL APPLICATION AND MEDIA",
            caption:
              "Real Worker code reads its SQLite records and filesystem media. The postcard is a labelled synthetic pixel fixture.",
            action: goto(a.localApp),
            shot: false,
          },
          {
            seconds: 9,
            chapter: "4 Independent second team",
            heading: "4 / INDEPENDENT SECOND TEAM",
            caption:
              "Beacon remains on its original resource and configuration. Both portal and app API cross-team denials are tested.",
            action: goto(b.localApp),
            shot: false,
          },
          {
            seconds: 10,
            chapter: "5 Inspectable runtime receipt",
            heading: "5 / INSPECTABLE RUNTIME RECEIPT",
            caption:
              "Read-only evidence from this run. It is not an administration dashboard and grants no authority.",
            action: goto(pathToFileURL(evidencePath).href),
            shot: true,
          },
          {
            seconds: 9,
            chapter: "6 Unqualified targets stop",
            heading: "6 / UNQUALIFIED TARGETS STOP",
            caption:
              "Teaching example: selecting Kubernetes gives Unsupported. No EKS, AKS, GKE or vendor execution is claimed.",
            action: async (page) => {
              await page.goto(guide, { waitUntil: "networkidle" });
              await page
                .locator("[data-policy-explorer]")
                .scrollIntoViewIfNeeded();
              await page
                .locator('select[name="runtime"]')
                .selectOption("kubernetes");
            },
            check: async (page) =>
              assert.equal(
                await page.locator("[data-decision]").innerText(),
                "Unsupported",
              ),
            shot: false,
          },
          {
            seconds: 10,
            chapter: "7 Reconcile the committed operation",
            heading: "7 / RECONCILE THE COMMITTED OPERATION",
            caption:
              "One activation committed before its acknowledgement was lost. Explicit resumption reconciled the durable receipt; one dispatch.",
            action: async (page) => {
              await page.goto(pathToFileURL(evidencePath).href, {
                waitUntil: "load",
              });
              await page
                .getByRole("heading", {
                  name: "Read-only local run receipt · evidence, not a product dashboard",
                  exact: true,
                })
                .waitFor();
              await page.evaluate(() =>
                window.scrollTo(0, document.documentElement.scrollHeight),
              );
            },
            shot: true,
          },
          {
            seconds: 9,
            chapter: "8 Qualification boundary",
            heading: "8 / QUALIFICATION BOUNDARY",
            caption:
              "Public guide and local app proof are distinct. Production, enterprise SSO, vendor delivery and full recovery require their own evidence.",
            action: section("#assurance"),
            shot: false,
          },
        ]);
        await captions.close();
      },
    });
    await writeFile(rawReceiptPath, JSON.stringify(demo, null, 2) + "\n");
    report.runtimeReceipt = {
      file: "local-runtime.json",
      sha256: hash(await readFile(rawReceiptPath)),
      source: runtime.composerSource,
      guestbook: runtime.guestbookSource,
      authoredSourceHashes: runtime.authoredSourceHashes,
      ownedTemporaryRootRemoved: demo.ownedTemporaryRootRemoved,
    };
    assert.equal(demo.ownedTemporaryRootRemoved, true);
  } catch (error) {
    report.failure = { name: error.name, message: error.message.slice(0, 500) };
    throw error;
  } finally {
    try {
      await browser?.close();
    } finally {
      if (previousTMPDIR === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = previousTMPDIR;
      await rm(root, { recursive: true, force: true });
      await assert.rejects(stat(root), { code: "ENOENT" });
      report.ownedTemporaryRootRemoved = true;
      if (report.failure)
        await writeFile(
          join(out, "failure-receipt.json"),
          JSON.stringify(report, null, 2) + "\n",
        );
    }
  }
  await writeFile(
    join(out, "receipt.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  process.stdout.write(
    JSON.stringify(
      {
        source: report.sourceSha,
        videos: report.videos,
        browserErrors: report.browserErrors.length,
        consoleErrors: report.consoleErrors.length,
        ownedTemporaryRootRemoved: report.ownedTemporaryRootRemoved,
      },
      null,
      2,
    ) + "\n",
  );
}

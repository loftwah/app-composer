import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const composer = "https://composer.loftwah.com";
const direct = new Map(
  Object.entries({
    "studio-social-kit": composer + "/media-studio/watch/studio-social-kit.mp4",
    "studio-teaser":
      composer + "/media-studio/watch/media-studio-teaser-recut.mp4",
    "take-it-with-you":
      composer + "/brand/campaign/take-it-with-you-20261118.mp4",
    "studio-showcase":
      composer + "/media-studio/watch/media-studio-showcase.mp4",
    "pippa-clip":
      composer + "/media-studio/demos/pippa-clip-workflow-20261115.mp4",
    "after-hours-trim":
      composer + "/media-studio/demos/after-hours-audio-trim-20261115.mp4",
    "setup-to-software":
      "https://woodhouse.loftwah.com/share/app-composer/app-composer-20261014.mp4",
    "creator-hub":
      composer + "/creator-hub/social-walkthrough-20261112-1080p.mp4",
  }),
);
const source = ({ id, href }) =>
  direct.get(id) ??
  (/^https:\/\/media\.loftwah\.com\/p\/[A-Za-z0-9_-]{1,80}$/.test(href)
    ? href + "/media"
    : null);

export async function reviewShareFilms({ films, evaluate, directory, output }) {
  if (films.length > 40)
    throw Error("Use the bounded public Share film catalogue.");
  const unique = new Map(
    films.flatMap((film) => {
      const url = source(film);
      return url ? [[url, film]] : [];
    }),
  );
  const entries = [...unique.entries()];
  const outputs = new Map();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(5, entries.length) }, async () => {
      let index;
      while ((index = next++) < entries.length) {
        const [url, film] = entries[index];
        try {
          const file = join(directory, `opening-${index}.mp4`);
          await run(
            "ffmpeg",
            [
              "-v",
              "error",
              "-nostdin",
              "-rw_timeout",
              "6000000",
              "-protocol_whitelist",
              "https,tls,tcp,httpproxy",
              "-i",
              url,
              "-t",
              "6",
              "-vf",
              "scale=480:480:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=12",
              "-c:v",
              "libx264",
              "-preset",
              "fast",
              "-crf",
              "31",
              "-c:a",
              "aac",
              "-b:a",
              "48k",
              "-threads",
              "2",
              "-movflags",
              "+faststart",
              file,
            ],
            { timeout: 22000, maxBuffer: 64000 },
          );
          const bytes = await readFile(file);
          if (!bytes.length || bytes.length > 2 * 1024 * 1024)
            throw Error("Invalid opening sample size.");
          const result = await evaluate(
            {
              title: film.title,
              evidence:
                "Six-second public opening, or full shorter clip. Assess this excerpt. Do not infer rights or later footage.",
            },
            {
              hook: {
                type: "choice",
                instructions:
                  "What is the most useful editorial intervention for a 2026 phone-feed opener?",
                criteria: {
                  use: "A clear compelling opening; review the rest, caption and destination",
                  faster: "Lead with the subject or payoff sooner",
                  context:
                    "Add simple readable context so the viewer knows why to stay",
                  captions: "Improve on-screen legibility or captions",
                  reference: "Keep as a reference or chapter in a longer story",
                },
              },
              fit: {
                type: "score",
                instructions:
                  "Rate only this opening for a new viewer who has not seen its product.",
                criteria: [
                  "Unclear",
                  "Interesting fragment",
                  "Needs adaptation",
                  "Clear opening",
                  "Clear and distinctive",
                ],
              },
            },
            undefined,
            [`data:video/mp4;base64,${bytes.toString("base64")}`],
          );
          outputs.set(url, {
            status: "reviewed",
            sampleHash: createHash("sha256").update(bytes).digest("hex"),
            hook: result.hook,
            fit: result.fit,
          });
        } catch {
          outputs.set(url, { status: "unavailable" });
        }
      }
    }),
  );
  const items = films.map((film) => {
    const url = source(film);
    return {
      ...film,
      source: url,
      ...(outputs.get(url) ?? { status: "unavailable" }),
    };
  });
  const receipt = {
    evaluatedAt: new Date().toISOString(),
    openingSeconds: 6,
    unique: unique.size,
    items,
  };
  await writeFile(
    join(output, "clef-film-openings.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      entries: items.length,
      unique: unique.size,
      reviewed: items.filter((x) => x.status === "reviewed").length,
    }),
  );
}

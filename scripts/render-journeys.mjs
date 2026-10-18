import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = "public/diagrams",
  dimensions = JSON.parse(
    readFileSync(directory + "/journey-dimensions.json", "utf8"),
  );
const sources = JSON.parse(
  readFileSync(directory + "/journey-sources.json", "utf8"),
);
const supported = Object.keys(sources);
const kinds = process.argv.length > 2 ? process.argv.slice(2) : supported;
if (kinds.some((kind) => !supported.includes(kind)))
  throw Error("Choose an existing source-owned diagram.");
const temporary = mkdtempSync(join(tmpdir(), "composer-diagram-font-"));
try {
  const font = join(temporary, "SpaceGrotesk.ttf");
  copyFileSync("src/assets/fonts/SpaceGrotesk.ttf.bin", font);
  for (const kind of kinds) {
    dimensions[kind] = {};
    for (const layout of ["desktop", "mobile"]) {
      const stem = sources[kind] + (layout === "mobile" ? "-mobile" : "");
      const source = readFileSync(directory + "/" + stem + ".d2", "utf8");
      for (const theme of ["dark", "light"]) {
        let input = source;
        if (theme === "light")
          for (const [from, to] of [
            ["#17181b", "#faf9f7"],
            ["#23252a", "#efeeea"],
            ["#f2f3f5", "#22252b"],
            ["#ff9b55", "#a63d08"],
          ])
            input = input.replaceAll(from, to);
        // The existing licensed local Space face is bundled, with no asset fetches.
        const transit = ["composer", "composition", "activity"].includes(kind);
        const fonts = transit
          ? [
              "--font-regular",
              font,
              "--font-bold",
              font,
              "--font-semibold",
              font,
              "--font-italic",
              font,
            ]
          : [];
        const svg = execFileSync(
          "d2",
          [
            "--layout=dagre",
            "--bundle=true",
            "--sketch=false",
            "--theme=0",
            "--pad",
            transit ? "24" : "20",
            ...fonts,
            "-",
            "-",
          ],
          { input, encoding: "utf8", maxBuffer: 1024 * 1024 },
        );
        writeFileSync(directory + "/" + stem + "-" + theme + ".svg", svg);
        const box = svg
          .match(/viewBox="([^"]+)"/)?.[1]
          .split(" ")
          .map(Number);
        if (
          !box ||
          box.length !== 4 ||
          box.some((value) => !Number.isFinite(value))
        )
          throw Error("D2 drawing dimensions unavailable");
        dimensions[kind][layout] = {
          width: Math.round(box[2]),
          height: Math.round(box[3]),
        };
      }
    }
  }
  writeFileSync(
    directory + "/journey-dimensions.json",
    JSON.stringify(dimensions, null, 2) + "\n",
  );
  console.log(
    "Rendered selected journeys for phone/desktop and saved dark/light themes.",
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

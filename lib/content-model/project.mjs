// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
// Supported new-project recipe. Model JSON never becomes executable source.
import { Buffer } from "node:buffer";
import { lstatSync, realpathSync } from "node:fs";
import { resolve, dirname, basename, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validateContentModel, emdashSeed } from "./index.mjs";
import { collectionFilter } from "./site-template/src/lib/collection.mjs";
import { selectedFile } from "../get-ready/project-files.mjs";
import { childDirectory, mutate } from "../get-ready/project-write.mjs";
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const templateFiles = [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "astro.config.mjs",
    "wrangler.jsonc",
    "tsconfig.json",
    ".gitignore",
    "README.md",
    "AGENTS.md",
    "PRODUCT.md",
    "DESIGN.md",
    "UNSLOP.md",
    "scripts/deploy.mjs",
    "scripts/build-source.mjs",
    "tsconfig.source.json",
    "tsconfig.worker.json",
    "tsconfig.browser.json",
    ".prettierignore",
    "tests/application.test.mjs",
    "src/worker.ts",
    "src/lib/editor-compatibility.mjs",
    "src/lib/editor-fields.tsx",
    "src/lib/number-input.mjs",
    "src/live.config.ts",
    "src/pages/index.astro",
    "src/pages/entries/[id]/index.astro",
    "src/layouts/ContentLayout.astro",
    "src/components/AppLauncher.astro",
    "src/components/ContentFields.astro",
    "src/lib/entry.mjs",
    "src/lib/collection.mjs",
    "src/components/FieldValue.astro",
    "src/components/ScalarValue.astro",
    "src/components/CollectionPages.astro",
    "src/styles/site.css",
    "src/pages/healthz.ts",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function capture(root, name) {
    const file = selectedFile(root, name, 1048576);
    if (file.state !== "present")
        throw Error("A reviewed project input is unavailable or changed. No existing project was replaced.");
    return file;
}
function bound(path) {
    let cursor = path;
    const entries = [];
    while (true) {
        const s = lstatSync(cursor);
        if (!s.isDirectory() || s.isSymbolicLink())
            throw Error("Choose an existing unlinked parent folder.");
        entries.push({ path: cursor, dev: s.dev, ino: s.ino });
        const parent = dirname(cursor);
        if (parent === cursor)
            break;
        cursor = parent;
    }
    const check = () => {
        for (const entry of entries) {
            const stat = lstatSync(entry.path);
            if (!stat.isDirectory() ||
                stat.isSymbolicLink() ||
                stat.dev !== entry.dev ||
                stat.ino !== entry.ino)
                throw Error("The selected project parent changed. Prepared files are retained.");
        }
    };
    check.identity = { dev: entries[0].dev, ino: entries[0].ino };
    return check;
}
export function contentProjectFiles(input) {
    const model = validateContentModel(input), files = {}, sources = {}, captures = [];
    const add = (from, to) => {
        const captured = capture(repository, from);
        files[to] = captured.data;
        sources[from] = captured.sha256;
        captures.push({ from, sha256: captured.sha256 });
    };
    for (const name of templateFiles)
        add("lib/content-model/site-template/" + name, name);
    for (const name of [
        "collection",
        "entry",
        "number-input",
        "editor-compatibility",
    ])
        for (const suffix of [".mts", ".d.mts"])
            add("lib/content-model/site-template/src/lib/" + name + suffix, "src/lib/" + name + suffix);
    add("lib/content-model/index.mts", "src/lib/content-model.mts");
    add("lib/content-model/calendar-date.mts", "src/lib/calendar-date.mts");
    add("lib/content-model/index.mjs", "src/lib/content-model.mjs");
    add("lib/content-model/index.d.mts", "src/lib/content-model.d.mts");
    add("lib/content-model/calendar-date.mjs", "src/lib/calendar-date.mjs");
    add("lib/content-model/calendar-date.d.mts", "src/lib/calendar-date.d.mts");
    add("LICENSE", "LICENSE");
    add("public/brand/composer-icon-20261022-32.png", "public/brand/composer-icon-20261022-32.png");
    add("public/brand/composer-icon-20261022-96.png", "public/brand/composer-icon-20261022-96.png");
    add("public/brand/composer-icon-20261022-180.png", "public/brand/composer-icon-20261022-180.png");
    add("public/brand/composer-icon-20261022-512.png", "public/brand/composer-icon-20261022-512.png");
    add("public/brand/space-latin-20261018.woff2", "public/brand/space-latin-20261018.woff2");
    add("public/brand/OFL-Space-Grotesk.txt", "public/brand/OFL-Space-Grotesk.txt");
    for (const name of [
        "launcher.js",
        "launcher.css",
        ...["linkarooie", "herethere", "linkcheck", "hello", "carryforward"].map((id) => "apps/" + id + "-small-20261018.webp"),
    ])
        add("public/brand/" + name, "public/brand/" + name);
    for (const name of [
        "src/browser/launcher.ts",
        "scripts/launcher-assets.mjs",
        "tsconfig.launcher.json",
    ])
        add(name, name);
    const portableSeed = emdashSeed(model), filter = collectionFilter(model);
    const seed = {
        ...portableSeed,
        collections: portableSeed.collections.map((collection) => ({
            ...collection,
            fields: collection.fields.map((field) => ({
                ...field,
                ...(filter?.key === field.slug ? { indexed: true } : {}),
                ...(field.type === "integer"
                    ? { widget: "composer-content-fields:integer" }
                    : model.fields.find((item) => item.key === field.slug)?.type ===
                        "date"
                        ? { widget: "composer-content-fields:date" }
                        : {}),
            })),
        })),
    };
    files["src/content-model.json"] = Buffer.from(JSON.stringify(model, null, 2) + "\n");
    files["seed/seed.json"] = Buffer.from(JSON.stringify(seed, null, 2) + "\n");
    const provenance = {
        schema: "app-composer.content-project",
        version: 1,
        reviewed: "2026-10-18",
        repository: "https://github.com/loftwah/app-composer",
        collection: model.collection,
        sourceFiles: sources,
        files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, hash(bytes)])),
        deployed: false,
    };
    files["composer-project.json"] = Buffer.from(JSON.stringify(provenance, null, 2) + "\n");
    return {
        files,
        provenance,
        recheck: () => {
            for (const file of captures)
                if (capture(repository, file.from).sha256 !== file.sha256)
                    throw Error("Project template source changed. Prepared files are retained for inspection.");
        },
    };
}
export function createContentProject({ model, destination, ...unknown } = {}) {
    if (Object.keys(unknown).length ||
        typeof destination !== "string" ||
        !isAbsolute(destination) ||
        resolve(destination) !== destination ||
        destination.includes("\0") ||
        destination === dirname(destination))
        throw Error("Choose one explicit absent project directory.");
    const parent = dirname(destination);
    if (realpathSync(parent) !== parent)
        throw Error("Choose the canonical, unlinked existing parent folder.");
    const check = bound(parent), { files, provenance, recheck } = contentProjectFiles(model);
    recheck();
    check();
    const rootIdentity = childDirectory(parent, check.identity, basename(destination), true), directories = new Map([["", rootIdentity]]);
    const ensure = (relative) => {
        if (directories.has(relative))
            return directories.get(relative);
        const parentRelative = dirname(relative) === "." ? "" : dirname(relative), identity = childDirectory(join(destination, parentRelative), ensure(parentRelative), basename(relative), true);
        directories.set(relative, identity);
        return identity;
    };
    const groups = new Map();
    for (const [name, bytes] of Object.entries(files)) {
        const parent = dirname(name) === "." ? "" : dirname(name), group = groups.get(parent) ?? [];
        group.push({
            name: basename(name),
            text: bytes.toString("base64"),
            encoding: "base64",
        });
        groups.set(parent, group);
    }
    for (const [relative, group] of groups) {
        check();
        recheck();
        const identity = ensure(relative);
        mutate(join(destination, relative), identity, {
            operation: "files",
            files: group,
        });
    }
    check();
    recheck();
    for (const [relative, identity] of directories) {
        const current = lstatSync(join(destination, relative));
        if (!current.isDirectory() ||
            current.isSymbolicLink() ||
            current.dev !== identity.dev ||
            current.ino !== identity.ino)
            throw Error("Project output changed. Files are retained for inspection.");
    }
    for (const [name, bytes] of Object.entries(files)) {
        const actual = selectedFile(destination, name, 1048576);
        if (actual.state !== "present" || actual.sha256 !== hash(bytes))
            throw Error("Project output could not be verified. Files are retained for inspection.");
    }
    check();
    for (const [relative, identity] of directories) {
        const current = lstatSync(join(destination, relative));
        if (!current.isDirectory() ||
            current.isSymbolicLink() ||
            current.dev !== identity.dev ||
            current.ino !== identity.ino)
            throw Error("Project output changed during final verification.");
    }
    return {
        state: "project-created",
        destination,
        collection: provenance.collection,
        files: Object.keys(files).length,
        dependenciesInstalled: false,
        agentSkillsVerified: false,
        deployed: false,
        next: "Review the independent source and current agent guidance. Prepare missing skills without duplicates, install the pinned lockfile, run locally and verify native editing/publication. A public deployment needs its actual project/account/domain/auth/storage/cost review.",
    };
}

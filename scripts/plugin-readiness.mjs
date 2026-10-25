// Offline inspection only: no config evaluation, network, credentials or writes.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const docs = "https://docs.emdashcms.com/deployment/plugin-sandbox/";

export function evaluatePluginReadiness(input) {
  const checks = [
    ["emdash", input.emdash === "1.3.1", "Reviewed EmDash 1.3.1 pin"],
    [
      "adapter",
      input.adapter === "1.3.1",
      "Reviewed Cloudflare adapter 1.3.1 pin",
    ],
    ["database", input.database, "Selected environment has D1 binding DB"],
    ["media", input.media, "Selected environment has R2 binding MEDIA"],
    ["bridge", input.bridge, "Worker entry exports PluginBridge"],
    ["registry", input.registry, "Explicit native registry configuration"],
    ["runner", input.runner, "Explicit native sandboxRunner configuration"],
    [
      "loader",
      input.loader,
      "Selected environment has Worker Loader binding LOADER",
    ],
  ].map(([id, present, label]) => ({
    id,
    state: present ? "declared" : "missing",
    label,
  }));
  const unavailable = checks.some(
    (check) =>
      ["emdash", "adapter", "database", "media", "bridge"].includes(check.id) &&
      check.state === "missing",
  );
  const state = unavailable
    ? "unavailable"
    : !input.registry
      ? "not-configured"
      : !input.runner
        ? "browse-only"
        : !input.loader
          ? "needs-binding"
          : "needs-provider-and-target-evidence";
  return {
    schemaVersion: 1,
    environment: input.environment,
    state,
    checks,
    entitlement: "unknown",
    isolatedTarget: "unverified",
    ownerSession: "unverified",
    lifecycle: "not-tested",
    installationReady: false,
    note: "Declarations are source observations, not runtime/provider proof. No isolated target or entitlement is inferred. No installation was attempted.",
    next: unavailable
      ? "Repair the missing local prerequisites in an isolated target."
      : "Select an authorised isolated target, verify Workers Paid / Dynamic Workers entitlement and exercise EmDash's native lifecycle with a reviewed exact release.",
    docs,
  };
}

export function inspectPluginReadiness(projectRoot, environment) {
  if (!["production", "preview"].includes(environment))
    throw Error("Select --environment production or --environment preview.");
  const pkg = JSON.parse(
    readFileSync(resolve(projectRoot, "package.json"), "utf8"),
  );
  const configText = readFileSync(
    resolve(projectRoot, "wrangler.jsonc"),
    "utf8",
  );
  const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", configText);
  if (parsed.error) throw Error("Wrangler configuration is not valid JSONC.");
  const config = parsed.config;
  // Cloudflare resource bindings are not inherited by a named environment.
  const selected =
    environment === "production" ? config : config.env?.[environment];
  if (!selected) throw Error("The selected environment does not exist.");
  const astro = ts.createSourceFile(
    "astro.config.mjs",
    readFileSync(resolve(projectRoot, "astro.config.mjs"), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  let runner = false,
    registry = false;
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "emdash"
    ) {
      const options = node.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        for (const property of options.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const name = property.name.getText(astro).replaceAll(/["']/g, "");
          // Non-null literal configuration is evidence of a declaration only.
          const configured = !["false", "null", "undefined"].includes(
            property.initializer.getText(astro),
          );
          if (name === "sandboxRunner") runner = configured;
          if (name === "registry") registry = configured;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(astro);
  const worker = readFileSync(resolve(projectRoot, config.main), "utf8");
  return evaluatePluginReadiness({
    environment,
    emdash: pkg.dependencies?.emdash,
    adapter: pkg.dependencies?.["@emdash-cms/cloudflare"],
    database:
      selected.d1_databases?.some((binding) => binding.binding === "DB") ===
      true,
    media:
      selected.r2_buckets?.some((binding) => binding.binding === "MEDIA") ===
      true,
    loader:
      selected.worker_loaders?.some(
        (binding) => binding.binding === "LOADER",
      ) === true,
    bridge:
      /import[^;]*\bPluginBridge\b[^;]*from\s*["']@emdash-cms\/cloudflare\/worker["']/.test(
        worker,
      ) && /export\s*\{[^}]*\bPluginBridge\b[^}]*\}/.test(worker),
    runner,
    registry,
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (
      args.some(
        (arg, index) =>
          !["--json", "--environment", "production", "preview"].includes(arg) ||
          (["production", "preview"].includes(arg) &&
            args[index - 1] !== "--environment"),
      )
    )
      throw Error("Use --environment production|preview [--json].");
    const environment = args[args.indexOf("--environment") + 1];
    const report = inspectPluginReadiness(root, environment);
    console.log(
      args.includes("--json")
        ? JSON.stringify(report, null, 2)
        : `${report.environment}: ${report.state}\n${report.checks.map((check) => `${check.state}: ${check.label}`).join("\n")}\n${report.note}\n${report.next}\n${docs}`,
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Readiness inspection failed.",
    );
    process.exitCode = 1;
  }
}

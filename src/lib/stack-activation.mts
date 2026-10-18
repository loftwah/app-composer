// Safe activation for a stack's app-owned configuration (#114/#115).
//
// A stack stores only declared, validated configuration. Applying that
// configuration is a separate, explicit action that writes through the app's
// own ownership boundary (`POST /api/config`), verifies the app's live source
// first and verifies the response afterwards. Applying never creates an
// instance and never rewrites a publication: each app is applied one at a time,
// a failure leaves that app's previous configuration in place, and later apps
// are left untouched. The caller decides what to do with a partial result.
import {
  appSettings,
  validateConfigurationPatch,
  type AppSource,
} from "./app-settings.mjs";
import {
  STACK_APPS,
  declaredConfig,
  normaliseStack,
  StackError,
} from "./stacks.mjs";
import {
  applyConfiguration,
  verifyConfigurationTarget,
} from "./app-configuration.mjs";
import type { ConfigurationOptions } from "./app-configuration.mjs";

interface EntryBase {
  instanceId: string;
  app: string;
  name: string;
}
export type ActivationEntry =
  | (EntryBase & { configurable: false; reason: string })
  | (EntryBase & {
      configurable: true;
      source: AppSource;
      settings: {
        key: string;
        label: string;
        value: string;
        overridden: boolean;
      }[];
      configuration: Record<string, string>;
      url: string;
    });
export type SourceStatus = { app: string; name: string } & (
  | { status: "unavailable" | "changed"; message: string }
  | { status: "current"; source: AppSource }
);

const owned = (stack: unknown) =>
  normaliseStack(stack).instances.filter(
    (instance) => instance.binding.mode === "own",
  );

// The exact settings a stack asks an app to hold, completed with the app's own
// declared defaults so the request is a complete, declared configuration.
export function activationEntries(stack: unknown): ActivationEntry[] {
  return owned(stack).map((instance) => {
    const model = Object.hasOwn(appSettings, instance.app)
      ? appSettings[instance.app]
      : undefined;
    const app = STACK_APPS[instance.app];
    if (!model) {
      return {
        instanceId: instance.id,
        app: instance.app,
        name: app.name,
        configurable: false,
        reason:
          app.name +
          " does not publish a configuration contract, so this instance can only reuse what the app already holds.",
      };
    }
    const declared = declaredConfig(instance.app) ?? [];
    const effective = Object.fromEntries(
      declared.map((field) => [
        field.key,
        instance.config[field.key] ?? field.default,
      ]),
    );
    try {
      validateConfigurationPatch(effective, instance.app);
    } catch (error) {
      return {
        instanceId: instance.id,
        app: instance.app,
        name: app.name,
        configurable: false,
        reason:
          error instanceof Error
            ? error.message
            : "Check the instance settings.",
      };
    }
    return {
      instanceId: instance.id,
      app: instance.app,
      name: app.name,
      configurable: true,
      source: { ...model.source },
      settings: declared.map((field) => ({
        key: field.key,
        label: field.label,
        value: effective[field.key],
        overridden: Object.hasOwn(instance.config, field.key),
      })),
      configuration: effective,
      url: "https://" + instance.app + ".loftwah.com",
    };
  });
}

// A readable summary for the workspace: which instances have something to
// apply, which have nothing of their own and which reuse another instance.
export function activationSummary(stack: unknown) {
  const document = normaliseStack(stack);
  return {
    entries: activationEntries(document),
    shared: document.instances
      .filter((instance) => instance.binding.mode === "shared")
      .map((instance) => ({
        instanceId: instance.id,
        app: instance.app,
        name: STACK_APPS[instance.app].name,
        shareOf: instance.binding.shareOf,
      })),
  };
}

// Read-only maintenance check. Confirms each independently configured app is
// serving the exact source this stack was composed against. It never writes and
// never supplies a credential.
export async function stackSourceStatus(
  stack: unknown,
  { request = fetch }: Pick<ConfigurationOptions, "request"> = {},
): Promise<SourceStatus[]> {
  const results: SourceStatus[] = [];
  for (const entry of activationEntries(stack)) {
    if (!entry.configurable) {
      results.push({
        app: entry.app,
        name: entry.name,
        status: "unavailable",
        message: entry.reason,
      });
      continue;
    }
    try {
      await verifyConfigurationTarget(
        { id: entry.app, url: entry.url, source: entry.source },
        request,
      );
      results.push({
        app: entry.app,
        name: entry.name,
        status: "current",
        source: entry.source,
      });
    } catch (error) {
      results.push({
        app: entry.app,
        name: entry.name,
        status: "changed",
        message:
          error instanceof Error
            ? error.message
            : "The live source could not be checked.",
      });
    }
  }
  return results;
}

// Explicit activation. `credential(appId)` supplies the app owner credential at
// the moment of writing; it is never stored, logged or returned. Each app is
// applied on its own so a downstream failure is reported against that app and
// the previous configuration stays usable.
export async function activateStack(
  stack: unknown,
  { credential, beforeWrite, request = fetch }: ConfigurationOptions = {},
) {
  if (typeof credential !== "function")
    throw new StackError(
      "FORBIDDEN",
      "Applying configuration needs an owner credential for each app.",
      403,
    );
  if (typeof beforeWrite !== "function")
    throw new StackError(
      "INVALID",
      "Applying configuration needs a current workspace guard.",
    );
  const entries = activationEntries(stack).filter(
    (entry) => entry.configurable,
  );
  const configured = [];
  const failed = [];
  const untouched = [];
  // Stop at the first failure: the remaining apps keep their previous
  // configuration and are reported as untouched rather than half-applied.
  for (const [index, entry] of entries.entries()) {
    const plan = [
      {
        id: entry.app,
        url: entry.url,
        source: entry.source,
        configuration: entry.configuration,
      },
    ];
    try {
      await applyConfiguration(plan, { credential, beforeWrite, request });
      configured.push({ app: entry.app, name: entry.name });
    } catch (error) {
      failed.push({
        app: entry.app,
        name: entry.name,
        message:
          error instanceof Error
            ? error.message
            : "The app did not confirm the settings.",
      });
      untouched.push(
        ...entries
          .slice(index + 1)
          .map((rest) => ({ app: rest.app, name: rest.name })),
      );
      break;
    }
  }
  return { configured, failed, untouched, publicationUnchanged: true };
}

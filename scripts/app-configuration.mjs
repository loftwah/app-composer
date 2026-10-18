import { validateSpec } from "../src/lib/spec.mjs";
import { appConfigurationPatch } from "../src/lib/app-settings.mjs";

export function configurationPlan(input, apps) {
  const spec = validateSpec(input);
  return spec.sources.map((source) => {
    const app = apps.find((value) => value.id === source.id);
    if (
      !app ||
      app.url !== "https://" + source.id + ".loftwah.com" ||
      ["repository", "commit", "manifestDigest"].some(
        (key) => app[key] !== source[key],
      )
    )
      throw Error(
        "Selected source changed; review the current contracts before applying this specification.",
      );
    return {
      id: app.id,
      url: app.url,
      source: { ...source },
      configuration: appConfigurationPatch(spec, app.id),
    };
  });
}

// Checked Worker-safe implementation; the operator plan above retains its Node specification boundary.
export {
  verifyConfigurationTarget,
  applyConfiguration,
} from "../src/lib/app-configuration.mjs";

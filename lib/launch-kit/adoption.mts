// MIT. An explicit selection of generated assets, separate from saved Init drafts.
import { validateSettings, type Settings } from "./contract.mjs";
export interface Adoption {
  format: "app-composer.launch-kit-adoption";
  version: 1;
  packageSha256: string;
  fields: {
    title: boolean;
    subtitle: boolean;
    icons: boolean;
    social: boolean;
  };
}
export function validateAdoption(value: unknown): Adoption {
  if (
    !value ||
    typeof value !== "object" ||
    !("format" in value) ||
    value.format !== "app-composer.launch-kit-adoption" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("packageSha256" in value) ||
    typeof value.packageSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.packageSha256) ||
    !("fields" in value) ||
    !value.fields ||
    typeof value.fields !== "object"
  )
    throw Error("Unsupported Launch Kit adoption.");
  const fields = value.fields as Record<string, unknown>;
  if (
    Object.keys(fields).length !== 4 ||
    !["title", "subtitle", "icons", "social"].every(
      (key) => typeof fields[key] === "boolean",
    )
  )
    throw Error("Choose supported branding fields.");
  return {
    format: "app-composer.launch-kit-adoption",
    version: 1,
    packageSha256: value.packageSha256,
    fields: {
      title: fields.title as boolean,
      subtitle: fields.subtitle as boolean,
      icons: fields.icons as boolean,
      social: fields.social as boolean,
    },
  };
}
export function adoptedSettings(
  settings: Settings,
  adoption: Adoption,
  previous?: Settings,
): Settings {
  const s = validateSettings(settings),
    a = validateAdoption(adoption);
  return validateSettings({
    ...s,
    title: a.fields.title ? s.title : (previous?.title ?? "My collection"),
    subtitle: a.fields.subtitle ? s.subtitle : (previous?.subtitle ?? ""),
  });
}

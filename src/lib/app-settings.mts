// Reviewed composition contracts supply controls; external settings are data.
import composition from "../../composition.lock.json" with { type: "json" };

interface FieldBase {
  key: string;
  label: string;
  default: string;
  choices: { value: string; label: string }[];
  maxLength?: number;
  options?: string[];
  format?: string;
  hosts?: string[];
}
export type AppSettingField = FieldBase &
  (
    | { type: "string"; maxLength: number }
    | { type: "select"; options: string[] }
  );
export interface AppSource {
  id: string;
  repository: string;
  commit: string;
  manifestDigest: string;
}
export interface AppSettingsModel {
  id: string;
  name: string;
  capabilities: string[];
  source: AppSource;
  cardPresentation: { version: number; icons: string[] } | null;
  cardCollection: {
    version: number;
    limit: number;
    featuredLimit: number;
    groups: string[];
  } | null;
  achievementCollection: {
    version: number;
    limit: number;
    datePrecisions: string[];
  } | null;
  tagCollection: { version: number; limit: number; context: string[] } | null;
  profileSettings: {
    version: number;
    format: string;
    maxFileBytes: number;
  } | null;
  fields: AppSettingField[];
}
export interface AppConfigurationSpec {
  apps: string[];
  config: Record<string, string>;
  appSettings?: Record<string, Record<string, string>>;
}

const labels: Record<string, string> = {
  guestAccess: "Guest contributions",
  title: "Title",
  intro: "Introduction",
  theme: "Theme",
  layout: "Layout",
  handle: "Handle",
  website: "Website",
  github: "GitHub",
  bluesky: "Bluesky",
  linkedin: "LinkedIn",
  x: "X",
  avatar: "Profile portrait URL",
  banner: "Profile banner URL",
  shareImage: "Social preview image URL (1200 × 630)",
};
const options: Record<string, string> = {
  closed: "Closed",
  postcards: "Postcards with guest code",
  daylight: "Daylight",
  midnight: "Midnight",
  grid: "Gallery grid",
  editorial: "Larger editorial images",
  compact: "Compact links",
  profile: "Creator profile",
};
const names: Record<string, string> = {
  guestbook: "Photo Guestbook",
  showcase: "Linkarooie",
};
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((entry: unknown) => typeof entry === "string");

function settingField(key: string, input: unknown): AppSettingField {
  if (!object(input) || typeof input.default !== "string")
    throw Error("The reviewed app has an invalid configuration contract.");
  const base = { key, label: labels[key] ?? key, default: input.default };
  if (input.type === "select" && strings(input.options))
    return {
      ...base,
      type: "select",
      options: [...input.options],
      choices: input.options.map((value) => ({
        value,
        label: options[value] ?? value,
      })),
    };
  if (
    input.type !== "string" ||
    typeof input.maxLength !== "number" ||
    !Number.isSafeInteger(input.maxLength) ||
    input.maxLength < 0 ||
    (input.format !== undefined && typeof input.format !== "string") ||
    (input.hosts !== undefined && !strings(input.hosts))
  )
    throw Error("The reviewed app has an invalid configuration contract.");
  return {
    ...base,
    type: "string",
    maxLength: input.maxLength,
    choices: [],
    ...(typeof input.format === "string" ? { format: input.format } : {}),
    ...(strings(input.hosts) ? { hosts: [...input.hosts] } : {}),
  };
}

// Only the reviewed local composition's data contracts reach the form. This
// module performs no remote code evaluation, contract fetch or owner mutation.
const models: [string, AppSettingsModel][] = composition.apps.map((app) => [
  app.id,
  {
    id: app.id,
    name: names[app.id] ?? app.manifest.name,
    capabilities: [...(app.manifest.capabilities ?? [])],
    cardPresentation:
      "cardPresentation" in app.manifest
        ? (app.manifest.cardPresentation ?? null)
        : null,
    cardCollection:
      "cardCollection" in app.manifest
        ? (app.manifest.cardCollection ?? null)
        : null,
    achievementCollection:
      "achievementCollection" in app.manifest
        ? (app.manifest.achievementCollection ?? null)
        : null,
    tagCollection:
      "tagCollection" in app.manifest
        ? (app.manifest.tagCollection ?? null)
        : null,
    profileSettings:
      "profileSettings" in app.manifest
        ? (app.manifest.profileSettings ?? null)
        : null,
    source: {
      id: app.id,
      repository: app.repository,
      commit: app.commit,
      manifestDigest: app.manifestDigest,
    },
    fields: Object.entries(app.manifest.configuration).map(([key, field]) =>
      settingField(key, field),
    ),
  },
]);
export const appSettings: Readonly<Record<string, AppSettingsModel>> =
  Object.freeze(Object.fromEntries(models));

export function selectedSources(ids: string[]): AppSource[] {
  return ids
    .filter((id) => Object.hasOwn(appSettings, id))
    .map((id) => ({ ...appSettings[id].source }));
}
export function validateSources(input: unknown, ids: string[]): AppSource[] {
  const expected = selectedSources(ids);
  if (
    !Array.isArray(input) ||
    input.length !== expected.length ||
    input.some(
      (source: unknown, index: number) =>
        !object(source) ||
        Object.keys(source).length !== 4 ||
        Object.entries(expected[index]).some(
          ([key, value]) => source[key] !== value,
        ),
    )
  )
    throw Error(
      "The selected app contracts have changed or do not match this specification. Keep the saved file and review it against the current app versions before exporting again.",
    );
  return expected;
}
export function validateAppSettings(
  input: unknown,
  ids: string[],
): Record<string, Record<string, string>> {
  if (
    !object(input) ||
    Object.keys(input).some(
      (id) => !ids.includes(id) || !Object.hasOwn(appSettings, id),
    )
  )
    throw Error("Separate settings must belong to a selected supported app.");
  const result: Record<string, Record<string, string>> = {};
  for (const id of ids) {
    if (!Object.hasOwn(input, id)) continue;
    const settings = input[id],
      model = appSettings[id];
    if (
      !object(settings) ||
      Object.keys(settings).some(
        (key) => !model.fields.some((field) => field.key === key),
      )
    )
      throw Error("Unsupported settings for " + model.name + ".");
    if (Object.keys(settings).length !== model.fields.length)
      throw Error(
        "Separate settings for " +
          model.name +
          " need the complete field group. Use the shared settings instead, or export all fields from Init.",
      );
    const clean: Record<string, string> = {};
    for (const field of model.fields) {
      if (!Object.hasOwn(settings, field.key)) continue;
      clean[field.key] = validateAppSettingValue(
        field,
        settings[field.key],
        model.name,
      );
    }
    result[id] = clean;
  }
  return result;
}
export function appConfiguration(
  spec: AppConfigurationSpec,
  id: string,
): Record<string, string> {
  if (!spec.apps.includes(id) || !Object.hasOwn(appSettings, id))
    throw Error("Select the app before resolving its configuration.");
  const overrides =
    validateAppSettings(spec.appSettings ?? {}, spec.apps)[id] ?? {};
  const merged = Object.fromEntries(
    appSettings[id].fields.map((field) => [
      field.key,
      overrides[field.key] ?? spec.config[field.key] ?? field.default,
    ]),
  );
  return validateAppSettings({ [id]: merged }, spec.apps)[id];
}
export function validateAppSettingValue(
  field: AppSettingField,
  value: unknown,
  name: string,
): string {
  if (field.type === "select") {
    if (typeof value !== "string" || !field.options.includes(value))
      throw Error(
        "Choose a supported " +
          field.label.toLowerCase() +
          " for " +
          name +
          ".",
      );
    return value;
  }
  if (field.type !== "string")
    throw Error("Unsupported field type for " + name + ".");
  if (
    typeof value !== "string" ||
    value.length > field.maxLength ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw Error(
      name +
        " " +
        field.label.toLowerCase() +
        " must be text up to " +
        field.maxLength +
        " characters.",
    );
  const clean = value.trim();
  if (field.key === "title" && !clean)
    throw Error("Give " + name + " a title, or use the shared settings.");
  if (
    clean &&
    field.format === "handle" &&
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/.test(clean)
  )
    throw Error(
      "Use letters, numbers, dots, underscores or hyphens for the handle.",
    );
  if (clean && field.format === "https-url") {
    let url: URL;
    try {
      url = new URL(clean);
    } catch {
      throw Error("Use a full HTTPS address for " + field.label + ".");
    }
    if (
      url.href.length > field.maxLength ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (field.hosts && !field.hosts.includes(url.hostname))
    )
      throw Error(
        "Use an HTTPS " +
          field.label +
          " address without embedded credentials.",
      );
    if (
      ["avatar", "banner", "shareImage"].includes(field.key) &&
      !/^[a-zA-Z0-9.:/\[\]-]+$/.test(url.origin)
    )
      throw Error("Use an image address with a valid HTTPS hostname.");
    return url.href;
  }
  return clean;
}

// Preview defaults are not intent to clear optional live profile data.
export function appConfigurationPatch(
  spec: AppConfigurationSpec,
  id: string,
): Record<string, string> {
  const effective = appConfiguration(spec, id);
  if (Object.hasOwn(spec.appSettings ?? {}, id)) return effective;
  return Object.fromEntries(
    Object.entries(effective).filter(([key]) =>
      Object.hasOwn(spec.config, key),
    ),
  );
}
export function validateConfigurationPatch(
  input: unknown,
  id: string,
): Record<string, string> {
  const model = Object.hasOwn(appSettings, id) ? appSettings[id] : undefined;
  if (
    !model ||
    !object(input) ||
    ["title", "intro", "theme", "layout"].some(
      (key) => !Object.hasOwn(input, key),
    )
  )
    throw Error("Configure the required app settings.");
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const field = model.fields.find((field) => field.key === key);
    if (!field) throw Error("Unsupported app configuration field.");
    result[key] = validateAppSettingValue(field, value, model.name);
  }
  return result;
}

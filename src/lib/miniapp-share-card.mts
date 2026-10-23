// MIT. Narrow data contract for the app-owned, explicit profile image workflow.
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const text = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.length <= limit;
const https = (value: unknown): value is string => {
  if (!text(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
export interface ShareImage {
  path: string;
  sha256: string;
  type: "image/png";
  width: 1200;
  height: 630;
  alt: string;
}
export interface ShareCardSnapshot {
  version: 1;
  profile: {
    id: string;
    revision: string;
    name: string;
    handle: string;
    description: string;
    shareImage: string;
  };
  approved: ShareImage | null;
  previous: { shareImage: string; approved: ShareImage | null } | null;
}
export function shareImage(value: unknown): ShareImage {
  if (
    !object(value) ||
    !digest(value.sha256) ||
    value.path !== "/brand/generated/profile-" + value.sha256 + ".png" ||
    value.type !== "image/png" ||
    value.width !== 1200 ||
    value.height !== 630 ||
    !text(value.alt, 500) ||
    !value.alt.trim()
  )
    throw Error("Unsupported card image.");
  return {
    path: value.path as string,
    sha256: value.sha256,
    type: "image/png",
    width: 1200,
    height: 630,
    alt: value.alt,
  };
}
export function shareCardReceipt(value: unknown) {
  if (
    !object(value) ||
    value.format !== "linkarooie.share-card" ||
    value.version !== 1 ||
    !object(value.profile) ||
    !https(value.profile.id) ||
    !digest(value.profile.revision) ||
    !object(value.text) ||
    !text(value.text.name, 80) ||
    !value.text.name.trim() ||
    !text(value.text.handle, 40) ||
    !text(value.text.description, 240) ||
    !object(value.preset) ||
    !text(value.preset.id, 64) ||
    value.preset.version !== 1 ||
    !object(value.renderer) ||
    JSON.stringify(value.renderer).length > 2048
  )
    throw Error(
      "Choose the adoption receipt prepared for this profile, not a recipe or image file.",
    );
  return {
    format: "linkarooie.share-card",
    version: 1,
    profile: { id: value.profile.id, revision: value.profile.revision },
    text: {
      name: value.text.name,
      handle: value.text.handle,
      description: value.text.description,
    },
    image: shareImage(value.image),
    preset: { id: value.preset.id, version: 1 },
    renderer: value.renderer,
  };
}
export function shareCardCommand(command: Record<string, unknown>) {
  if (command.operation === "snapshot") return undefined;
  if (!digest(command.expectedRevision))
    throw Error("Refresh this profile before publishing.");
  if (command.operation === "rollback")
    return { action: "rollback", expectedRevision: command.expectedRevision };
  if (command.operation !== "adopt")
    throw Error("Choose a supported profile image action.");
  return {
    action: "adopt",
    expectedRevision: command.expectedRevision,
    receipt: shareCardReceipt(command.receipt),
  };
}
export function shareCardSnapshot(value: unknown): ShareCardSnapshot {
  if (
    !object(value) ||
    value.version !== 1 ||
    !object(value.profile) ||
    !https(value.profile.id) ||
    !digest(value.profile.revision) ||
    !text(value.profile.name, 80) ||
    !text(value.profile.handle, 40) ||
    !text(value.profile.description, 240) ||
    !https(value.profile.shareImage)
  )
    throw Error("The app returned an incompatible profile image snapshot.");
  let previous: ShareCardSnapshot["previous"] = null;
  if (value.previous !== null) {
    if (
      !object(value.previous) ||
      !(value.previous.shareImage === "" || https(value.previous.shareImage))
    )
      throw Error("The previous profile image is unavailable.");
    previous = {
      shareImage: value.previous.shareImage as string,
      approved:
        value.previous.approved === null
          ? null
          : shareImage(value.previous.approved),
    };
  }
  return {
    version: 1,
    profile: {
      id: value.profile.id,
      revision: value.profile.revision,
      name: value.profile.name,
      handle: value.profile.handle,
      description: value.profile.description,
      shareImage: value.profile.shareImage,
    },
    approved: value.approved === null ? null : shareImage(value.approved),
    previous,
  };
}

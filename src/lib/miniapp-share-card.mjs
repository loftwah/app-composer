// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
// MIT. Narrow data contract for the app-owned, explicit profile image workflow.
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const text = (value, limit) => typeof value === "string" && value.length <= limit;
const https = (value) => {
    if (!text(value, 2048))
        return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
    }
    catch {
        return false;
    }
};
export function shareImage(value) {
    if (!object(value) ||
        !digest(value.sha256) ||
        value.path !== "/brand/generated/profile-" + value.sha256 + ".png" ||
        value.type !== "image/png" ||
        value.width !== 1200 ||
        value.height !== 630 ||
        !text(value.alt, 500) ||
        !value.alt.trim())
        throw Error("Unsupported card image.");
    return {
        path: value.path,
        sha256: value.sha256,
        type: "image/png",
        width: 1200,
        height: 630,
        alt: value.alt,
    };
}
export function shareCardReceipt(value) {
    if (!object(value) ||
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
        JSON.stringify(value.renderer).length > 2048)
        throw Error("Choose the adoption receipt prepared for this profile, not a recipe or image file.");
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
export function shareCardCommand(command) {
    if (command.operation === "snapshot")
        return undefined;
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
export function shareCardSnapshot(value) {
    if (!object(value) ||
        value.version !== 1 ||
        !object(value.profile) ||
        !https(value.profile.id) ||
        !digest(value.profile.revision) ||
        !text(value.profile.name, 80) ||
        !text(value.profile.handle, 40) ||
        !text(value.profile.description, 240) ||
        !https(value.profile.shareImage))
        throw Error("The app returned an incompatible profile image snapshot.");
    let previous = null;
    if (value.previous !== null) {
        if (!object(value.previous) ||
            !(value.previous.shareImage === "" || https(value.previous.shareImage)))
            throw Error("The previous profile image is unavailable.");
        previous = {
            shareImage: value.previous.shareImage,
            approved: value.previous.approved === null
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

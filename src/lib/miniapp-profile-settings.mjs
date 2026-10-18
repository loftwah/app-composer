// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import { profileSettings, profileSettingsFile, profileSettingKeys, } from "./miniapp-profile-settings-fields.mjs";
const exact = (value, keys) => !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
export function profileSettingsCommand(input) {
    if (!input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        bytes(input) > 65536)
        throw Error("Use a bounded profile settings command.");
    if (exact(input, ["operation"]) && input.operation === "export")
        return null;
    if (exact(input, ["operation", "file"]) && input.operation === "review")
        return { action: "review", file: profileSettingsFile(input.file) };
    if (exact(input, ["operation", "file", "expected"]) &&
        input.operation === "apply")
        return {
            action: "apply",
            file: profileSettingsFile(input.file),
            expected: profileSettings(input.expected),
        };
    throw Error("Choose a supported profile settings operation.");
}
export function profileSettingsResult(operation, result, requested) {
    if (!["export", "review", "apply"].includes(operation))
        throw Error("Unsupported settings result.");
    if (operation === "export")
        return { ok: true, file: profileSettingsFile(result) };
    const reviewing = operation === "review";
    if (!exact(result, reviewing
        ? ["ok", "saved", "before", "after", "changedFields"]
        : ["ok", "saved", "config", "changedFields"]) ||
        result.ok !== true ||
        result.saved !== !reviewing)
        throw Error("Incompatible settings result.");
    if (!Array.isArray(result.changedFields) ||
        new Set(result.changedFields).size !== result.changedFields.length ||
        result.changedFields.some((key) => typeof key !== "string" ||
            !profileSettingKeys.some((field) => field === key)))
        throw Error("Incompatible settings differences.");
    const config = profileSettings(reviewing ? result.after : result.config);
    if (!requested ||
        typeof requested !== "object" ||
        Array.isArray(requested) ||
        !("file" in requested))
        throw Error("The result differs from the requested settings.");
    const requestedFile = profileSettingsFile(requested.file);
    if (JSON.stringify(config) !== JSON.stringify(requestedFile.config))
        throw Error("The result differs from the requested settings.");
    if (reviewing) {
        const before = profileSettings(result.before), changedFields = profileSettingKeys.filter((key) => before[key] !== config[key]);
        if (JSON.stringify(changedFields) !== JSON.stringify(result.changedFields))
            throw Error("Incompatible settings differences.");
        return { ok: true, saved: false, before, after: config, changedFields };
    }
    const expected = profileSettings("expected" in requested ? requested.expected : undefined), changedFields = profileSettingKeys.filter((key) => expected[key] !== config[key]);
    if (JSON.stringify(changedFields) !== JSON.stringify(result.changedFields))
        throw Error("Incompatible settings differences.");
    return { ok: true, saved: true, config, changedFields };
}

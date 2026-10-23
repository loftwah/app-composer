// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
// MIT. An explicit selection of generated assets, separate from saved Init drafts.
import { validateSettings } from "./contract.mjs";
export function validateAdoption(value) {
    if (!value ||
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
        typeof value.fields !== "object")
        throw Error("Unsupported Launch Kit adoption.");
    const fields = value.fields;
    if (Object.keys(fields).length !== 4 ||
        !["title", "subtitle", "icons", "social"].every((key) => typeof fields[key] === "boolean"))
        throw Error("Choose supported branding fields.");
    return {
        format: "app-composer.launch-kit-adoption",
        version: 1,
        packageSha256: value.packageSha256,
        fields: {
            title: fields.title,
            subtitle: fields.subtitle,
            icons: fields.icons,
            social: fields.social,
        },
    };
}
export function adoptedSettings(settings, adoption, previous) {
    const s = validateSettings(settings), a = validateAdoption(adoption);
    return validateSettings({
        ...s,
        title: a.fields.title ? s.title : (previous?.title ?? "My collection"),
        subtitle: a.fields.subtitle ? s.subtitle : (previous?.subtitle ?? ""),
    });
}

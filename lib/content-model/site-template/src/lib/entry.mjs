// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
// Stable native content IDs keep entry links independent of editable titles.
export function entryPath(id) {
    return typeof id === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(id)
        ? "/entries/" + encodeURIComponent(id)
        : null;
}
export function titleField(model) {
    return model.fields.find((field) => field.type === "string" && !field.when)
        ?.key;
}
export function entryTitle(model, values) {
    const value = values[titleField(model) ?? ""];
    return typeof value === "string" && value.trim()
        ? value.trim()
        : "Untitled entry";
}
export function entryDescription(model, values) {
    const heading = titleField(model);
    const field = model.fields.find((field) => field.key !== heading &&
        !field.when &&
        ["string", "text"].includes(field.type) &&
        typeof values[field.key] === "string" &&
        String(values[field.key]).trim());
    const text = field
        ? String(values[field.key])
        : "Published entry in " + model.label + ".";
    const characters = Array.from(text.replace(/\s+/g, " ").trim());
    return characters.length > 160
        ? characters.slice(0, 159).join("").trimEnd() + "…"
        : characters.join("");
}

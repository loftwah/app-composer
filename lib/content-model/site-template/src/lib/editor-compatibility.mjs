// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import { definePlugin } from "emdash";
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const safeKey = (value) => typeof value === "string" &&
    /^[a-z][a-z0-9_]{0,47}$/.test(value) &&
    !["__proto__", "prototype", "constructor"].includes(value);
function selectedLinks(value, max) {
    if (!Array.isArray(value) ||
        value.length > max ||
        !value.every(safeKey) ||
        new Set(value).size !== value.length)
        throw Error("Use only the generated model’s selected optional-link fields.");
    return [...value];
}
function selectedRows(value) {
    if (!Array.isArray(value) || value.length > 12)
        throw Error("Use only the generated model’s selected repeating rows.");
    const rows = value.map((row) => {
        if (!record(row) ||
            Object.keys(row).some((key) => !["key", "links"].includes(key)) ||
            !safeKey(row.key))
            throw Error("Use only the generated model’s selected repeating rows.");
        return { key: row.key, links: selectedLinks(row.links, 6) };
    });
    if (new Set(rows.map((row) => row.key)).size !== rows.length)
        throw Error("Use distinct generated repeating rows.");
    return rows;
}
// EmDash 1.2.0 sends a cleared optional URL as ''. Only that submitted value is
// normalised; native authentication, validation and publication remain in charge.
// Recheck upstream https://github.com/emdash-cms/emdash/pull/4076 on upgrade.
export function createPlugin({ collection, links, rows = [], adminEntry, } = {}) {
    if (typeof collection !== "string" ||
        !/^[a-z][a-z0-9-]{0,47}$/.test(collection))
        throw Error("Use the generated model’s selected collection.");
    const selected = selectedLinks(links, 12), selectedRowLinks = selectedRows(rows);
    return definePlugin({
        id: "composer-content-fields",
        version: "1.3.0",
        capabilities: ["content:write"],
        admin: {
            entry: adminEntry,
            fieldWidgets: [
                { name: "integer", label: "Whole number", fieldTypes: ["integer"] },
                { name: "date", label: "Calendar date", fieldTypes: ["string"] },
            ],
        },
        hooks: {
            "content:beforeSave": async ({ collection: current, content }) => {
                if (current !== collection)
                    return;
                let next = content;
                for (const key of selected)
                    if (Object.hasOwn(content, key) && content[key] === "") {
                        if (next === content)
                            next = { ...content };
                        next[key] = null;
                    }
                for (const { key, links: fields } of selectedRowLinks) {
                    const submitted = content[key];
                    if (!Object.hasOwn(content, key) || !Array.isArray(submitted))
                        continue;
                    let changed = false;
                    const rows = submitted.map((row) => {
                        if (!record(row))
                            return row;
                        let copy = row;
                        for (const field of fields)
                            if (Object.hasOwn(row, field) && row[field] === "") {
                                if (copy === row)
                                    copy = { ...row };
                                copy[field] = null;
                                changed = true;
                            }
                        return copy;
                    });
                    if (changed) {
                        if (next === content)
                            next = { ...content };
                        next[key] = rows;
                    }
                }
                return next;
            },
        },
    });
}

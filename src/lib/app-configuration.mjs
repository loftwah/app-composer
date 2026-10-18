// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
// App-owned configuration writes are shared by the Worker and the Node operator.
// The caller supplies fresh authority; credentials never enter persisted data.
import { appSettings, validateConfigurationPatch, } from "./app-settings.mjs";
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function target(value) {
    if (!record(value) ||
        typeof value.id !== "string" ||
        !Object.hasOwn(appSettings, value.id) ||
        value.url !== "https://" + value.id + ".loftwah.com" ||
        !record(value.source))
        throw Error("Unsupported operator configuration source.");
    const actual = value.source;
    const reviewed = appSettings[value.id].source;
    if (Object.entries(reviewed).some(([key, expected]) => actual[key] !== expected))
        throw Error("Unsupported operator configuration source.");
    return { id: value.id, url: value.url, source: { ...reviewed } };
}
export async function verifyConfigurationTarget(input, request = fetch) {
    const app = target(input);
    for (const url of [
        app.url + "/build.json",
        "https://composer.loftwah.com/" + app.id + "/build.json",
    ]) {
        const response = await request(url, {
            redirect: "error",
            headers: { "User-Agent": "Mozilla/5.0 (AppComposer verification)" },
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
            throw Error("Current app source could not be checked for " + app.id + ".");
        const build = await response.json();
        if (!record(build) || build.revision !== app.source.commit)
            throw Error("Current app source changed for " +
                app.id +
                ". Inspect completed settings before explicitly retrying.");
    }
}
// Existing operator targets only. Validate the entire plan before credentials or
// network IO. A lost or malformed acknowledgment remains a refusal, with no retry.
export async function applyConfiguration(plan, { credential, beforeWrite, request = fetch }) {
    if (typeof credential !== "function" || typeof beforeWrite !== "function")
        throw Error("Configuration requires explicit owner credentials and a current workspace guard.");
    if (!Array.isArray(plan) || !plan.length || plan.length > 2)
        throw Error("Select one or both supported operator apps.");
    const ids = new Set();
    const entries = plan.map((value) => {
        let app;
        try {
            app = target(value);
        }
        catch {
            throw Error("Unsupported operator configuration target.");
        }
        if (ids.has(app.id) || !record(value))
            throw Error("Unsupported operator configuration target.");
        ids.add(app.id);
        return {
            ...app,
            configuration: validateConfigurationPatch(value.configuration, app.id),
        };
    });
    const completed = [];
    for (const app of entries) {
        await beforeWrite(app);
        const token = await credential(app.id);
        if (typeof token !== "string" || !token.trim())
            throw Error("Missing owner credential for " + app.id + ".");
        const response = await request(app.url + "/api/config", {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token.trim(),
                "User-Agent": "Mozilla/5.0 (AppComposer verification)",
            },
            body: JSON.stringify(app.configuration),
        });
        if (!response.ok)
            throw Error("Configuration failed for " +
                app.id +
                ": " +
                response.status +
                ". Inspect completed settings before explicitly retrying.");
        let value;
        try {
            value = await response.json();
        }
        catch {
            throw Error("Configuration response could not be verified for " + app.id + ".");
        }
        const confirmed = record(value) && record(value.config) ? value.config : null;
        if (!record(value) ||
            value.ok !== true ||
            !confirmed ||
            Object.entries(app.configuration).some(([key, expected]) => !Object.hasOwn(confirmed, key) || confirmed[key] !== expected))
            throw Error("Configuration response did not match the selected settings for " +
                app.id +
                ". Inspect live settings before explicitly retrying.");
        completed.push(app.id);
    }
    return { configured: completed, deployed: false };
}

// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import { type AppSource } from "./app-settings.mjs";
import type { ConfigurationOptions } from "./app-configuration.mjs";
interface EntryBase {
    instanceId: string;
    app: string;
    name: string;
}
export type ActivationEntry = (EntryBase & {
    configurable: false;
    reason: string;
}) | (EntryBase & {
    configurable: true;
    source: AppSource;
    settings: {
        key: string;
        label: string;
        value: string;
        overridden: boolean;
    }[];
    configuration: Record<string, string>;
    url: string;
});
export type SourceStatus = {
    app: string;
    name: string;
} & ({
    status: "unavailable" | "changed";
    message: string;
} | {
    status: "current";
    source: AppSource;
});
export declare function activationEntries(stack: unknown): ActivationEntry[];
export declare function activationSummary(stack: unknown): {
    entries: ActivationEntry[];
    shared: {
        instanceId: string;
        app: string;
        name: string;
        shareOf: string | null;
    }[];
};
export declare function stackSourceStatus(stack: unknown, { request }?: Pick<ConfigurationOptions, "request">): Promise<SourceStatus[]>;
export declare function activateStack(stack: unknown, { credential, beforeWrite, request }?: ConfigurationOptions): Promise<{
    configured: {
        app: string;
        name: string;
    }[];
    failed: {
        app: string;
        name: string;
        message: string;
    }[];
    untouched: {
        app: string;
        name: string;
    }[];
    publicationUnchanged: boolean;
}>;
export {};

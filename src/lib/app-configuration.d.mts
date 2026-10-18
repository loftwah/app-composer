// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import { type AppSource } from "./app-settings.mjs";
export interface ConfigurationTarget {
    id: string;
    url: string;
    source: AppSource;
}
export interface ConfigurationEntry extends ConfigurationTarget {
    configuration: Record<string, string>;
}
export interface ConfigurationOptions {
    credential?: (id: string) => unknown | Promise<unknown>;
    beforeWrite?: (entry: ConfigurationEntry) => unknown | Promise<unknown>;
    request?: typeof fetch;
}
export declare function verifyConfigurationTarget(input: unknown, request?: typeof fetch): Promise<void>;
export declare function applyConfiguration(plan: unknown, { credential, beforeWrite, request }: ConfigurationOptions): Promise<{
    configured: string[];
    deployed: false;
}>;

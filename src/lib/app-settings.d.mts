// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
interface FieldBase {
    key: string;
    label: string;
    default: string;
    choices: {
        value: string;
        label: string;
    }[];
    maxLength?: number;
    options?: string[];
    format?: string;
    hosts?: string[];
}
export type AppSettingField = FieldBase & ({
    type: "string";
    maxLength: number;
} | {
    type: "select";
    options: string[];
});
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
    cardPresentation: {
        version: number;
        icons: string[];
    } | null;
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
    tagCollection: {
        version: number;
        limit: number;
        context: string[];
    } | null;
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
export declare const appSettings: Readonly<Record<string, AppSettingsModel>>;
export declare const globalAppSettings: Readonly<Record<string, AppSettingsModel>>;
export declare function selectedSources(ids: string[]): AppSource[];
export declare function validateSources(input: unknown, ids: string[]): AppSource[];
export declare function validateAppSettings(input: unknown, ids: string[]): Record<string, Record<string, string>>;
export declare function appConfiguration(spec: AppConfigurationSpec, id: string): Record<string, string>;
export declare function validateAppSettingValue(field: AppSettingField, value: unknown, name: string): string;
export declare function appConfigurationPatch(spec: AppConfigurationSpec, id: string): Record<string, string>;
export declare function validateConfigurationPatch(input: unknown, id: string): Record<string, string>;
export declare function validateScopedConfigurationPatch(input: unknown, id: string): Record<string, string>;
export {};

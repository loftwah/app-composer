// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
export type ProfileSettingKey = "title" | "intro" | "theme" | "layout" | "handle" | "website" | "github" | "bluesky" | "linkedin";
export type ProfileValues = Record<ProfileSettingKey, string>;
export interface ProfileSettingsFile {
    format: "linkarooie.profile-settings";
    version: 1;
    config: ProfileValues;
}
export interface ProfileField {
    key: "handle" | "website" | "github" | "x" | "linkedin" | "avatar" | "banner" | "shareImage";
    label: string;
    maxLength: number;
    default: string;
    image?: boolean;
}
export declare const profileFields: ProfileField[];
export declare function profileConfiguration(input: Record<string, unknown>, previous?: Record<string, unknown>): Record<string, unknown>;
export declare const profileFileFormat = "linkarooie.profile-settings";
export declare const profileSettingKeys: ProfileSettingKey[];
export declare class ProfilePortabilityError extends Error {
    status: number;
    constructor(message: string, status?: number);
}
export declare function profileSettings(value: unknown): ProfileValues;
export declare function profileSettingsFile(value: unknown): ProfileSettingsFile;

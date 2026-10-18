// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import type { ProfileSettingsFile, ProfileValues, ProfileSettingKey } from "./miniapp-profile-settings-fields.mjs";
export interface ProfileReview {
    ok: true;
    saved: false;
    before: ProfileValues;
    after: ProfileValues;
    changedFields: ProfileSettingKey[];
}
export type ProfileSettingsCommand = null | {
    action: "review";
    file: ProfileSettingsFile;
} | {
    action: "apply";
    file: ProfileSettingsFile;
    expected: ProfileValues;
};
export type ProfileSettingsResult = {
    ok: true;
    file: ProfileSettingsFile;
} | ProfileReview | {
    ok: true;
    saved: true;
    config: ProfileValues;
    changedFields: ProfileSettingKey[];
};
export declare function profileSettingsCommand(input: unknown): ProfileSettingsCommand;
export declare function profileSettingsResult(operation: string, result: unknown, requested: unknown): ProfileSettingsResult;

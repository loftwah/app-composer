// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import { type Settings } from "./contract.mjs";
export interface Adoption {
    format: "app-composer.launch-kit-adoption";
    version: 1;
    packageSha256: string;
    fields: {
        title: boolean;
        subtitle: boolean;
        icons: boolean;
        social: boolean;
    };
}
export declare function validateAdoption(value: unknown): Adoption;
export declare function adoptedSettings(settings: Settings, adoption: Adoption, previous?: Settings): Settings;

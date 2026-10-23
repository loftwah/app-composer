// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import { type Settings } from "./contract.mjs";
export interface Kit {
    settings: Settings;
    files: Map<string, Uint8Array>;
    digest: string;
    sourceSha256: string;
}
export declare function validatePackage(bytes: Uint8Array): Promise<Kit>;
export declare function validatePNG(bytes: Uint8Array, opaque?: boolean): Promise<void>;

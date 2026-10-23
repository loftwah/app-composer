// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import { Buffer } from "node:buffer";
export declare function createContentProject(options?: {
    model?: unknown;
    destination?: unknown;
    [key: string]: unknown;
}): {
    state: string;
    destination: string;
    collection: string;
    files: number;
    dependenciesInstalled: boolean;
    agentSkillsVerified: boolean;
    deployed: boolean;
    next: string;
};
export declare function createBrandedContentProject(options: {
    model: unknown;
    destination: unknown;
    packageBytes: Uint8Array;
    adoption: unknown;
}): Promise<{
    state: string;
    destination: string;
    collection: string;
    files: number;
    dependenciesInstalled: boolean;
    agentSkillsVerified: boolean;
    deployed: boolean;
    next: string;
}>;
export declare function contentProjectFiles(input: unknown): {
    files: Record<string, Buffer<ArrayBufferLike>>;
    provenance: {
        schema: string;
        version: number;
        reviewed: string;
        repository: string;
        collection: string;
        sourceFiles: Record<string, string>;
        files: {
            [k: string]: string;
        };
        deployed: boolean;
    };
    recheck: () => void;
};
export declare function createLaunchKitProject(options: {
    destination: unknown;
    packageBytes: Uint8Array;
    adoption: unknown;
    base?: string;
    origin?: string;
}): Promise<{
    state: string;
    destination: string;
    collection: string;
    files: number;
    dependenciesInstalled: boolean;
    agentSkillsVerified: boolean;
    deployed: boolean;
    next: string;
}>;

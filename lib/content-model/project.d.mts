// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import { Buffer } from "node:buffer";
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
export declare function createContentProject({ model, destination, ...unknown }?: {
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

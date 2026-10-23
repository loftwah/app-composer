// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
export declare const MAX_PACKAGE: number;
export declare function crc32(bytes: Uint8Array): number;
export declare function zip(files: Map<string, Uint8Array>): Uint8Array<ArrayBuffer>;
export declare function unzip(bytes: Uint8Array): Map<string, Uint8Array>;

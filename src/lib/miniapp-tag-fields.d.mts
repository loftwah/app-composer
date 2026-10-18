// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
export interface TagValues {
    label: string;
    description: string;
    citationLabel: string;
    citationURL: string;
    relatedLabel: string;
    relatedURL: string;
    status: "draft" | "published" | "hidden";
}
export type ProfileTag = TagValues & {
    id: string;
};
export interface TagCollection {
    version: 1;
    revision: number;
    items: ProfileTag[];
}
export declare const tagKeys: (keyof TagValues)[];
export declare const tagLimit = 12;
export declare const blankTag: () => TagValues;
export declare class TagFieldError extends Error {
    field: string;
    constructor(field: string, message: string);
}
export declare const exactTagObject: (value: unknown, keys: readonly string[]) => value is Record<string, unknown>;
export declare const tagValues: (item: TagValues) => TagValues;
export declare const sameTag: (a: TagValues | null | undefined, b: TagValues | null | undefined) => boolean;
export declare function tagFields(input: unknown): TagValues;
export declare const tagHasContext: (tag: TagValues) => boolean;
export declare function tagCollection(value: unknown): TagCollection;

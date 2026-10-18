// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import type { ContentModel, ContentField } from "./content-model.mjs";
export declare function collectionFilter(model: ContentModel): ContentField | null;
export declare function collectionRequest(model: ContentModel, params: URLSearchParams): {
    field: ContentField | null;
    page: number | null;
    value: string;
    valid: boolean;
    where: {
        [x: string]: string;
    };
};
export declare function collectionAddress(page: number, value?: string): string;

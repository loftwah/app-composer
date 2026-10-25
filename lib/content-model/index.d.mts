// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
export type FieldKind = "string" | "text" | "url" | "date" | "integer" | "boolean" | "select" | "repeater";
export interface ContentField {
    key: string;
    label: string;
    type: FieldKind;
    required: boolean;
    defaultValue?: string | number | boolean;
    validation?: {
        min?: number;
        max?: number;
        maxLength?: number;
    };
    group?: string;
    choices?: string[];
    limit?: number;
    fields?: ContentField[];
    when?: {
        field: string;
        equals: string | boolean;
    };
}
export interface ContentModel {
    schema: "app-composer.content-model";
    version: 1;
    collection: string;
    label: string;
    groups: string[];
    fields: ContentField[];
}
export declare const modelVersion: 1;
export declare const maxModelBytes = 65536;
export declare const fieldTypes: Readonly<{
    string: "Short text";
    text: "Long text";
    url: "HTTPS link";
    date: "Calendar date";
    integer: "Whole number";
    boolean: "Yes / no";
    select: "Choice";
    repeater: "Repeating group";
}>;
export declare function validateContentModel(input: unknown): ContentModel;
export declare function visibleModelFields(input: unknown, values: Record<string, unknown>): ContentField[];
export declare function validateModelValues(input: unknown, values: Record<string, unknown>): Record<string, unknown>;
export declare function emdashSeed(input: unknown): {
    version: "1";
    meta: {
        name: string;
    };
    collections: {
        slug: string;
        label: string;
        routable: boolean;
        supports: string[];
        fields: {
            validation?: {
                minLength: number;
                maxLength: number;
                pattern: string;
                options?: undefined;
                minItems?: undefined;
                maxItems?: undefined;
                subFields?: undefined;
                min?: undefined;
                max?: undefined;
            } | {
                options: string[] | undefined;
                minLength?: undefined;
                maxLength?: undefined;
                pattern?: undefined;
                minItems?: undefined;
                maxItems?: undefined;
                subFields?: undefined;
                min?: undefined;
                max?: undefined;
            } | {
                minItems: number;
                maxItems: number | undefined;
                subFields: {
                    options?: string[] | undefined;
                    slug: string;
                    label: string;
                    type: FieldKind;
                    required: boolean;
                }[];
                minLength?: undefined;
                maxLength?: undefined;
                pattern?: undefined;
                options?: undefined;
                min?: undefined;
                max?: undefined;
            } | {
                maxLength: number;
                minLength?: undefined;
                pattern?: undefined;
                options?: undefined;
                minItems?: undefined;
                maxItems?: undefined;
                subFields?: undefined;
                min?: undefined;
                max?: undefined;
            } | {
                min: number;
                max: number;
                minLength?: undefined;
                maxLength?: undefined;
                pattern?: undefined;
                options?: undefined;
                minItems?: undefined;
                maxItems?: undefined;
                subFields?: undefined;
            } | undefined;
            defaultValue?: string | number | boolean | undefined;
            slug: string;
            label: string;
            type: "string" | "boolean" | "text" | "url" | "integer" | "select" | "repeater";
            required: boolean;
        }[];
    }[];
};
export declare function contentModelDownloadNames(input: unknown): {
    model: string;
    seed: string;
};
export declare function contentModelHandoff(input: unknown): string;
export declare const starterModel: ContentModel;
export declare function contentProjectHandoff(input: unknown): string;

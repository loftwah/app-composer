// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import type { ImageValue } from "emdash";
export declare function ownedImage(image: ImageValue | string | null | undefined): Promise<{
    image: string | ImageValue | null | undefined;
    caption: string;
} | {
    image: {
        height?: number | undefined;
        width?: number | undefined;
        provider: string;
        id: string;
        meta: {
            storageKey: string;
        };
        alt: string;
    };
    caption: string;
}>;

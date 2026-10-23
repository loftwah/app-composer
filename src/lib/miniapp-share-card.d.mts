// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
export interface ShareImage {
    path: string;
    sha256: string;
    type: "image/png";
    width: 1200;
    height: 630;
    alt: string;
}
export interface ShareCardSnapshot {
    version: 1;
    profile: {
        id: string;
        revision: string;
        name: string;
        handle: string;
        description: string;
        shareImage: string;
    };
    approved: ShareImage | null;
    previous: {
        shareImage: string;
        approved: ShareImage | null;
    } | null;
}
export declare function shareImage(value: unknown): ShareImage;
export declare function shareCardReceipt(value: unknown): {
    format: string;
    version: number;
    profile: {
        id: string;
        revision: string;
    };
    text: {
        name: string;
        handle: string;
        description: string;
    };
    image: ShareImage;
    preset: {
        id: string;
        version: number;
    };
    renderer: Record<string, unknown>;
};
export declare function shareCardCommand(command: Record<string, unknown>): {
    action: string;
    expectedRevision: string;
    receipt?: undefined;
} | {
    action: string;
    expectedRevision: string;
    receipt: {
        format: string;
        version: number;
        profile: {
            id: string;
            revision: string;
        };
        text: {
            name: string;
            handle: string;
            description: string;
        };
        image: ShareImage;
        preset: {
            id: string;
            version: number;
        };
        renderer: Record<string, unknown>;
    };
} | undefined;
export declare function shareCardSnapshot(value: unknown): ShareCardSnapshot;

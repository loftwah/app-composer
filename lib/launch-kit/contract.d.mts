// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
export declare const VERSION = 1;
export declare const MAX_BYTES: number;
export declare const MAX_PIXELS = 16000000;
export declare const OUTPUTS: readonly [{
    readonly name: "favicon-16.png";
    readonly size: 16;
    readonly purpose: "Browser tab · 16px";
    readonly maskable: false;
}, {
    readonly name: "favicon-32.png";
    readonly size: 32;
    readonly purpose: "Browser tab · 32px";
    readonly maskable: false;
}, {
    readonly name: "favicon-48.png";
    readonly size: 48;
    readonly purpose: "Browser tab · 48px";
    readonly maskable: false;
}, {
    readonly name: "apple-touch-icon.png";
    readonly size: 180;
    readonly purpose: "Apple home screen";
    readonly maskable: false;
}, {
    readonly name: "icon-192.png";
    readonly size: 192;
    readonly purpose: "App icon · 192px";
    readonly maskable: false;
}, {
    readonly name: "icon-512.png";
    readonly size: 512;
    readonly purpose: "App icon · 512px";
    readonly maskable: false;
}, {
    readonly name: "maskable-192.png";
    readonly size: 192;
    readonly purpose: "Adaptive app icon · 192px";
    readonly maskable: true;
}, {
    readonly name: "maskable-512.png";
    readonly size: 512;
    readonly purpose: "Adaptive app icon · 512px";
    readonly maskable: true;
}];
export interface Settings {
    version: 1;
    title: string;
    subtitle: string;
    alt: string;
    fit: "contain" | "cover";
    x: number;
    y: number;
    spacing: number;
    zoom: number;
    maskSpacing: number;
    background: string;
    transparent: boolean;
    accent: string;
    ink: string;
    layout: "split" | "poster" | "band";
}
export declare const DEFAULTS: Settings;
export declare function validateSettings(input: unknown): Settings;
export declare function safeName(name: string): boolean;
export declare function escapeHTML(value: string): string;
export declare function manifest(settings: Settings): {
    id: string;
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    theme_color: string;
    background_color: string;
    icons: {
        src: string;
        sizes: string;
        type: string;
        purpose: string;
    }[];
};
export interface Header {
    format: "PNG" | "JPEG" | "WebP";
    width: number;
    height: number;
}
export declare function inspectRaster(bytes: Uint8Array): Header;
export declare function sha256(bytes: Uint8Array): Promise<string>;
export declare function contrast(a: string, b: string): number;

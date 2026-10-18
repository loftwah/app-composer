// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import { achievementCollection } from "./miniapp-achievements.mjs";
import { tagCollection } from "./miniapp-tag-fields.mjs";
export interface MiniappContext {
    user?: {
        id?: string;
        role: number;
    };
    request: Request;
    input: unknown;
}
export interface NativeAppItem extends Record<string, unknown> {
    id: string;
    status: string;
}
export declare function manageMiniapps(ctx: MiniappContext, runtime: unknown, pins: Record<string, string>): Promise<import("./miniapp-profile-settings.mjs").ProfileReview | {
    ok: true;
    file: import("./miniapp-profile-settings-fields.mts").ProfileSettingsFile;
} | {
    ok: true;
    saved: true;
    config: import("./miniapp-profile-settings-fields.mts").ProfileValues;
    changedFields: import("./miniapp-profile-settings-fields.mts").ProfileSettingKey[];
} | {
    ok: boolean;
    supported: boolean;
    message: string;
    workspace: string | null;
    workspaces: {
        id: string;
        name: string;
        role: "owner" | "editor";
    }[];
    sources: {
        workspace: string;
        stack: string;
        instance: string;
        expectedRevision: number;
        stackName: string;
        label: string;
        shared: boolean;
        source: {
            kind: string;
            version: number;
            resource: string;
            configuration: number;
        };
    }[];
    code?: undefined;
    selection?: undefined;
    source?: undefined;
    title?: undefined;
    visible?: undefined;
    pending?: undefined;
    items?: undefined;
} | {
    message: string;
    card?: {
        id: string;
        status: "draft" | "published" | "hidden";
    } | undefined;
    ok: boolean;
    workspace: string;
    source: {
        kind: string;
        version: number;
        resource: string;
        configuration: number;
    };
    item: string;
    outcome: string;
    code?: undefined;
    supported?: undefined;
    workspaces?: undefined;
    sources?: undefined;
    selection?: undefined;
    title?: undefined;
    visible?: undefined;
    pending?: undefined;
    items?: undefined;
} | {
    ok: boolean;
    selection: {
        workspace: string;
        stack: string;
        instance: string;
        expectedRevision: number;
    };
    source: {
        kind: "guestbook.resource";
        version: 1;
        resource: string;
        configuration: number;
    };
    title: string;
    visible: boolean;
    pending: boolean;
    items: {
        id: string;
        caption: string;
        author: string;
    }[];
    code?: undefined;
    message?: undefined;
    supported?: undefined;
    workspace?: undefined;
    workspaces?: undefined;
    sources?: undefined;
} | {
    ok: boolean;
    code: string;
    message: string;
} | {
    ok: boolean;
    png: string;
    id?: undefined;
} | {
    config: Record<string, unknown>;
    items: NativeAppItem[];
    tagCollection?: ReturnType<typeof tagCollection> | null;
    tagProblem?: string;
    achievementCollection?: ReturnType<typeof achievementCollection> | null;
    achievementProblem?: string;
    ok: boolean;
    app: "guestbook" | "showcase";
    png?: undefined;
    id?: undefined;
} | {
    ok: boolean;
    id: string | null;
    png?: undefined;
}>;

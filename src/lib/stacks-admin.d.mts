// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
export interface StackAdminContext {
    user?: {
        id: string;
        role: number;
        name?: string | null;
    };
    request: Request;
    input: unknown;
}
export declare function manageStacks(ctx: StackAdminContext, runtime: unknown): Promise<{
    ok: boolean;
    code: string;
    message: string;
} | {
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    book: {
        instance: string;
        resource: string;
        shared: boolean;
        title: string;
        path: string;
        version: number;
        visible: boolean;
        paused: boolean;
        pending: boolean;
        items: {
            id: string;
            caption: string;
            author: string;
            status: "hidden" | "pending" | "approved" | "deleted" | "rejected";
            revision: number;
            synthetic: boolean;
            createdAt: string;
        }[];
    };
    media?: undefined;
    stacks?: undefined;
    resources?: undefined;
    availableResources?: undefined;
    stack?: undefined;
    export?: undefined;
    publications?: undefined;
    configuration?: undefined;
    instances?: undefined;
    imported?: undefined;
    deleted?: undefined;
} | {
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    media: {
        instance: string;
        resource: string;
        item: string;
        png: string;
    };
    book?: undefined;
    stacks?: undefined;
    resources?: undefined;
    availableResources?: undefined;
    stack?: undefined;
    export?: undefined;
    publications?: undefined;
    configuration?: undefined;
    instances?: undefined;
    imported?: undefined;
    deleted?: undefined;
} | {
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    stacks: import("./stacks.mjs").Stack[];
    book?: undefined;
    media?: undefined;
    resources?: undefined;
    availableResources?: undefined;
    stack?: undefined;
    export?: undefined;
    publications?: undefined;
    configuration?: undefined;
    instances?: undefined;
    imported?: undefined;
    deleted?: undefined;
} | {
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    resources: import("./stack-resources.ts").ResourceBindingView[];
    availableResources: import("./stack-resources.ts").ResourceBindingView[];
    book?: undefined;
    media?: undefined;
    stacks?: undefined;
    stack?: undefined;
    export?: undefined;
    publications?: undefined;
    configuration?: undefined;
    instances?: undefined;
    imported?: undefined;
    deleted?: undefined;
} | {
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    stack: import("./stacks.mjs").Stack;
    book?: undefined;
    media?: undefined;
    stacks?: undefined;
    resources?: undefined;
    availableResources?: undefined;
    export?: undefined;
    publications?: undefined;
    configuration?: undefined;
    instances?: undefined;
    imported?: undefined;
    deleted?: undefined;
} | {
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    stack: import("./stacks.mjs").Stack;
    export: {
        format: string;
        stack: string;
        revision: number;
        document: import("./stacks.mjs").StackDocument;
        configuration: {
            instance: string;
            app: string;
            mode: "own" | "shared";
            shareOf: string | null;
            settings: Record<string, string>;
        }[];
        covers: {
            composition: boolean;
            instanceConfiguration: boolean;
            publicationHistory: boolean;
            appRecords: boolean;
            appMedia: boolean;
            credentials: boolean;
        };
    };
    book?: undefined;
    media?: undefined;
    stacks?: undefined;
    resources?: undefined;
    availableResources?: undefined;
    publications?: undefined;
    configuration?: undefined;
    instances?: undefined;
    imported?: undefined;
    deleted?: undefined;
} | {
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    publications: {
        revision: number;
        publishedAt: string;
        document: import("./stacks.mjs").PublicationDocument;
    }[];
    book?: undefined;
    media?: undefined;
    stacks?: undefined;
    resources?: undefined;
    availableResources?: undefined;
    stack?: undefined;
    export?: undefined;
    configuration?: undefined;
    instances?: undefined;
    imported?: undefined;
    deleted?: undefined;
} | {
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    configuration: {
        entries: import("./stack-activation.mjs").ActivationEntry[];
        shared: {
            instanceId: string;
            app: string;
            name: string;
            shareOf: string | null;
        }[];
    };
    instances: {
        app: string;
        name: string;
        mode: "own" | "shared";
        shareOf: string | null;
        declared: import("./stacks.mjs").DeclaredField[];
        capabilities: string[];
        config: Record<string, string>;
        source: {
            id: string;
            repository: string;
            commit: string;
            manifestDigest: string;
        } | null;
    }[];
    book?: undefined;
    media?: undefined;
    stacks?: undefined;
    resources?: undefined;
    availableResources?: undefined;
    stack?: undefined;
    export?: undefined;
    publications?: undefined;
    imported?: undefined;
    deleted?: undefined;
} | {
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    stack: import("./stacks.mjs").Stack;
    imported: {
        name: string;
        instances: number;
        shared: number;
        configured: number;
        apps: string[];
        covers: {
            composition: boolean;
            instanceConfiguration: boolean;
            publicationHistory: boolean;
            appRecords: boolean;
            appMedia: boolean;
            credentials: boolean;
        };
    };
    book?: undefined;
    media?: undefined;
    stacks?: undefined;
    resources?: undefined;
    availableResources?: undefined;
    export?: undefined;
    publications?: undefined;
    configuration?: undefined;
    instances?: undefined;
    deleted?: undefined;
} | {
    outcome: "applied" | "unchanged" | "refused" | "partial" | "unknown";
    stack: import("./stacks.mjs").Stack;
    resources: import("./stack-resources.ts").ResourceBindingView[];
    completed: string[];
    problems: {
        instance: string;
        outcome: "refused" | "unknown";
        message: string;
    }[];
    publicationUnchanged: true;
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    book?: undefined;
    media?: undefined;
    stacks?: undefined;
    availableResources?: undefined;
    export?: undefined;
    publications?: undefined;
    configuration?: undefined;
    instances?: undefined;
    imported?: undefined;
    deleted?: undefined;
} | {
    outcome: "unknown" | "refused" | "applied" | "unchanged";
    message: string | undefined;
    stack: import("./stacks.mjs").Stack;
    resources: import("./stack-resources.ts").ResourceBindingView[];
    book: {
        instance: string;
        resource: string;
        shared: boolean;
        title: string;
        path: string;
        version: number;
        visible: boolean;
        paused: boolean;
        pending: boolean;
        items: {
            id: string;
            caption: string;
            author: string;
            status: "hidden" | "pending" | "approved" | "deleted" | "rejected";
            revision: number;
            synthetic: boolean;
            createdAt: string;
        }[];
    } | undefined;
    publicationUnchanged: true;
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    media?: undefined;
    stacks?: undefined;
    availableResources?: undefined;
    export?: undefined;
    publications?: undefined;
    configuration?: undefined;
    instances?: undefined;
    imported?: undefined;
    deleted?: undefined;
} | {
    ok: boolean;
    workspace: import("./stacks.mjs").Workspace;
    deleted: {
        id: string;
        name: string;
        slug: string;
        removedPublications: boolean;
    };
    book?: undefined;
    media?: undefined;
    stacks?: undefined;
    resources?: undefined;
    availableResources?: undefined;
    stack?: undefined;
    export?: undefined;
    publications?: undefined;
    configuration?: undefined;
    instances?: undefined;
    imported?: undefined;
}>;

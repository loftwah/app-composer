// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import type { D1Database } from "@cloudflare/workers-types";
export type Role = "owner" | "editor" | "viewer";
export interface Workspace {
    id: string;
    name: string;
    role: Role;
}
export interface StackResource {
    id: string;
    configurationRevision: number;
    digest: string;
    source: string;
    path: string;
    shared: boolean;
}
export interface StackInstance {
    id: string;
    app: string;
    label: string;
    caption: string;
    visible: boolean;
    binding: {
        mode: "own" | "shared";
        shareOf: string | null;
    };
    config: Record<string, string>;
    resource?: StackResource;
}
export interface StackDocument {
    version: number;
    name: string;
    description: string;
    theme: string;
    instances: StackInstance[];
}
export interface PublicationInstance {
    id: string;
    app: string;
    label: string;
    caption?: string;
    visible?: boolean;
    binding?: {
        mode?: "own" | "shared";
        shareOf?: string | null;
    };
    config?: Record<string, string>;
    resource?: StackResource;
}
export interface PublicationDocument {
    version: number;
    name: string;
    description?: string;
    theme: string;
    instances: PublicationInstance[];
}
export interface Stack {
    id: string;
    slug: string;
    name: string;
    status: "draft" | "published" | "archived";
    revision: number;
    publishedRevision: number | null;
    updatedAt: string;
    publishedAt: string | null;
    draft: StackDocument;
    published: PublicationDocument | null;
}
export interface PublicStack {
    id: string;
    slug: string;
    revision: number;
    publishedAt: string;
    name: string;
    description: string;
    theme: string;
    document: PublicationDocument;
}
export interface DeclaredField {
    key: string;
    label: string;
    type: "string" | "select";
    default: string;
    maxLength: number | null;
    options: string[] | null;
}
export declare const STACK_VERSION = 1;
export declare const LIMITS: {
    workspaceName: number;
    stackName: number;
    slug: number;
    description: number;
    instances: number;
    instanceLabel: number;
    instanceCaption: number;
};
export declare const THEMES: string[];
export declare const STATUSES: string[];
export declare const BINDING_MODES: string[];
export declare const STACK_APPS: Record<string, {
    name: string;
    route: string;
    standalone: string;
    purpose: string;
}>;
export declare const CAPABILITIES: Record<string, string[]>;
export declare class StackError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status?: number);
}
export declare function capabilityFor(role: unknown, action: string): boolean;
export declare function requireCapability(role: unknown, action: string): void;
interface PlatformActor {
    userId: string;
    requestId: string;
    leaseToken: string;
}
export declare function trustedPlatformActor(userId: string, requestId: string, leaseToken: string): object;
export declare function platformExecutionIdentity(actor: unknown): Readonly<PlatformActor> | undefined;
export declare function declaredConfig(appId: string): DeclaredField[] | null;
export declare function appCapabilities(appId: string): string[];
export declare function slugify(name: unknown): string;
export declare function normaliseStack(input: unknown): StackDocument;
export declare function emptyStack(name: string): StackDocument;
export declare function instanceConfiguration(stack: unknown, instanceId: string): {
    app: string;
    name: string;
    mode: "own" | "shared";
    shareOf: string | null;
    declared: DeclaredField[];
    capabilities: string[];
    config: Record<string, string>;
    source: {
        id: string;
        repository: string;
        commit: string;
        manifestDigest: string;
    } | null;
};
export declare function exportStack(stack: Pick<Stack, "draft" | "slug" | "revision">): {
    format: string;
    stack: string;
    revision: number;
    document: StackDocument;
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
export declare function describeImport(payload: unknown): {
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
export declare function importStack(db: D1Database, workspaceId: string, payload: unknown, { name, actor }?: {
    name?: unknown;
    actor?: unknown;
}): Promise<Stack>;
export declare function workspaceForUser(db: D1Database, user: unknown): Promise<Workspace>;
export declare function membership(db: D1Database, workspaceId: string, userId: unknown): Promise<Role | null>;
export declare function resolveWorkspace(db: D1Database, user: {
    id: string;
    name?: string | null;
}, requestedId?: unknown): Promise<Workspace>;
export declare function listStacks(db: D1Database, workspaceId: string): Promise<Stack[]>;
export declare function readStack(db: D1Database, workspaceId: string, stackId: unknown): Promise<Stack>;
export declare function createStack(db: D1Database, workspaceId: string, name: unknown, actor?: unknown): Promise<Stack>;
export declare function saveStack(db: D1Database, workspaceId: string, stackId: string, document: unknown, expectedRevision: unknown, actor?: unknown): Promise<Stack>;
export declare function publishStack(db: D1Database, workspaceId: string, stackId: string, expectedRevision: unknown, publishedDocument?: unknown, actor?: unknown): Promise<Stack>;
export declare function listPublications(db: D1Database, workspaceId: string, stackId: string): Promise<{
    revision: number;
    publishedAt: string;
    document: PublicationDocument;
}[]>;
export declare function republishRevision(db: D1Database, workspaceId: string, stackId: string, revision: unknown, expectedRevision: unknown, actor?: unknown): Promise<Stack>;
export declare function restoreRevisionToDraft(db: D1Database, workspaceId: string, stackId: string, revision: unknown, expectedRevision: unknown, actor?: unknown): Promise<Stack>;
export declare function unpublishStack(db: D1Database, workspaceId: string, stackId: string, expectedRevision: unknown, actor?: unknown): Promise<Stack>;
export declare function setArchived(db: D1Database, workspaceId: string, stackId: string, archived: boolean, expectedRevision: unknown, actor?: unknown): Promise<Stack>;
export declare function duplicateStack(db: D1Database, workspaceId: string, stackId: string, expectedRevision: unknown, actor?: unknown): Promise<Stack>;
export declare function deleteStack(db: D1Database, workspaceId: string, stackId: string, expectedRevision: unknown, actor?: unknown): Promise<{
    id: string;
    name: string;
    slug: string;
    removedPublications: boolean;
}>;
export declare function publicStack(db: D1Database, slug: unknown): Promise<PublicStack | null>;
export {};

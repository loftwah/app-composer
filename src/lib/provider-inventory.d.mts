// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
export declare const PROVIDER_INVENTORY_VERSION = "composer.provider-inventory/1";
export declare const PROVIDER_CHECK_VERSION = "composer.provider-check/2";
export declare const DEFAULT_MAX_PAGES = 3;
export declare const DEFAULT_PER_PAGE = 50;
export declare const DEFAULT_MAX_REQUESTS = 48;
export declare const DEFAULT_TIMEOUT_MS = 8000;
export declare const DEFAULT_DEADLINE_MS = 20000;
export declare const MAX_RESPONSE_BYTES = 2000000;
export declare const MAX_DETAIL_WORKERS = 16;
/** Bounded parallel detail reads. Requests are still GET-only and counted. */
export declare const DETAIL_CONCURRENCY = 4;
/** A provider observation older than this is shown as stale, not current. */
export declare const STALE_AFTER_HOURS = 24;
export type ProviderKind = "worker" | "d1" | "r2" | "kv" | "service";
export type ProviderEnvironment = "production" | "preview" | "unverified";
export type ObservationState = "verified" | "inaccessible" | "unread" | "missing" | "unverified" | "stale";
/** Whether a list endpoint was actually read, refused, or never attempted. */
export type CoverageState = "read" | "refused" | "unread";
export type ComparisonState = "match" | "drift" | "missing" | "unverified" | "inaccessible" | "stale" | "untracked";
export interface ProviderTag {
    key: string;
    value: string;
}
export interface CostUnknown {
    state: "unknown";
    note: string;
}
export declare const COST_UNKNOWN: CostUnknown;
export interface ProviderBindingFact {
    type: string;
    name: string;
    service?: string;
    environment?: string;
    entrypoint?: string;
    databaseId?: string;
    bucketName?: string;
    namespaceId?: string;
}
export interface WorkerFacts {
    scriptTag: string | null;
    versionId: string | null;
    deploymentId: string | null;
    deploymentMessage: string | null;
    deploymentRead: boolean;
    compatibilityDate: string | null;
    compatibilityFlags: string[];
    tags: ProviderTag[] | null;
    tagState: ObservationState;
    routes: string[];
    domains: string[];
    domainsRead: boolean;
    bindings: ProviderBindingFact[];
    schedules: string[];
    schedulesRead: boolean;
    cpuMs: number | null;
    observabilityEnabled: boolean | null;
    observabilitySampling: number | null;
    settingsRead: boolean;
}
export interface DatabaseFacts {
    tables: number | null;
    listTables: number | null;
    fileSize: number | null;
    region: string | null;
    jurisdiction: string | null;
}
export interface BucketFacts {
    location: string | null;
}
export interface NamespaceFacts {
    supportsUrlEncoding: boolean | null;
}
export interface ObservedResource {
    kind: ProviderKind;
    id: string;
    name: string;
    environment: ProviderEnvironment;
    state: ObservationState;
    createdOn: string | null;
    modifiedOn: string | null;
    observedAt: string;
    tags: ProviderTag[] | null;
    tagState: ObservationState;
    facts: WorkerFacts | DatabaseFacts | BucketFacts | NamespaceFacts | null;
    cost: CostUnknown;
}
export interface ProviderEndpoint {
    path: string;
    method: "GET";
    state: ObservationState;
    status: number | null;
    message: string | null;
    at: string;
}
export interface ProviderSnapshot {
    version: typeof PROVIDER_INVENTORY_VERSION;
    readOnly: true;
    scope: "composer" | "account";
    account: string;
    observedAt: string;
    observation: {
        utc: string;
        melbourne: string;
    };
    state: "verified" | "partial" | "inaccessible";
    endpoints: ProviderEndpoint[];
    resources: ObservedResource[];
    workersAtLimit: boolean;
    unrelatedResources: number;
    /** Per-resource-type list coverage. Unread is not refused and not absent. */
    lists: Partial<Record<"worker" | "d1" | "r2" | "kv", CoverageState>>;
    /** Per-Worker detail reads: asked, read, refused and never attempted. */
    detail: {
        requested: number;
        read: number;
        refused: number;
        unread: number;
    };
    limitations: string[];
    redactions: number;
    cost: CostUnknown;
}
export interface ExpectedCheck {
    field: string;
    expected: string | number | boolean | string[];
    source: string;
    /** `prefix` compares the start of a string instead of the whole value. */
    mode?: "equals" | "prefix";
}
export interface ExpectedResource {
    kind: ProviderKind;
    name: string;
    id: string | null;
    environment: ProviderEnvironment;
    source: string;
    identityRecorded: boolean;
    tags: ProviderTag[];
    checks: ExpectedCheck[];
    note: string | null;
}
/**
 * The committed evidence Composer records for one first-party app Worker.
 * This is a declaration, not provider truth: the bounded check compares it
 * with the account and leaves it unknown when the signal was not read.
 */
export interface AppWorkerIdentityRecord {
    app: string;
    worker: string;
    repo: string;
    manifest: string;
    environment: ProviderEnvironment;
    /** The app's documented production hostname, when it has a custom domain. */
    domain: string | null;
    /** The app's own deployment annotation prefix, when its deploy sets one. */
    annotationPrefix: string | null;
    /** Recorded release evidence; a receipt can be older than the live version. */
    receipt: {
        reference: string;
        versionId: string | null;
        commit: string | null;
    };
    nextAction: string;
}
export interface ExpectedInventory {
    account: string;
    resources: ExpectedResource[];
    identities: AppWorkerIdentityRecord[];
    composition: {
        id: string;
        annotation: string;
        apps: {
            id: string;
            commit: string;
            service: string;
            route: string;
            url: string;
        }[];
    };
    workerHints: Record<string, ProviderEnvironment>;
    databaseHints?: Record<string, ProviderEnvironment>;
    databaseIds?: string[];
    workerNames?: string[];
    settingsFor?: string[];
    schedulesFor?: string[];
    revision: string | null;
    sources: string[];
}
export interface ResourceChange {
    field: string;
    expected: string;
    observed: string;
}
export interface TagComparison {
    state: "match" | "partial" | "mismatch" | "unverified";
    expected: ProviderTag[];
    observed: ProviderTag[] | null;
    missing: string[];
    unexpected: string[];
}
export interface ResourceComparison {
    kind: ProviderKind;
    name: string;
    environment: ProviderEnvironment;
    expectedSource: string;
    expectedId: string | null;
    observedId: string | null;
    state: ComparisonState;
    detail: string;
    changes: ResourceChange[];
    tags: TagComparison;
    cost: CostUnknown;
    stale: boolean;
}
export interface ProviderComparison {
    comparisons: ResourceComparison[];
    /** In-scope observations that no declaration covers, by kind. */
    undeclared: {
        total: number;
        workers: {
            earlierCompositions: string[];
            otherComposerWorkers: string[];
        };
        storage: {
            d1: string[];
            r2: string[];
            kv: string[];
        };
        unrelatedResources: number;
    };
    counts: {
        expected: number;
        declaredObserved: number;
        observed: number;
        match: number;
        drift: number;
        missing: number;
        unverified: number;
        inaccessible: number;
        undeclared: number;
        undeclaredWorkers: number;
        undeclaredEarlier: number;
        undeclaredOther: number;
        undeclaredStorage: number;
        unrelated: number;
    };
    limitations: string[];
}
export interface ProviderReadOptions {
    token: string;
    account: string;
    request?: typeof fetch;
    now?: () => number;
    maxPages?: number;
    perPage?: number;
    maxRequests?: number;
    timeoutMs?: number;
    deadlineMs?: number;
    workerHints?: Record<string, ProviderEnvironment>;
    databaseHints?: Record<string, ProviderEnvironment>;
    workerNames?: string[];
    databaseIds?: string[];
    settingsFor?: string[];
    schedulesFor?: string[];
    scope?: "composer" | "account";
}
export interface RawResult {
    status: number;
    result: unknown;
}
/**
 * The complete provider surface this module may read. Anything else is refused
 * before a request is built, including script content, secrets, tag writes and
 * deployment or deletion endpoints.
 */
export declare function allowedProviderPath(path: string): boolean;
/** Build a bounded list path. Detail paths never carry a query string. */
export declare function providerListPath(account: string, suffix: string, page: number, perPage: number): string;
export declare function providerDetailPath(account: string, suffix: string): string;
export declare class ProviderBoundaryError extends Error {
    constructor(message: string);
}
/**
 * Reject a non-GET request before a URL is built. The production caller never
 * supplies a method; this guard is the contract test's refusal path.
 */
export declare function assertProviderGet(method: string): void;
/** Redact credential-like text from any provider error shown to an owner. */
export declare function redactProviderText(value: unknown, maximum?: number): string;
export declare function redactProviderMessage(value: unknown): {
    text: string;
    redacted: boolean;
};
/** Translate an instant into labelled UTC and Australia/Melbourne display. */
export declare function observationLabel(at: string): {
    utc: string;
    melbourne: string;
};
/** Stable, bounded tag values. Labels are not authority, only display metadata. */
export declare function normaliseTagValue(value: string): string;
export declare function composerTags(input: {
    app: string;
    service: string;
    environment: string;
    lifecycle: string;
    owner: string;
}): ProviderTag[];
/** Cloudflare returns tags as `key=value` strings; parse them without guessing. */
export declare function normaliseTags(value: unknown): ProviderTag[] | null;
export declare function compareTags(expected: ProviderTag[], observed: ProviderTag[] | null): TagComparison;
export declare function formatCost(cost: CostUnknown | null | undefined): string;
export declare function readProviderJson(request: typeof fetch, url: string, token: string, timeoutMs: number, method?: string): Promise<RawResult>;
export declare class ProviderRefusal extends Error {
    status: number;
    constructor(status: number, message: string);
}
export declare function readProviderInventory(options: ProviderReadOptions): Promise<ProviderSnapshot>;
/**
 * Compare Composer's declared expectations with one bounded observation.
 * Names and annotations are evidence for a comparison; they never grant
 * ownership, permission or billing authority.
 */
export declare function compareProviderInventory(expected: ExpectedInventory, snapshot: ProviderSnapshot, now?: number): ProviderComparison;
/** A deterministic, bounded summary line for a human report or PR receipt. */
export declare function providerCountsLine(comparison: ProviderComparison): string;

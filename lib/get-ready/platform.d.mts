export interface PlatformObservation {
  schema: "app-composer.platform-observation";
  version: 1;
  checkedAt: string;
  installation: { origin: string; source: string | null };
  workspace: { id: string; name: string; role: "owner" | "editor" | "viewer" };
  operator: boolean;
  target: { account: string; environment: string } | null;
  inventory: {
    existingStacks: number | null;
    managed: boolean;
    resumable: string[];
    partial: boolean;
  };
  policy: {
    revision: number;
    enabled: boolean;
    supported: boolean;
    reviewRequired: boolean;
    maxApplications: number;
  } | null;
  runner: boolean;
}
export interface PlatformAssessment {
  report: PlatformObservation;
  readOnly: true;
  ready: false;
  stale: boolean;
  next: { id: string; label: string; text: string };
}
export const platformReportLimit: number;
export function validatePlatformReport(
  input: unknown,
  now?: number,
): PlatformObservation;
export function inspectPlatformReport(
  input: unknown,
  now?: number,
): PlatformAssessment;
export function platformObservation(input: {
  origin: string;
  source: string | null;
  operator: boolean;
  checkedAt?: string;
  snapshot: {
    workspace: PlatformObservation["workspace"];
    profile: null | {
      revision: number;
      enabled: boolean;
      reviewRequired: boolean;
      maxApplications: number;
      allowedRecipes: string[];
      environments: string[];
      dataClasses: string[];
    };
    runner: { available: boolean };
    requests: { id: string; actorIsRequester: boolean; resumable: boolean }[];
    setup?: {
      target: { account: string; environment: string; url: string };
      existingStacks: number;
      managed: boolean;
    };
  };
}): PlatformObservation;

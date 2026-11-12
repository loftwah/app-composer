import type { ProjectReference } from "./project-direction.mjs";

export type ReferenceEvidenceStatus = "observed" | "partial" | "unavailable";

export interface ReferenceEvidenceResult {
  status: ReferenceEvidenceStatus;
  pageUrl?: string;
  observations: string[];
  gaps: string[];
}

export interface ReferenceEvidence {
  version: 1;
  scope: ProjectReference[];
  agent: { name: string; surface: string; version?: string };
  inspectedAt: string;
  results: ReferenceEvidenceResult[];
}

export const referenceEvidenceVersion: 1;
export function referenceEvidenceScope(
  references: readonly ProjectReference[],
): ProjectReference[];
export function validateReferenceEvidence(
  value: undefined,
  references: readonly ProjectReference[],
): undefined;
export function validateReferenceEvidence(
  value: unknown,
  references: readonly ProjectReference[],
): ReferenceEvidence | undefined;
export function referenceInspectionHandoff(
  references: readonly ProjectReference[],
): string;

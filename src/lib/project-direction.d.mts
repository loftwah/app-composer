export interface ProjectReference {
  source: string;
  decision: string;
  status: "selected" | "exploratory" | "rejected";
  usage?: string;
}

export interface ProjectDirection {
  version: 1;
  voice?: string;
  visual?: string;
  references: ProjectReference[];
}

export const projectDirectionVersion: 1;
export const maxProjectReferences: 3;
export const referenceStatuses: ProjectReference["status"][];
export function validateProjectDirection(
  value: unknown,
  validText: (value: unknown, max: number, label: string) => string,
): ProjectDirection | undefined;

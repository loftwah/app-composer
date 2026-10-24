export type DeviceKind = "desktop" | "phone" | "tablet";
export type DeviceActivity =
  "core" | "view" | "edit" | "play" | "import" | "export";
export type DeviceTarget = "unknown" | "desktop" | "mobile" | "both";
export interface DeviceAssessment {
  status: "unknown" | "supported" | "limited" | "unsupported";
  note?: string;
  requirements?: string[];
  evidence?: {
    revision: string;
    checked: string;
    method: "browser-emulation" | "physical-device";
    journey: string;
  };
}
export interface DeviceSupport {
  version: 1;
  target: DeviceTarget;
  activities: Partial<
    Record<DeviceActivity, Partial<Record<DeviceKind, DeviceAssessment>>>
  >;
}
export const deviceKinds: DeviceKind[];
export const deviceActivities: DeviceActivity[];
export const deviceTargets: DeviceTarget[];
export function validateDeviceTarget(input?: unknown): DeviceTarget;
export function validateDeviceSupport(input?: unknown): DeviceSupport;
export function readDeviceSupport(
  input?: unknown,
  revision?: string,
): DeviceSupport;
export function deviceAssessment(
  support: DeviceSupport,
  device: DeviceKind,
  activity?: DeviceActivity,
): DeviceAssessment;
export function deviceSummary(support: DeviceSupport): string;
export function deviceFilterTokens(support: DeviceSupport): string;

export function releaseDeviceSupport(
  id: string,
  revision: string,
  manifest: unknown,
  records: unknown,
): DeviceSupport;

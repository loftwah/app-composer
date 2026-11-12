export interface Spec {
  projectDirection?: import("./project-direction.mjs").ProjectDirection;
  deviceTarget?: import("./device-support.mjs").DeviceTarget;
  maintenance?: {
    task: "health" | "verify" | "updates" | "accessibility";
    scope: "assess" | "prepare";
    revision: 1;
  };
  version: 2;
  preset: string;
  apps: string[];
  sources: import("./app-settings.mjs").AppSource[];
  appSettings: Record<string, Record<string, string>>;
  config: { title: string; intro: string; theme: string; layout: string };
  privacy: string;
  cards: { title: string; url: string }[];
  deployment: { mode: string; hostname: string; approval: string };
  delivery: { profile: "local" | "existing-runner"; runner: string };
  updates: string;
  decisions: Record<string, string>;
}
export interface Question {
  id: string;
  title: string;
  help: string;
  recommend: string;
  when?: Record<string, string[]>;
  options: string[][];
}
export const presets: Record<
  string,
  {
    apps: string[];
    sources: import("./app-settings.mjs").AppSource[];
    appSettings: Record<string, Record<string, string>>;
    title: string;
    intro: string;
  }
>;
export const questions: Question[];
export function validateSpec(input: unknown): Spec;
export function handoff(spec: Spec): string;
export function pruneAnswers(
  answers: Record<string, string>,
): Record<string, string>;
export function visibleQuestions(answers: Record<string, string>): Question[];
export function explorerSpec(answers: Record<string, string>): Spec;

export const specVersion: 2;
export const maintenanceRevision: 1;
export const maintenanceTasks: Record<
  "health" | "verify" | "updates" | "accessibility",
  string
>;
export const maintenanceScopes: ("assess" | "prepare")[];
export function validateMaintenance(
  value: unknown,
): Spec["maintenance"];
export const deliveryProfiles: ("local" | "existing-runner")[];
export const deliveryRunners: ("jenkins" | "gitlab" | "buildkite" | "other")[];
export const deliveryCommands: string[];
export function validateDelivery(value: unknown): Spec["delivery"];

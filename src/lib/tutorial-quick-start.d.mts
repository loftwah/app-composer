export type TutorialPromptKind = 'reproduce' | 'add' | 'explain' | 'next';
export interface TutorialPrompt {
  id: string;
  kind: TutorialPromptKind;
  label: string;
  text: string;
}
export interface TutorialOutcome {
  built: string;
  does: string;
  needs: string[];
  result: string;
}
export interface TutorialQuickStart {
  title: string;
  summary: string;
  outcome: TutorialOutcome;
  links: { label: string; href: string }[];
  prompts: TutorialPrompt[];
}
export const tutorialPromptKinds: TutorialPromptKind[];
export function validateQuickStart(guide: TutorialQuickStart): TutorialQuickStart;
export const mediaStudioQuickStart: TutorialQuickStart;
export const firstAppQuickStart: TutorialQuickStart;
export const buildingQuickStart: TutorialQuickStart;
export const creatorHubQuickStart: TutorialQuickStart;
export const paperworkQuickStart: TutorialQuickStart;
export const launchKitQuickStart: TutorialQuickStart;

export interface TutorialPrompt { id: string; label: string; text: string }
export interface TutorialQuickStart { title: string; summary: string; links: { label: string; href: string }[]; prompts: TutorialPrompt[] }
export function validateQuickStart(guide: TutorialQuickStart): TutorialQuickStart;
export const mediaStudioQuickStart: TutorialQuickStart;
export const firstAppQuickStart: TutorialQuickStart;

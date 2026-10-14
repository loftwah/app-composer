export type SiteSkillId = 'building-emdash-site' | 'creating-plugins' | 'emdash-cli';
export function prepareSiteSkills(options: {workspace: string; availableSkills: SiteSkillId[]}, env?: Record<string, string | undefined>): {
 changed: boolean; purpose: 'emdash-site'; declaredVersion: '1.2.0'; installedVersion: 'not-probed'; ready: false;
 source: {repository: string; commit: string; reviewed: string; licence: 'MIT'};
 skills: {id: SiteSkillId; state: 'prepared'|'reviewed-copy'|'preserved-project-copy'|'preserved-other-scope'|'advertised-by-agent'; agentVisible: 'not-probed'; exercised: false}[];
};
export function validateSkillInventory(input: unknown): SiteSkillId[];

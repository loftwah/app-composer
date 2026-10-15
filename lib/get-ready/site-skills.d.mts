export type SiteSkillId = 'building-emdash-site' | 'creating-plugins' | 'emdash-cli';
export function prepareSiteSkills(options: {workspace: string; availableSkills: SiteSkillId[]; purpose?:'emdash-site'|'emdash-plugin'}, env?: Record<string, string | undefined>): {
 changed: boolean; purpose: 'emdash-site'|'emdash-plugin'; declaredVersion: '1.2.0'; installedVersion: 'not-probed'; ready: false;
 source: {repository: string; commit: string; reviewed: string; licence: 'MIT'};
 skills: {id: SiteSkillId; state: 'prepared'|'reviewed-copy'|'preserved-project-copy'|'preserved-other-scope'|'advertised-by-agent'; agentVisible: 'not-probed'; exercised: false}[];
};
export function validateSkillPurpose(input:unknown):'emdash-site'|'emdash-plugin';
export function validateSkillInventory(input: unknown): SiteSkillId[];

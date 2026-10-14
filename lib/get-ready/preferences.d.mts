export interface SetupPreferences {version:1;destination:'preview'|'existing-domain'|'new-domain';hostname:string}
export const setupPreferenceKey:string;
export const defaultSetupPreferences:Readonly<SetupPreferences>;
export function validateSetupPreferences(input:unknown):SetupPreferences;
export function setupPreferenceHandoff(input:unknown):string;
export interface AssistancePreference {version:1;level:'easy'|'guided'|'advanced'}
export const assistancePreferenceKey:string;
export const defaultAssistancePreference:Readonly<AssistancePreference>;
export const assistanceLevels:Record<AssistancePreference['level'],{label:string;help:string}>;
export function validateAssistancePreference(input:unknown):AssistancePreference;
export function assistanceHandoff(input:unknown):string;

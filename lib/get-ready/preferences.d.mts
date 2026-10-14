export interface SetupPreferences {version:1;destination:'preview'|'existing-domain'|'new-domain';hostname:string}
export const setupPreferenceKey:string;
export const defaultSetupPreferences:Readonly<SetupPreferences>;
export function validateSetupPreferences(input:unknown):SetupPreferences;
export function setupPreferenceHandoff(input:unknown):string;

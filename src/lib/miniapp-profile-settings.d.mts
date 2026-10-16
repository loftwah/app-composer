import type {ProfileSettingsFile,ProfileValues,ProfileSettingKey} from './miniapp-profile-settings-fields.mjs';
export type ProfileReview={ok:true;saved:false;before:ProfileValues;after:ProfileValues;changedFields:ProfileSettingKey[]};
export function profileSettingsCommand(input:unknown):null|{action:'review';file:ProfileSettingsFile}|{action:'apply';file:ProfileSettingsFile;expected:ProfileValues};
export function profileSettingsResult(operation:string,result:unknown,requested:unknown):{ok:true;file:ProfileSettingsFile}|ProfileReview|{ok:true;saved:true;config:ProfileValues;changedFields:ProfileSettingKey[]};

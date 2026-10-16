export interface AppSettingField {key:string;label:string;type:string;default?:string;maxLength?:number;format?:string;hosts?:string[];options?:string[];choices:{value:string;label:string}[]}
export interface AppSource {id:string;repository:string;commit:string;manifestDigest:string}
export const appSettings:Record<string,{id:string;name:string;source:AppSource;cardPresentation:{version:number;icons:string[]}|null;achievementCollection:{version:number;limit:number;datePrecisions:string[]}|null;tagCollection:{version:number;limit:number;context:string[]}|null;profileSettings:{version:number;format:string;maxFileBytes:number}|null;fields:AppSettingField[]}>;
export function selectedSources(ids:string[]):AppSource[];
export function validateSources(input:unknown,ids:string[]):AppSource[];
export function validateAppSettings(input:unknown,ids:string[]):Record<string,Record<string,string>>;
export function appConfiguration(spec:{apps:string[];config:Record<string,string>;appSettings?:Record<string,Record<string,string>>},id:string):Record<string,string>;

export function validateAppSettingValue(field:AppSettingField,value:unknown,name:string):string;

export function appConfigurationPatch(spec:{apps:string[];config:Record<string,string>;appSettings?:Record<string,Record<string,string>>},id:string):Record<string,string>;
export function validateConfigurationPatch(input:unknown,id:string):Record<string,string>;

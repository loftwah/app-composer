export interface AppSettingField {key:string;label:string;type:string;default?:string;maxLength?:number;options?:string[];choices:{value:string;label:string}[]}
export interface AppSource {id:string;repository:string;commit:string;manifestDigest:string}
export const appSettings:Record<string,{id:string;name:string;source:AppSource;fields:AppSettingField[]}>;
export function selectedSources(ids:string[]):AppSource[];
export function validateSources(input:unknown,ids:string[]):AppSource[];
export function validateAppSettings(input:unknown,ids:string[]):Record<string,Record<string,string>>;
export function appConfiguration(spec:{apps:string[];config:Record<string,string>;appSettings?:Record<string,Record<string,string>>},id:string):Record<string,string>;

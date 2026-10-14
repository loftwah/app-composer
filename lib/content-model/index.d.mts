export type FieldKind='string'|'text'|'url'|'date'|'integer'|'boolean'|'select'|'repeater';
export interface ContentField {key:string;label:string;type:FieldKind;required:boolean;defaultValue?:string|number|boolean;validation?:{min?:number;max?:number;maxLength?:number};group?:string;choices?:string[];limit?:number;fields?:ContentField[];when?:{field:string;equals:string|boolean}}
export interface ContentModel {schema:'app-composer.content-model';version:1;collection:string;label:string;groups:string[];fields:ContentField[]}
export const modelVersion:1;
export const maxModelBytes:number;
export const fieldTypes:Readonly<Record<FieldKind,string>>;
export const starterModel:ContentModel;
export function validateContentModel(input:unknown):ContentModel;
export function visibleModelFields(input:unknown,values:Record<string,unknown>):ContentField[];
export function validateModelValues(input:unknown,values:Record<string,unknown>):Record<string,unknown>;
export function emdashSeed(input:unknown):{version:'1';meta:{name:string};collections:{slug:string;label:string;routable:boolean;supports:string[];fields:Record<string,unknown>[]}[]};
export function contentModelHandoff(input:unknown):string;

export function contentProjectHandoff(input:unknown):string;

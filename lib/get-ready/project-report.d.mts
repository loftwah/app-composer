export const projectReportLimit:number;
export const projectGuidance:string[];
export const projectLimits:string[];
export interface ProjectReport {version:1;kind:'app-composer.project-inspection';inspectedAt:string;workspaceFingerprint:string;purpose:'general'|'emdash-site'|'emdash-plugin';readOnly:true;ready:false;manifest:{state:string;emdashDeclared:boolean;emdashVersion:string|null;installedVersion:'not-probed';commands:Record<'build'|'test'|'check',boolean>};lockfiles:{path:string;state:string;sha256?:string}[];guidance:{path:string;state:string;sha256?:string}[];skills:{id:string;path:string;required:boolean;state:string;sha256?:string;entrypoint:string;agentVisible:'not-probed';exercised:false}[];source:Record<string,string>;optional:{diagrams:string};findings:{id:string;action:string}[];limits:string[]}
export function validateProjectReport(input:unknown,now?:number):ProjectReport;
export function inspectProjectReport(input:unknown,now?:number):{report:ProjectReport;stale:boolean;ready:false;summary:string;next:{id:string;action:string}[]};
export function fictionalProjectReport(now?:number):ProjectReport;
export function projectFindings(report:ProjectReport):{id:string;action:string}[];
export function projectSkillRequired(purpose:string,id:string):boolean;
export function declaredProjectVersion(value:unknown):string|null;

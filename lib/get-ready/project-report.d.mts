export const projectReportLimit:number;
export const projectGuidance:string[];
export const projectLimits:string[];
export interface ProjectInstallation {state:'not-requested'|'not-probed'|'present'|'absent'|'invalid'|'refused'|'oversize'|'changed'|'denied';version:string|null}
interface Manifest {state:string;emdashDeclared:boolean;emdashVersion:string|null;commands:Record<'build'|'test'|'check',boolean>}
interface ProjectReportBase {kind:'app-composer.project-inspection';inspectedAt:string;workspaceFingerprint:string;purpose:'general'|'emdash-site'|'emdash-plugin';readOnly:true;ready:false;lockfiles:{path:string;state:string;sha256?:string}[];guidance:{path:string;state:string;sha256?:string}[];skills:{id:string;path:string;required:boolean;state:string;sha256?:string;entrypoint:string;agentVisible:'not-probed';exercised:false}[];source:Record<string,string>;optional:{diagrams:string};findings:{id:string;action:string}[];limits:string[]}
export type ProjectReport=ProjectReportBase & ({version:1;manifest:Manifest & {installedVersion:'not-probed'}} | {version:2;manifest:Manifest & {installation:ProjectInstallation}});
export function projectInstallation(report:ProjectReport):ProjectInstallation;
export function projectInstallationText(report:ProjectReport):string;
export function validateProjectReport(input:unknown,now?:number):ProjectReport;
export function inspectProjectReport(input:unknown,now?:number):{report:ProjectReport;stale:boolean;ready:false;summary:string;next:{id:string;action:string}[]};
export function fictionalProjectReport(now?:number):ProjectReport;
export function projectFindings(report:ProjectReport):{id:string;action:string}[];
export function projectSkillRequired(purpose:string,id:string):boolean;
export function declaredProjectVersion(value:unknown):string|null;

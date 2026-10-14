export interface ProgressCheck {id:string;state:string;verifiedAt:string|null;recovery:string|null;tools:{tool:string;state:string}[]}
export type ReadinessReport = {schema:string;recipe:string;exportedAt:string;state:string;expiresAt:string|null;checks:ProgressCheck[];operations:{id:string;state:string;recovery:string}[]} & ({version:1}|{version:2;workingTree:'clean'|'changed'|'unknown'});
export const progressOperationLabels:Record<string,string>;
export const progressChecks:Record<string,{label:string;help:string}>;
export function validateReadinessReport(input:unknown,now?:number):ReadinessReport;
export function readinessReport(session:any,now?:number):ReadinessReport;
export function inspectReadinessReport(input:unknown,now?:number):{report:ReadinessReport;inspection:{ready:boolean;state:string;capabilities:Record<string,boolean>}};
export function progressStep(check:Pick<ProgressCheck,'id'|'state'|'recovery'>,current:boolean):string;
export function progressHelp(step:Pick<ProgressCheck,'id'|'state'|'recovery'>,current?:boolean):{href:string;label:string}|null;

export function progressWorkspace(report:ReadinessReport):string;

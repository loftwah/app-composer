export interface DomainReport {schema:'app-composer.domain-report';version:1;checkedAt:string;domain:string;zone:{state:string;issue:string|null};nameservers:{lookup:string;issue:string|null;assigned:string[];observed:string[]};dnssec:{state:string;issue:string|null;expected:string|null;lookup:string;lookupIssue:string|null;published:string[]}}
export const domainReportLimit:number;
export function domainName(value:unknown):string;
export function dsRecord(value:unknown):string;
export function validateDomainReport(input:unknown,now?:number):DomainReport;
export function inspectDomainReport(input:unknown,now?:number):{report:DomainReport;stale:boolean;dnsReady:boolean;nameserversMatch:boolean;dsMatch:boolean;next:{id:string;text:string;help:string}[]};

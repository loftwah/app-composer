export interface InspectionReport {contract:1;kind:'page-inspection';url:string;sourceSha:string;checkedAt:string;title:string;findings:{status:'pass'|'fix'|'review';label:string;detail:string}[]}
export function validateInspectionReport(value:unknown):InspectionReport;

import {validateReadinessReport,type ReadinessReport} from '../../lib/get-ready/report.mjs';
export const savedReportKey='composer:ready:report:v1';
export const readyReportEvent='composer:ready-report';
// Only the existing strictly redacted interchange format may cross pages.
export function savedReadyReport():ReadinessReport|null{
 const text=localStorage.getItem(savedReportKey);if(!text)return null;
 if(new TextEncoder().encode(text).length>16384)throw Error('The saved report is too large. Replace it with a redacted agent export.');
 return validateReadinessReport(JSON.parse(text));
}
export function announceReadyReport(report:ReadinessReport|null){window.dispatchEvent(new CustomEvent(readyReportEvent,{detail:report}));}

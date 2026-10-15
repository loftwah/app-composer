export interface ProjectInspectionOptions {workspace:string;purpose?:'auto'|'emdash-site'|'emdash-plugin';diagrams?:boolean}
import type {ProjectReport} from './project-report.mjs';
export function inspectProject(options:ProjectInspectionOptions):Extract<ProjectReport,{version:2}>;

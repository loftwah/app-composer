export interface AccessRuntime {CF_ACCESS_TEAM_DOMAIN?:string;CF_ACCESS_AUDIENCE?:string}
export function protectAdministration(request:Request,runtime:AccessRuntime):Promise<Response|null>;

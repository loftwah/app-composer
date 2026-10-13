import type {ExecutionContext} from '@cloudflare/workers-types';
import handler, { createScheduledHandler, PluginBridge } from '@emdash-cms/cloudflare/worker';
import {protectAdministration,type AccessRuntime} from './lib/access-boundary.mjs';
export { PluginBridge };
const guardedFetch:NonNullable<typeof handler.fetch>=async(request:Request,runtime:AccessRuntime,context:ExecutionContext)=>{
 const rejection=await protectAdministration(request as unknown as Request,runtime as AccessRuntime);
 if(rejection)return rejection;
 return handler.fetch!(request,runtime,context);
};
export default {...handler,fetch:guardedFetch,scheduled:createScheduledHandler()};

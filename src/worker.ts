import type {D1Database,RateLimit,ExecutionContext,ScheduledController} from '@cloudflare/workers-types';
import handler, { createScheduledHandler, PluginBridge } from '@emdash-cms/cloudflare/worker';
import {protectAdministration,type AccessRuntime} from './lib/access-boundary.mjs';
import {collect,record,purge} from '../lib/usage/index.mjs';
import {health,pageEvent,postcardReceiptEvent} from '../lib/usage/publisher.mjs';
import {usageSummary} from './lib/usage';
import {portfolioWindow,portfolioSummary} from '../lib/usage/portfolio.mjs';
import build from './lib/build.json';
import {publicFilmAsset} from './lib/public-film-assets';
import {purgePrivateOutcomes} from './lib/private-outcome-events';
import {mountedBuilderNavigation} from './lib/mounted-builder-navigation';
import {builderNavigationRedirect} from './lib/builder-context.mjs';
type Runtime=AccessRuntime & {DB:D1Database;PUBLIC_ORIGIN:string;USAGE_TOKENS?:string;USAGE_LIMIT?:RateLimit;ASSETS?:{fetch(request:Request):Promise<Response>}};
export { PluginBridge };
const guardedFetch:NonNullable<typeof handler.fetch>=async(request:Request,runtime:Runtime,context:ExecutionContext)=>{
 const rejection=await protectAdministration(request as unknown as Request,runtime as AccessRuntime);
 if(rejection)return rejection;
 const film=await publicFilmAsset(request,runtime.ASSETS,undefined,context);if(film)return film;
 const navigation=builderNavigationRedirect(request);if(navigation)return navigation;
 const path=new URL(request.url).pathname;
 const probe=health(request,'/healthz','app-composer',build.commit);if(probe)return probe;
 if(path==='/api/portfolio-analytics'){
  if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
  const now=new Date();const params=new URL(request.url).searchParams;let period;try{period=portfolioWindow(params,now);}catch{return Response.json({error:'invalid_parameters'},{status:400,headers:{'Cache-Control':'no-store'}});}
  const surface=['standalone','composed'].includes(params.get('surface')??'')?params.get('surface') as 'standalone'|'composed':'all';
  try{return Response.json(await portfolioSummary(runtime.DB,period,now,build.commit,surface),{headers:{'Cache-Control':'public,max-age=60,s-maxage=300','X-Content-Type-Options':'nosniff'}});}catch{return Response.json({error:'reporting_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
 }
 const ingest=path.match(/^\/api\/usage\/(hello|guestbook|showcase|linkcheck|state)$/);if(ingest)return collect(request,runtime,ingest[1]);
 if(path==='/api/usage'){if(request.method!=='GET')return new Response(null,{status:405});try{return Response.json(await usageSummary(runtime.DB,new URL(request.url).searchParams,runtime.PUBLIC_ORIGIN),{headers:{'Cache-Control':'public,max-age=60','X-Content-Type-Options':'nosniff'}});}catch{return Response.json({error:'Counts temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
 const response=await handler.fetch!(request,runtime,context);
 const app=path.match(/^\/(guestbook|showcase)(?:\/|$)/)?.[1];
 if(app&&request.headers.get('X-Composer-Verification')!=='1'){const event=(app==='guestbook'?postcardReceiptEvent(request,response,'/'+app):null)??pageEvent(request,response,'/'+app);if(event)context.waitUntil((async()=>{if(runtime.USAGE_LIMIT&&(await runtime.USAGE_LIMIT.limit({key:app+':'+event})).success)await record(runtime.DB,app,event,'composed');})().catch(()=>{}));}
 return mountedBuilderNavigation(request,response);
};
const cmsScheduled=createScheduledHandler();
export default {...handler,fetch:guardedFetch,scheduled:async(controller:ScheduledController,runtime:Runtime,context:ExecutionContext)=>{
 const date=new Date(controller.scheduledTime);
 if(date.getUTCHours()===0&&date.getUTCMinutes()===0)context.waitUntil(purge(runtime.DB,date).catch(()=>{console.error('Daily count retention unavailable');}));
 if(date.getUTCHours()===0&&date.getUTCMinutes()===0)context.waitUntil(purgePrivateOutcomes(runtime.DB,date).catch(()=>{console.error('Private outcome retention unavailable');}));
 return cmsScheduled(controller,runtime,context);
}};

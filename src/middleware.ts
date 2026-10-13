import {defineMiddleware} from 'astro:middleware';
import {env} from 'cloudflare:workers';
const runtime=env as unknown as {CF_ACCESS_TEAM_DOMAIN?:string;CF_ACCESS_AUDIENCE?:string;GUESTBOOK?:{fetch(req:Request):Promise<Response>};SHOWCASE?:{fetch(req:Request):Promise<Response>}};
export const onRequest=defineMiddleware(async(context,next)=>{
 const path=context.url.pathname;
 const app=path.match(/^\/(guestbook|showcase)(?:\/|$)/)?.[1];
 if(app){const binding=app==='guestbook'?runtime.GUESTBOOK:runtime.SHOWCASE;if(!binding)return new Response('This isolated environment has no app service binding.',{status:503,headers:{'Cache-Control':'no-store'}});return binding.fetch(context.request);}
 const response=await next();response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');response.headers.set('X-Frame-Options','DENY');response.headers.set('Cache-Control','no-store');return response;
});

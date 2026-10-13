import {defineMiddleware} from 'astro:middleware';
import {env} from 'cloudflare:workers';
import {createRemoteJWKSet,jwtVerify} from 'jose';
const runtime=env as unknown as {CF_ACCESS_TEAM_DOMAIN?:string;CF_ACCESS_AUDIENCE?:string;GUESTBOOK?:{fetch(req:Request):Promise<Response>};SHOWCASE?:{fetch(req:Request):Promise<Response>}};
export const onRequest=defineMiddleware(async(context,next)=>{
 const path=context.url.pathname;
 if(path.startsWith('/_emdash')){
  const team=runtime.CF_ACCESS_TEAM_DOMAIN,aud=runtime.CF_ACCESS_AUDIENCE,jwt=context.request.headers.get('Cf-Access-Jwt-Assertion');
  if(!team||!aud||!jwt)return new Response('Owner administration is closed until Cloudflare Access is configured. Public catalogue reading remains available.',{status:403,headers:{'Cache-Control':'no-store','Content-Type':'text/plain'}});
  if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team))return new Response('Invalid Access configuration',{status:503});
  try{await jwtVerify(jwt,createRemoteJWKSet(new URL('https://'+team+'/cdn-cgi/access/certs')),{issuer:'https://'+team,audience:aud,algorithms:['RS256']});}catch{return new Response('Access identity was not accepted',{status:403,headers:{'Cache-Control':'no-store'}});}
 }
 const app=path.match(/^\/(guestbook|showcase)(?:\/|$)/)?.[1];
 if(app){const binding=app==='guestbook'?runtime.GUESTBOOK:runtime.SHOWCASE;if(!binding)return new Response('This isolated environment has no app service binding.',{status:503,headers:{'Cache-Control':'no-store'}});return binding.fetch(context.request);}
 const response=await next();response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');response.headers.set('X-Frame-Options','DENY');response.headers.set('Cache-Control','no-store');return response;
});

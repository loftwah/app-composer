import type {D1Database} from '@cloudflare/workers-types';
import {selection,summary} from '../../lib/usage/index.mjs';
export async function usageSummary(db:D1Database,params:URLSearchParams,origin:string){
 const options=selection(params),day=new Date().toISOString().slice(0,10);
 // A finite cache key excludes caller URLs, query text and identities.
 const key=new Request(`${new URL(origin).origin}/api/usage-cache-v1/${day}/${options.days}/${options.surface}`);
 const cache=await caches.open('composer-usage-v1');
 const cached=await cache.match(key);if(cached)return await cached.json() as Awaited<ReturnType<typeof summary>>;
 const result=await summary(db,options);
 await cache.put(key,Response.json(result,{headers:{'Cache-Control':'public,max-age=60'}}));
 return result;
}

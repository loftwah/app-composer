import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import emdash from 'emdash/astro';
import { d1, r2, access } from '@emdash-cms/cloudflare';
export default defineConfig({security:{csp:{directives:["default-src 'self'","object-src 'none'","base-uri 'none'","frame-ancestors 'none'","form-action 'self'","connect-src 'self'","img-src 'self'","font-src 'self'","frame-src 'none'"],scriptDirective:{resources:["'self'","https://static.cloudflareinsights.com/beacon.min.js"]}}},vite:{plugins:[tailwindcss()]},site:'https://composer.loftwah.com',output:'server',adapter:cloudflare({imageService:'passthrough'}),integrations:[react(),emdash({database:d1({binding:'DB',session:'disabled'}),auth:access({teamDomain:'jolly-cake-2b85.cloudflareaccess.com',audienceEnvVar:'CF_ACCESS_AUDIENCE',autoProvision:true,defaultRole:20,syncRoles:false}),storage:r2({binding:'MEDIA'}),plugins:[{id:'composer-resend',version:'1.0.0',format:'native',entrypoint:new URL('./src/plugins/resend.ts',import.meta.url).pathname,options:{},capabilities:['hooks.email-transport:register']}],siteUrl:'https://composer.loftwah.com',admin:{locales:['en']},maxUploadSize:1024*1024,toolbar:false})],devToolbar:{enabled:false}});

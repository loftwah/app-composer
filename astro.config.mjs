import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import emdash from 'emdash/astro';
import { d1, r2, access } from '@emdash-cms/cloudflare';
const printsPlugins = process.env.APP_COMPOSER_PRINTS_PLUGIN === '1' ? [{
  id: 'composer-prints', version: '1.0.0', format: 'native',
  entrypoint: new URL('./src/plugins/prints.ts', import.meta.url).pathname, options: {},
}] : [];
const decisionAdmin = new URL('./src/plugins/decisions-admin.tsx', import.meta.url).pathname;
const decisionsPlugin = {
  id: 'composer-decisions', version: '1.0.0', format: 'native',
  entrypoint: new URL('./src/plugins/decisions.ts', import.meta.url).pathname,
  adminEntry: decisionAdmin, options: {adminEntry: decisionAdmin},
};
const feedbackObserverPlugin = {
  id: 'composer-feedback-observer', version: '1.0.0', format: 'native',
  entrypoint: new URL('./src/plugins/feedback-observer.ts', import.meta.url).pathname, options: {},
};
const decisionArtRoute = {
  name: 'composer-decision-art',
  hooks: {
    'astro:config:setup': ({injectRoute}) => {
      injectRoute({
        pattern: '/_emdash/api/owner-feedback',
        entrypoint: new URL('./src/routes/owner-feedback.ts', import.meta.url).pathname,
      });
      injectRoute({
        pattern: '/_emdash/api/decision-art/[id]',
        entrypoint: new URL('./src/routes/decision-art.ts', import.meta.url).pathname,
      });
      injectRoute({
        pattern: '/_emdash/api/decision-image/[id]/[revision]',
        entrypoint: new URL('./src/routes/decision-image.ts', import.meta.url).pathname,
      });
    },
  },
};
export default defineConfig({security:{csp:{directives:["default-src 'self'","object-src 'none'","base-uri 'none'","frame-ancestors 'none'","form-action 'self'","connect-src 'self'","img-src 'self'","font-src 'self'","frame-src 'none'"],scriptDirective:{resources:["'self'","https://static.cloudflareinsights.com/beacon.min.js","https://static.cloudflareinsights.com/beacon.min.js/"]}}},vite:{plugins:[tailwindcss()]},site:'https://composer.loftwah.com',output:'server',adapter:cloudflare({imageService:'passthrough'}),integrations:[react(),decisionArtRoute,emdash({database:d1({binding:'DB',session:'disabled'}),auth:access({teamDomain:'jolly-cake-2b85.cloudflareaccess.com',audienceEnvVar:'CF_ACCESS_AUDIENCE',autoProvision:true,defaultRole:10,syncRoles:false}),storage:r2({binding:'MEDIA'}),plugins:[...printsPlugins,decisionsPlugin,feedbackObserverPlugin,{id:'composer-members',version:'1.0.0',format:'native',entrypoint:new URL('./src/plugins/members.ts',import.meta.url).pathname,options:{}},{id:'composer-miniapps',version:'1.0.0',format:'native',entrypoint:new URL('./src/plugins/miniapps.ts',import.meta.url).pathname,adminEntry:new URL('./src/plugins/miniapps-admin.tsx',import.meta.url).pathname,options:{adminEntry:new URL('./src/plugins/miniapps-admin.tsx',import.meta.url).pathname}},{id:'composer-stacks',version:'1.0.0',format:'native',entrypoint:new URL('./src/plugins/stacks.ts',import.meta.url).pathname,adminEntry:new URL('./src/plugins/stacks-admin.tsx',import.meta.url).pathname,options:{adminEntry:new URL('./src/plugins/stacks-admin.tsx',import.meta.url).pathname}},{id:'composer-media',version:'1.0.0',format:'native',entrypoint:new URL('./src/plugins/media.ts',import.meta.url).pathname,adminEntry:new URL('./src/plugins/media-admin.tsx',import.meta.url).pathname,options:{adminEntry:new URL('./src/plugins/media-admin.tsx',import.meta.url).pathname}},{id:'composer-resend',version:'1.0.0',format:'native',entrypoint:new URL('./src/plugins/resend.ts',import.meta.url).pathname,options:{},capabilities:['hooks.email-transport:register']}],siteUrl:'https://composer.loftwah.com',admin:{locales:['en']},maxUploadSize:1024*1024,toolbar:false})],devToolbar:{enabled:false}});

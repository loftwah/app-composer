import {defineConfig} from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import emdash from 'emdash/astro';
import {d1,r2} from '@emdash-cms/cloudflare';
import model from './src/content-model.json' with {type:'json'};
export default defineConfig({output:'server',adapter:cloudflare({imageService:'passthrough'}),vite:{plugins:[tailwindcss()]},integrations:[react(),emdash({database:d1({binding:'DB',session:'disabled'}),storage:r2({binding:'MEDIA'}),toolbar:false,plugins:[{id:'composer-content-fields',version:'1.0.0',format:'native',entrypoint:new URL('./src/lib/editor-compatibility.mjs',import.meta.url).pathname,options:{collection:model.collection,links:model.fields.filter(field=>field.type==='url'&&!field.required).map(field=>field.key)},capabilities:['content:write']}]})],devToolbar:{enabled:false}});

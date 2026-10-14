import {defineConfig} from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import emdash from 'emdash/astro';
import {d1,r2} from '@emdash-cms/cloudflare';
export default defineConfig({output:'server',adapter:cloudflare({imageService:'passthrough'}),vite:{plugins:[tailwindcss()]},integrations:[react(),emdash({database:d1({binding:'DB',session:'disabled'}),storage:r2({binding:'MEDIA'}),toolbar:false})],devToolbar:{enabled:false}});

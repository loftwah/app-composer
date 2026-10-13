import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import emdash from 'emdash/astro';
import { d1, r2 } from '@emdash-cms/cloudflare';
export default defineConfig({site:'https://composer.loftwah.com',output:'server',adapter:cloudflare({imageService:'passthrough'}),integrations:[react(),emdash({database:d1({binding:'DB',session:'disabled'}),storage:r2({binding:'MEDIA'}),siteUrl:'https://composer.loftwah.com',toolbar:false})],devToolbar:{enabled:false}});

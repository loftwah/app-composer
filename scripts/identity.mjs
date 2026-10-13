import {execFileSync} from 'node:child_process';import {writeFileSync} from 'node:fs';
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();writeFileSync('src/lib/build.json',JSON.stringify({app:'app-composer',commit,reviewed:'2026-10-13',contract:1}));

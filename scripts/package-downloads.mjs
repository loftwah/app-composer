// The build publishes both distributions without coupling their module loaders.
import {packageGetReady,writePackageArtifact} from './package-get-ready.mjs';
import {packageGetReadyMcp} from './package-get-ready-mcp.mjs';
import {packageExtension} from './package-extension.mjs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const repository=join(dirname(fileURLToPath(import.meta.url)),'..');
for(const [name,make] of [['get-ready',packageGetReady],['get-ready-mcp',packageGetReadyMcp]]){
 const metadata=make();writePackageArtifact(join(repository,'src/lib/'+name+'-package.json'),JSON.stringify(metadata,null,2)+'\n');
 console.log('Packaged '+metadata.name+' ('+metadata.bytes+' bytes), source '+metadata.source+(metadata.developmentSnapshot?' · development snapshot':''));
}
// The unpacked Chrome extension archive is committed; rebuilding it here keeps
// the archive, the folder and the shipped icon identical.
const extension=packageExtension();
console.log('Packaged '+extension.name+' '+extension.version+' ('+extension.bytes+' bytes), sha256 '+extension.sha256);

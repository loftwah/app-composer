// The build publishes both distributions without coupling their module loaders.
import {packageGetReady,writePackageArtifact} from './package-get-ready.mjs';
import {packageGetReadyMcp} from './package-get-ready-mcp.mjs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const repository=join(dirname(fileURLToPath(import.meta.url)),'..');
for(const [name,make] of [['get-ready',packageGetReady],['get-ready-mcp',packageGetReadyMcp]]){
 const metadata=make();writePackageArtifact(join(repository,'src/lib/'+name+'-package.json'),JSON.stringify(metadata,null,2)+'\n');
 console.log('Packaged '+metadata.name+' ('+metadata.bytes+' bytes), source '+metadata.source+(metadata.developmentSnapshot?' · development snapshot':''));
}

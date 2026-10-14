// Minimal local consumer. The selected host owns runtime credentials and scope.
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {fileURLToPath} from 'node:url';
import {launchScope,mcpEnvironment} from '../lib/get-ready-mcp/server.mjs';

let client;
try{
 launchScope(process.argv.slice(2));
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../scripts/get-ready-mcp.mjs',import.meta.url)),...process.argv.slice(2)],env:mcpEnvironment(process.env),stderr:'pipe'});
 // Keep raw child diagnostics in the local process, never in exported evidence.
 transport.stderr?.on('data',()=>{});
 client=new Client({name:'get-ready-local-example',version:'1.0.0'});await client.connect(transport);
 const checked=await client.callTool({name:'get_ready_check',arguments:{}});
 if(checked.isError||!checked.structuredContent?.report)throw Error('No completed report');
 process.stdout.write(JSON.stringify(checked.structuredContent.report,null,2)+'\n');
 if(!checked.structuredContent.inspection.ready)process.exitCode=1;
}catch{process.stderr.write('Get Ready MCP did not return a completed report. Check the explicit host scope and local runtime privately.\n');process.exitCode=1;}
finally{await client?.close();}

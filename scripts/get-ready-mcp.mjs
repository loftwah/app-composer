#!/usr/bin/env node
import {serveStdio,StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {createReadinessMcp,launchScope} from '../lib/get-ready-mcp/server.mjs';

try{
 const scope=launchScope(process.argv.slice(2));
 serveStdio(()=>createReadinessMcp(scope),{transport:new StdioServerTransport(process.stdin,process.stdout,{maxBufferSize:65536}),onerror:()=>process.stderr.write('Get Ready MCP transport failed. Inspect the local host privately.\n'),maxSubscriptions:0});
}catch{
 process.stderr.write('Get Ready MCP could not start. Use an explicit absolute trusted --workspace and supported account/reference flags. No credentials or setup operations belong in launch arguments.\n');
 process.exitCode=1;
}

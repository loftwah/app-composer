import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPair,exportJWK,SignJWT} from 'jose';import {protectAdministration} from '../src/lib/access-boundary.mjs';
test('closed administration covers setup/API and encoded paths before CMS processing',async()=>{
 for(const path of ['/_emdash/admin','/_emdash/admin/setup','/_emdash/api/setup/status','/_emdash/api/users','/%5femdash/admin/setup','/%255femdash/admin/setup','//_emdash/admin/setup','/%25255femdash/api/setup/status','/x/%252e%252e/_emdash/admin/setup','/x%2f..%2f_emdash/admin/setup','/_e%0amdash/admin/setup']){const denied=await protectAdministration(new Request('https://example.invalid'+path),{});assert.ok([400,403].includes(denied.status));}
 for(const path of ['/catalogue','/brand/hello%20world.svg','/caf%C3%A9'])assert.equal(await protectAdministration(new Request('https://example.invalid'+path),{}),null);
});
test('outer boundary verifies genuine signatures, audience, issuer and expiry',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='synthetic-fixture';const team='fictional-fixture.cloudflareaccess.com',issuer='https://'+team;const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});
 const signed=async(iss=issuer,aud='fixture-app',exp='2h')=>new SignJWT({email:'invented@fictional.invalid'}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(exp).sign(privateKey);
 const req=jwt=>new Request('https://example.invalid/_emdash/api/users',{headers:{'Cf-Access-Jwt-Assertion':jwt}});const env={CF_ACCESS_TEAM_DOMAIN:team,CF_ACCESS_AUDIENCE:'fixture-app'};
 try{assert.equal(await protectAdministration(req(await signed()),env),null);for(const jwt of [await signed(issuer,'wrong-app'),await signed('https://other.cloudflareaccess.com'),await signed(issuer,'fixture-app',1),'forged.jwt.assertion'])assert.equal((await protectAdministration(req(jwt),env)).status,403);}finally{globalThis.fetch=original;}
});

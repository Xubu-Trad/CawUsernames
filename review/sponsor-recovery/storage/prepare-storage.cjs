const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {stripTypeScriptTypes}=require('node:module');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const entry of JSON.parse(fs.readFileSync(path.join(root,'sources.json'),'utf8'))){
 const data=fs.readFileSync(path.join(root,entry.file));
 assert.equal(createHash('sha256').update(data).digest('hex'),entry.sha256);
}
const s=fs.readFileSync(path.join(root,'current.ts'),'utf8');
const handlers=s.slice(s.indexOf('async function handleSponsorRepaySet'),s.indexOf('const FAILURE_BACKOFF_CAP_MS'));
const poll=s.slice(s.indexOf('const FAILURE_BACKOFF_CAP_MS'),s.indexOf('export const _forTests'));
assert.ok(handlers.startsWith('async function handleSponsorRepaySet') && poll.startsWith('const FAILURE_BACKOFF_CAP_MS'));
fs.writeFileSync(path.join(__dirname,'pinned-functions.js'),stripTypeScriptTypes(handlers+poll)+'\nglobalThis.h={handleSponsorRepayRegistered,handleSponsorRepaySwept,makePollLoop};');
const schema=fs.readFileSync(path.join(root,'database-schema.prisma'),'utf8');
const model=schema.match(/^model SponsorRepay \{[\s\S]*?^\}/m);
assert.ok(model);
fs.writeFileSync(path.join(__dirname,'schema.prisma'),'generator client {\n provider = "prisma-client-js"\n}\ndatasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\n'+model[0]+'\n');
console.log('verified pinned source and extracted storage test inputs');

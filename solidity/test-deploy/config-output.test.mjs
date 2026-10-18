import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { publishConfigOutputs } from '../../cli/src/steps/config-output-core.mjs';
import { publishConfigOutputs as publishSupportedOutputs } from '../../cli/src/steps/config-output.mjs';
function fixture(run) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'caw-stage-test-'));
 try { const a=path.join(dir,'a'),b=path.join(dir,'b');fs.writeFileSync(a,'old-a');fs.writeFileSync(b,'old-b');run({dir,a,b,outputs:[{file:a,content:'new-a',mode:0o600},{file:b,content:'new-b'}]}); }
 finally { assert(path.dirname(dir)===os.tmpdir()&&path.basename(dir).startsWith('caw-stage-test-'));fs.rmSync(dir,{recursive:true}); }
}
const noStage=dir=>assert.deepEqual(fs.readdirSync(dir).sort(),['a','b']);
test('staged success replaces exact bytes and cleans temporary files',()=>fixture(({dir,a,b,outputs})=>{
 publishConfigOutputs(outputs);assert.equal(fs.readFileSync(a,'utf8'),'new-a');assert.equal(fs.readFileSync(b,'utf8'),'new-b');noStage(dir);
}));
for(const step of ['open','write','sync','verify','chmod'])test('stage '+step+' failure leaves original targets unchanged',()=>fixture(({dir,a,b,outputs})=>{
 let count=0;const io={...fs};const method={open:'openSync',write:'writeFileSync',sync:'fsyncSync',chmod:'chmodSync'}[step];
 if(method)io[method]=(...args)=>{if(++count===2)throw Error('private error');return fs[method](...args);};
 else outputs[1].verify=()=>{throw Error('private error');};
 assert.throws(()=>publishConfigOutputs(outputs,io),/0 file\(s\) replaced/);
 assert.equal(fs.readFileSync(a,'utf8'),'old-a');assert.equal(fs.readFileSync(b,'utf8'),'old-b');noStage(dir);
}));
test('observed operator edit prevents replacement and preserves edit',()=>fixture(({dir,a,b,outputs})=>{
 outputs[1].verify=()=>fs.writeFileSync(a,'operator-edit');
 assert.throws(()=>publishConfigOutputs(outputs),/0 file\(s\) replaced/);
 assert.equal(fs.readFileSync(a,'utf8'),'operator-edit');assert.equal(fs.readFileSync(b,'utf8'),'old-b');noStage(dir);
}));
test('second rename failure reports partial publication without claiming rollback',()=>fixture(({dir,a,b,outputs})=>{
 let count=0;const io={...fs,renameSync:(...args)=>{if(++count===2)throw Error('private error');return fs.renameSync(...args);}};
 assert.throws(()=>publishConfigOutputs(outputs,io),/1 file\(s\) replaced/);
 assert.equal(fs.readFileSync(a,'utf8'),'new-a');assert.equal(fs.readFileSync(b,'utf8'),'old-b');noStage(dir);
}));
test('duplicate target rejects before publication',()=>fixture(({dir,a,outputs})=>{
 outputs.push({file:a,content:'duplicate'});assert.throws(()=>publishConfigOutputs(outputs),/0 file\(s\) replaced/);assert.equal(fs.readFileSync(a,'utf8'),'old-a');noStage(dir);
}));
test('new destination is not created if staging later fails',()=>fixture(({dir,outputs})=>{
 const target=path.join(dir,'new');outputs.unshift({file:target,content:'new'});outputs[2].verify=()=>{throw Error('failure');};
 assert.throws(()=>publishConfigOutputs(outputs),/0 file\(s\) replaced/);assert(!fs.existsSync(target));noStage(dir);
}));
test('directory destination is refused without touching it',()=>fixture(({dir,outputs})=>{
 const target=path.join(dir,'directory');fs.mkdirSync(target);outputs[1].file=target;
 assert.throws(()=>publishConfigOutputs(outputs),/0 file\(s\) replaced/);assert(fs.statSync(target).isDirectory());assert.equal(fs.readFileSync(outputs[0].file,'utf8'),'old-a');
 assert(!fs.readdirSync(dir).some(x=>x.startsWith('.caw-stage-')));
}));
test('cleanup failure is explicit and does not expose original error details',()=>fixture(({dir,outputs})=>{
 outputs[1].verify=()=>{throw Error('private sentinel');};const io={...fs,unlinkSync(){throw Error('private sentinel');}};
 assert.throws(()=>publishConfigOutputs(outputs,io),e=>{assert.match(e.message,/staging files could not be removed/);assert.doesNotMatch(e.message,/private sentinel/);return true;});
 assert(fs.readdirSync(dir).some(x=>x.startsWith('.caw-stage-')));
}));

test('new file default mode uses the operator umask rather than a fixed public mode',()=>fixture(({dir})=>{
 const target=path.join(dir,'new');let applied;const io={...fs,chmodSync:(file,mode)=>{applied=mode;fs.chmodSync(file,mode);}};
 publishConfigOutputs([{file:target,content:'synthetic'}],io);
 assert.equal(applied,0o666 & ~process.umask());assert.equal(fs.readFileSync(target,'utf8'),'synthetic');
}));

test('same-byte replacement is detected by file identity before publication',()=>fixture(({dir,a,b,outputs})=>{
 const before=fs.statSync(a);
 outputs[1].verify=()=>{const replacement=path.join(dir,'replacement');fs.writeFileSync(replacement,'old-a');fs.chmodSync(replacement,before.mode & 0o777);fs.renameSync(replacement,a);};
 assert.throws(()=>publishConfigOutputs(outputs),/0 file\(s\) replaced/);
 assert.notEqual(fs.statSync(a).ino,before.ino);
 assert.equal(fs.readFileSync(a,'utf8'),'old-a');assert.equal(fs.readFileSync(b,'utf8'),'old-b');noStage(dir);
}));
for(const field of ['uid','gid','nlink'])test('observed '+field+' change rejects publication',()=>fixture(({dir,a,b,outputs})=>{
 let changed=false;outputs[1].verify=()=>{changed=true;};
 const io={...fs,lstatSync:file=>{const stat=fs.lstatSync(file);if(file===a && changed)return new Proxy(stat,{get:(target,key)=>key===field?target[field]+1:Reflect.get(target,key)});return stat;}};
 assert.throws(()=>publishConfigOutputs(outputs,io),/0 file\(s\) replaced/);
 assert.equal(fs.readFileSync(a,'utf8'),'old-a');assert.equal(fs.readFileSync(b,'utf8'),'old-b');noStage(dir);
}));

test('Windows production publisher refuses before any filesystem operation', {skip:process.platform!=='win32'},()=>{
 const io=new Proxy({}, {get(){throw Error('filesystem reached');}});
 assert.throws(()=>publishSupportedOutputs([{file:'synthetic',content:'synthetic'}],io),/unavailable on Windows/);
});
test('Windows refusal preserves existing files and creates no stage files', {skip:process.platform!=='win32'},()=>fixture(({dir,a,b,outputs})=>{
 assert.throws(()=>publishSupportedOutputs(outputs),/unavailable on Windows/);
 assert.equal(fs.readFileSync(a,'utf8'),'old-a');assert.equal(fs.readFileSync(b,'utf8'),'old-b');noStage(dir);
}));

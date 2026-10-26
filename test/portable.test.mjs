import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const config=await import('../config.mjs').catch(()=>null);
test('plugin entry never imports a developer installation through an absolute path',()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(root,'index.js'),'utf8'),/file:\/\/\/[A-Z]:\/|["']D:\//i);
});
test('portable configuration is explicit and forwarding is opt in',()=>{
 assert.equal(typeof config?.resolveConfig,'function');
 const value=config.resolveConfig({workspace:'C:/Apps/WeChatAgent/data/workspace',scrollHome:'E:/Profiles/bili-duty',scrollPlugin:'C:/Plugins/dsh-bili-scroll'},{home:'C:/Users/Demo/.dsh/bili-wechat'});
 assert.equal(value.enabled,false);assert.equal(value.scrollHome,path.resolve('E:/Profiles/bili-duty'));assert.equal(value.workspace,path.resolve('C:/Apps/WeChatAgent/data/workspace'));
});
test('enabling automatic sending requires an explicit selected group and native identity',()=>{
 assert.throws(()=>config.resolveConfig({enabled:true},{home:root}),/FORWARD_GROUP/);
 assert.throws(()=>config.resolveConfig({enabled:true,groupId:'123',expectedGroupRef:'not-a-group'},{home:root}),/FORWARD_GROUP/);
});

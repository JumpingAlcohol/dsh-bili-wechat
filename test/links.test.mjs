import test from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../links.mjs').catch(()=>({}));
test('BV and Bilibili URL inputs are normalized without tracking parameters',async()=>{
 assert.equal(typeof mod.resolveVideo,'function','link resolver is missing');
 assert.deepEqual(await mod.resolveVideo('https://www.bilibili.com/video/BV1T5n66mEa2/?share_source=wechat'),{bvid:'BV1T5n66mEa2',url:'https://www.bilibili.com/video/BV1T5n66mEa2'});
});
test('short Bilibili links resolve through a permitted redirect',async()=>{
 assert.equal(typeof mod.resolveVideo,'function','link resolver is missing');
 const result=await mod.resolveVideo('https://b23.tv/test',{fetchImpl:async url=>new Response(null,{status:302,headers:{location:'https://www.bilibili.com/video/BV1T5n66mEa2/?x=1'}})});
 assert.equal(result.bvid,'BV1T5n66mEa2');
});
test('arbitrary hosts, deceptive domains and redirects to localhost are rejected before fetching them',async()=>{
 assert.equal(typeof mod.resolveVideo,'function','link resolver is missing');
 let calls=0;const fetchImpl=async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});};
 await assert.rejects(mod.resolveVideo('https://www.bilibili.com.evil.invalid/video/BV1T5n66mEa2',{fetchImpl}),/BILI_LINK/);
 assert.equal(calls,0);
 await assert.rejects(mod.resolveVideo('https://b23.tv/test',{fetchImpl}),/BILI_LINK/);
 assert.equal(calls,1);
});

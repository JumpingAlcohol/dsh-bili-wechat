import test from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../watch.mjs').catch(()=>({}));
test('shared video evidence includes real subtitle text and saved frame references without exposing image bytes',async()=>{
 assert.equal(typeof mod.watchVideo,'function','shared video reader is missing');
 const called=[];
 const client={call:async(name,args)=>{called.push(name);return name==='bili_video_info'?{bvid:args.bvid,title:'测试动画',description:'画面演示',author:{name:'UP'},duration:90}:{text:'这里是字幕',segments:1};},callRaw:async()=>({json:{ok:true,frames:[{got_sec:30}]},images:[{data:'AQID',mimeType:'image/jpeg'}]})};
 const result=await mod.watchVideo('BV1T5n66mEa2',{client,attachImages:async images=>{assert.equal(images[0].mimeType,'image/jpeg');return [{id:'frame-fixture',mediaType:'image/jpeg'}];}});
 assert.equal(result.title,'测试动画');assert.equal(result.subtitle,'这里是字幕');assert.equal(result.images[0].id,'frame-fixture');
 assert.equal(JSON.stringify(result).includes('AQID'),false);
 assert.deepEqual(called,['bili_video_info','bili_subtitle']);
});
test('missing subtitles does not discard a visual video or claim it was fully watched',async()=>{
 assert.equal(typeof mod.watchVideo,'function','shared video reader is missing');
 const client={call:async name=>name==='bili_video_info'?{title:'MMD',duration:120}:{message:'该视频没有字幕'},callRaw:async()=>({json:{ok:true,frames:[{got_sec:60}]},images:[{data:'AQID',mimeType:'image/jpeg'}]})};
 const result=await mod.watchVideo('BV1T5n66mEa2',{client,attachImages:async()=>[{id:'frame-1'}]});
 assert.equal(result.subtitle,'');assert.equal(result.images.length,1);assert.match(result.limitations,/抽样/);
});
test('video reader rejects non-Bilibili links before reaching a network-capable MCP tool',async()=>{
 assert.equal(typeof mod.watchVideo,'function','shared video reader is missing');
 const client={call:()=>{throw Error('should not reach MCP');}};
 await assert.rejects(mod.watchVideo('https://example.com/video/BV1T5n66mEa2',{client}),/BILI_LINK/);
});

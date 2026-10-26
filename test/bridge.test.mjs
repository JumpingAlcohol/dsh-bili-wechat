import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const mod=await import('../bridge.mjs').catch(()=>({}));
function temporary(t){const root=path.resolve(import.meta.dirname);const dir=fs.mkdtempSync(path.join(root,'tmp-bili-'));t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),root);fs.rmSync(dir,{recursive:true,force:true});});return dir;}
const report=`### BV1T5n66mEa2
- 标题：今日份快乐源泉
- **类别**：抽象搞笑
- **档位**：值得看
- 我的一句话：这段反应比视频本身还离谱。

### BV11gn16REzZ
- 标题：游戏整活
- **类别**：游戏
- **档位**：值得看
- 我的一句话：搞笑归搞笑，还是游戏类。

### BV1MsZtYCE4t
- 标题：MMD
- **类别**：二次元
- **档位**：可以看

### BV1UQnm6vENf
- 标题：没看懂的片子
- **类别**：抽象搞笑
- **档位**：不值当

\`\`\`
### BV1JKDbBzETH
- 类别：抽象搞笑
\`\`\`
`;
test('only selected comedy recommendations are forwarded, not games, skipped videos or code-fence examples',()=>{
 assert.equal(typeof mod.parseRecommendations,'function','recommendation parser is missing');
 const rows=mod.parseRecommendations(report);
 assert.deepEqual(rows.map(x=>x.bvid),['BV1T5n66mEa2']);
 assert.equal(rows[0].comment,'这段反应比视频本身还离谱。');
});
test('missing explicit category does not turn a title mentioning 搞笑 into an eligible recommendation',()=>{
 assert.equal(typeof mod.parseRecommendations,'function','recommendation parser is missing');
 assert.deepEqual(mod.parseRecommendations('### BV1T5n66mEa2\n标题：搞笑视频\n档位：值得看'),[]);
});
test('explicit group selections include game humor and short dance without forwarding unrelated categories',()=>{
 const expanded=`### BV1hjHN6pEuK
- 标题：守望小队整活
- 类别：游戏
- 档位：值得看
- 群转发类型：游戏整活
- 群聊点评：钩人钩到自己送掉。
### BV1jxuE66E8v
- 标题：游戏角色cos短舞
- 类别：二次元
- 档位：可以看
- 群转发类型：短舞蹈
- 群聊点评：十二秒短舞。
### BV1m9Hg6aEPe
- 标题：不合口味的AI舞蹈
- 类别：二次元
- 档位：可以看
- 群转发类型：不转发
### BV1TFHP6LE38
- 标题：游戏攻略
- 类别：游戏
- 档位：值得看
`;
 const rows=mod.parseRecommendations(expanded);
 assert.deepEqual(rows.map(row=>[row.bvid,row.category]),[['BV1hjHN6pEuK','游戏整活'],['BV1jxuE66E8v','短舞蹈']]);
 assert.equal(rows[1].comment,'十二秒短舞。');
});
test('abstract discoveries precede other qualified shares while preserving order within each priority',()=>{
 const mixed=`### BV1jxuE66E8v
- 标题：短舞
- 类别：二次元
- 档位：可以看
- 群转发类型：短舞蹈
### BV1T5n66mEa2
- 标题：抽象猎奇
- 类别：抽象搞笑
- 档位：值得看
- 群转发类型：抽象搞笑
### BV1hjHN6pEuK
- 标题：游戏整活
- 类别：游戏
- 档位：值得看
- 群转发类型：游戏整活
### BV1UQnm6vENf
- 标题：近期爆梗
- 类别：抽象
- 档位：可以看
- 群转发类型：抽象搞笑
`;
 assert.deepEqual(mod.parseRecommendations(mixed).map(row=>row.bvid),['BV1T5n66mEa2','BV1UQnm6vENf','BV1jxuE66E8v','BV1hjHN6pEuK']);
});
test('an explicit do-not-forward decision overrides a funny category and an unsupported decision fails closed',()=>{
 const block=(id,selection)=>`### ${id}\n- 标题：反例\n- 类别：抽象搞笑\n- 档位：可以看\n- 群转发类型：${selection}\n`;
 assert.deepEqual(mod.parseRecommendations(block('BV1hjHN6pEuK','不转发')+block('BV1jxuE66E8v','游戏攻略')),[]);
});
test('new forwarding scope does not backfill old videos and only delivers new qualified entries once',async t=>{
 const dir=temporary(t),posted=[];
 const options={stateFile:path.join(dir,'state.json'),groupId:'12345',send:async p=>{posted.push(p);return {delivered:'database-confirmed'};}};
 const old='### BV1hjHN6pEuK\n- 标题：旧整活\n- 类别：游戏\n- 档位：值得看\n';
 const first=new mod.Forwarder(options);
 await first.tick({completion:{id:'old',ok:true},report:old});
 const marked=old+'- 群转发类型：游戏整活\n';
 const fresh='### BV1jxuE66E8v\n- 标题：新短舞\n- 类别：二次元\n- 档位：可以看\n- 群转发类型：短舞蹈\n- 群聊点评：新片段。\n';
 await first.tick({completion:{id:'new',ok:true},report:marked+fresh});
 assert.equal(posted.length,2);
 assert.match(posted[1].text,/BV1jxuE66E8v/);
 for(const p of posted)assert.doesNotMatch(p.text,/旧整活|BV1hjHN6pEuK/);
 await new mod.Forwarder(options).tick({completion:{id:'later',ok:true},report:marked+fresh});
 assert.equal(posted.length,2);
});
test('compact report metadata on the first line preserves title and tier for dance and game shares',()=>{
 const compact=`### BV1xsJi6hEwW
⚡️明音姐也有想跳舞的心⚡️ / 钻石蘑菇Yume / https://www.bilibili.com/video/BV1xsJi6hEwW / 播放 2128 / **档位**：可以看
- **类别**：二次元
- 群转发类型：短舞蹈
- 群聊点评：33秒一支舞。
### BV1SZH56LExX
【暗区逆天剧情34.0】敌我队友 / 雪狐玩暗区 / https://www.bilibili.com/video/BV1SZH56LExX / 播放 3730 / **档位**：可以看
- **类别**：游戏
- 群转发类型：游戏整活
- 群聊点评：扔雷往你身上扔。
`;
 const rows=mod.parseRecommendations(compact);
 assert.deepEqual(rows.map(row=>[row.bvid,row.title,row.category]),[['BV1xsJi6hEwW','⚡️明音姐也有想跳舞的心⚡️','短舞蹈'],['BV1SZH56LExX','【暗区逆天剧情34.0】敌我队友','游戏整活']]);
 assert.equal(rows[0].comment,'33秒一支舞。');
});
test('compact metadata must identify the current video and cannot override an explicit rejected tier',()=>{
 const row=(id,tier,urlId=id)=>`### ${id}\n片段 / UP / https://www.bilibili.com/video/${urlId} / 播放 2000 / **档位**：${tier}\n- 类别：游戏\n- 群转发类型：游戏整活\n`;
 assert.deepEqual(mod.parseRecommendations(row('BV1xsJi6hEwW','不值当')+row('BV1SZH56LExX','可以看','BV1xsJi6hEwW')),[]);
 assert.deepEqual(mod.parseRecommendations(row('BV1xsJi6hEwW','可以看')+'- 档位：不值当\n'),[]);
});
test('a new share uses only its short invitation rather than the old review paragraph',async t=>{
 const posted=[],dir=temporary(t);
 const f=new mod.Forwarder({stateFile:path.join(dir,'state.json'),groupId:'12345',send:async p=>{posted.push(p);return {delivered:'database-confirmed'};}});
 await f.tick({completion:null,report:''});
 await f.tick({completion:{id:'caption',ok:true},report:'### BV1xsJi6hEwW\n- 标题：换装短舞\n- 类别：二次元\n- 档位：可以看\n- 群转发类型：短舞蹈\n- 群引导语：你先点开\n- 群聊点评：三十三秒换装卡点，灯光和舞步都值得欣赏。\n'});
 assert.equal(posted.length,2);
 assert.equal(posted[0].text,'你先点开');
 assert.equal(posted[1].text,'换装短舞\nhttps://www.bilibili.com/video/BV1xsJi6hEwW');
 assert.notEqual(posted[0].deliveryId,posted[1].deliveryId);
 for(const p of posted)assert.doesNotMatch(p.text,/灯光|舞步|值得欣赏/);
});
test('missing or oversized invitations use a brief default instead of leaking a review',async t=>{
 const dir=temporary(t),posted=[];
 const f=new mod.Forwarder({stateFile:path.join(dir,'state.json'),groupId:'12345',send:async p=>{posted.push(p);return {delivered:'database-confirmed'};}});
 await f.tick({completion:null,report:''});
 const row=(id,caption)=>`### ${id}\n- 标题：片段\n- 类别：抽象\n- 档位：可以看\n${caption?'\n- 群引导语：'+caption:''}\n- 群聊点评：这段很有意思，接下来我来逐一解释。\n`;
 await f.tick({completion:{id:'fallback',ok:true},report:row('BV1xsJi6hEwW','')+row('BV1SZH56LExX','这是一大段特别长的评价文字不应该出现在转发中请不要直接截断发出去')});
 assert.equal(posted.length,4);
 assert.equal(posted[0].text,'别光我一个人看');
 assert.equal(posted[2].text,'别光我一个人看');
 for(const p of posted)assert.doesNotMatch(p.text,/逐一解释|特别长的评价/);
});
test('a confirmed caption survives restart while only its unconfirmed link is retried',async t=>{
 const dir=temporary(t),posted=[];
 let rejectLink=true;
 const options={stateFile:path.join(dir,'state.json'),groupId:'12345',send:async p=>{posted.push(p);if(p.text.includes('https://')&&rejectLink)throw Error('TEXT_DELIVERY_UNCONFIRMED');return {delivered:'database-confirmed'};}};
 const first=new mod.Forwarder(options);
 await first.tick({completion:null,report:''});
 await first.tick({completion:{id:'split',ok:true},report});
 assert.equal(first.status().pending,1);
 assert.equal(posted.length,2);
 assert.equal(posted[0].text,'别光我一个人看');
 rejectLink=false;
 const restarted=new mod.Forwarder(options);
 await restarted.tick({completion:{id:'split',ok:true},report});
 assert.equal(posted.length,3,'caption must not be resent');
 assert.equal(posted[1].deliveryId,posted[2].deliveryId);
 assert.equal(restarted.status().confirmed,1);
 await restarted.tick({completion:{id:'split',ok:true},report});
 assert.equal(posted.length,3);
});
test('legacy confirmed jobs stay untouched and a legacy pending send retains its original id and text',async t=>{
 const dir=temporary(t),file=path.join(dir,'state.json'),posted=[];
 const prior={version:1,groupId:'12345',lastCompletion:'old',seen:['BV1xsJi6hEwW','BV1SZH56LExX'],jobs:{
   BV1xsJi6hEwW:{deliveryId:'old-confirmed',text:'already sent',state:'confirmed',confirmedAt:10},
   BV1SZH56LExX:{deliveryId:'old-pending',text:'old combined message',state:'pending'}},lastError:''};
 fs.writeFileSync(file,JSON.stringify(prior));
 const f=new mod.Forwarder({stateFile:file,groupId:'12345',send:async p=>{posted.push(p);return {delivered:'database-confirmed'};}});
 await f.tick({completion:{id:'old',ok:true},report:''});
 assert.deepEqual(posted,[{groupId:'12345',text:'old combined message',deliveryId:'old-pending'}]);
 assert.deepEqual(f.state.jobs.BV1xsJi6hEwW,prior.jobs.BV1xsJi6hEwW);
});
test('completed successful round is required; failed and incomplete rounds do not trigger delivery',()=>{
 assert.equal(typeof mod.latestCompletion,'function','completion reader is missing');
 assert.equal(mod.latestCompletion('2026-10-25T04:00:00.000Z 刷B站结束（manual，code=1）').ok,false);
 assert.equal(mod.latestCompletion('2026-10-25T04:00:00.000Z 刷B站开跑（manual）'),null);
 assert.equal(mod.latestCompletion('2026-10-25T04:00:00.000Z 刷B站结束（manual，code=0）').ok,true);
});
test('new installation ignores history; later completed round sends once and stays deduplicated after restart',async t=>{
 assert.equal(typeof mod.Forwarder,'function','forwarder is missing');
 const dir=temporary(t);
 let posted=[];
 const options={stateFile:path.join(dir,'state.json'),groupId:'12345',send:async payload=>{posted.push(payload);return {receipt:'wechat-server-id',delivered:'database-confirmed'};}};
 const first=new mod.Forwarder(options);
 await first.tick({completion:{id:'old',at:100,ok:true},report});
 assert.equal(posted.length,0,'old recommendations must not be backfilled');
 const newer=report+'\n### BV1JKDbBzETH\n- 标题：猫猫抽象瞬间\n- 类别：抽象搞笑\n- 档位：值得看\n- 我的一句话：猫比我还会整活。\n';
 await first.tick({completion:{id:'new',at:200,ok:true},report:newer});
 assert.equal(posted.length,2);
 assert.equal(posted[0].groupId,'12345');
 assert.match(posted[1].text,/https:\/\/www\.bilibili\.com\/video\/BV1JKDbBzETH/);
 const restarted=new mod.Forwarder(options);
 await restarted.tick({completion:{id:'new',at:200,ok:true},report:newer});
 assert.equal(posted.length,2,'restart or report reread must not resend');
});
test('an uncertain delivery is retained and retried with the identical delivery id',async t=>{
 assert.equal(typeof mod.Forwarder,'function','forwarder is missing');
 const dir=temporary(t);
 const deliveries=[];let fail=true;
 const f=new mod.Forwarder({stateFile:path.join(dir,'state.json'),groupId:'12345',send:async p=>{deliveries.push(p.deliveryId);if(fail)throw Error('TEXT_DELIVERY_UNCONFIRMED');return {delivered:'database-confirmed'};}});
 await f.tick({completion:null,report:''});
 await f.tick({completion:{id:'r',at:1,ok:true},report});
 assert.equal(f.status().pending,1);
 fail=false;
 await f.tick({completion:{id:'r',at:1,ok:true},report});
 assert.equal(f.status().pending,0);
 assert.equal(deliveries.length,3);
 assert.equal(deliveries[0],deliveries[1]);
 assert.notEqual(deliveries[1],deliveries[2]);
});

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const clean=value=>String(value??'').replace(/[*`]/g,'').trim();
function field(body,names){
 for(const line of body.split(/\r?\n/)){
  const hit=/^\s*(?:[-*]\s*)?([^：:]+)[：:]\s*(.*)$/.exec(clean(line));
  if(hit&&names.includes(clean(hit[1])))return clean(hit[2]);
 }
 return '';
}
const unfenced=text=>String(text??'').replace(/^```[^\r\n]*\r?\n[\s\S]*?^```[^\r\n]*$/gm,'');
export function parseRecommendations(text){
 const sections=[...unfenced(text).matchAll(/^###\s+(BV[0-9A-Za-z]{10})\b[^\r\n]*\r?\n([\s\S]*?)(?=^###\s+BV[0-9A-Za-z]{10}\b|(?![\s\S]))/gm)];
 return sections.flatMap(match=>{
  const body=match[2],category=field(body,['类别','分类']);
  const normalized=category.replace(/[\s／/、，,·-]/g,'').replace(/(?:类|视频)$/,'');
  const firstLine=clean(body.split(/\r?\n/).find(line=>line.trim()));
  const compact=/^(.+?)\s+[／/|｜]\s+.+?\s+[／/|｜]\s+https:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]{10})\s+[／/|｜]\s+播放(?:量)?\s*[\d,.万亿]+\s+[／/|｜]\s+档位[：:]\s*(值得看|可以看|不值当)\s*$/.exec(firstLine);
  const metadata=compact?.[2]===match[1]?compact:null;
  const tier=field(body,['档位'])||metadata?.[3];
  const selection=field(body,['群转发类型']);
  const selectedCategory=selection?(['抽象搞笑','游戏整活','短舞蹈'].includes(selection)?selection:null):(['抽象搞笑','抽象','搞笑','鬼畜','抽象搞笑鬼畜'].includes(normalized)?'抽象搞笑':null);
  if(!selectedCategory||!['值得看','可以看'].includes(tier))return [];
  const invitation=field(body,['群引导语']);
  const caption=invitation&&[...invitation].length<=18&&!/[<>\[\]\u0000-\u001f]/.test(invitation)?invitation:'别光我一个人看';
  return [{bvid:match[1],title:(field(body,['标题'])||metadata?.[1]||'').slice(0,140),category:selectedCategory,caption,comment:field(body,['群聊点评','我的一句话','它自己的一句话']).slice(0,280),url:'https://www.bilibili.com/video/'+match[1]}];
 }).sort((a,b)=>Number(b.category==='抽象搞笑')-Number(a.category==='抽象搞笑'));
}
export function latestCompletion(log){
 const hits=[...String(log??'').matchAll(/^(\d{4}-\d\d-\d\dT[^\s]+)\s+刷B站结束（[^\r\n]*?code=(-?\d+)）\s*$/gm)];
 if(!hits.length)return null;
 const last=hits.at(-1);return {id:hash(last[0]),at:Date.parse(last[1]),ok:last[2]==='0'};
}
export class Forwarder{
 constructor({stateFile,groupId,send}){
  if(!/^\d+$/.test(String(groupId)))throw Error('FORWARD_GROUP_REQUIRED');
  Object.assign(this,{stateFile,groupId:String(groupId),send});
  this.state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):null;
  if(this.state&&(this.state.version!==1||this.state.groupId!==this.groupId||!Array.isArray(this.state.seen)||!this.state.jobs))throw Error('FORWARD_STATE_INVALID');
 }
 save(){fs.mkdirSync(path.dirname(this.stateFile),{recursive:true});const tmp=this.stateFile+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.state,null,2));fs.renameSync(tmp,this.stateFile);}
 status(){return {initialized:!!this.state,pending:Object.values(this.state?.jobs??{}).filter(j=>j.state!=='confirmed').length,confirmed:Object.values(this.state?.jobs??{}).filter(j=>j.state==='confirmed').length,lastError:this.state?.lastError??''};}
 async tick({completion,report}){
  const allIds=[...unfenced(report).matchAll(/^###\s+(BV[0-9A-Za-z]{10})\b/gm)].map(x=>x[1]);
  if(!this.state){this.state={version:1,groupId:this.groupId,lastCompletion:completion?.id??null,seen:[...new Set(allIds)],jobs:{},lastError:''};this.save();return this.status();}
  if(completion&&completion.id!==this.state.lastCompletion){
   if(completion.ok){
    for(const row of parseRecommendations(report))if(!this.state.seen.includes(row.bvid)){
     const deliveryId=hash('bili-wechat-v1|'+this.groupId+'|'+row.bvid);
     const messages=[
      {kind:'caption',deliveryId:hash(deliveryId+'|caption-v1'),text:row.caption,state:'pending'},
      {kind:'link',deliveryId:hash(deliveryId+'|link-v1'),text:[row.title,row.url].filter(Boolean).join('\n'),state:'pending'},
     ];
     this.state.jobs[row.bvid]={...row,deliveryId,messages,state:'pending',createdAt:Date.now()};
    }
    this.state.seen=[...new Set([...this.state.seen,...allIds])];
   }
   this.state.lastCompletion=completion.id;this.save();
  }
  for(const job of Object.values(this.state.jobs).filter(x=>x.state!=='confirmed')){
   try{
    // Older single-bubble pending jobs keep their original text/id, so an
    // accepted but unconfirmed send cannot be duplicated during an upgrade.
    const messages=job.messages??[{deliveryId:job.deliveryId,text:job.text}];
    if(!Array.isArray(messages)||!messages.length||messages.length>2||messages.some(message=>typeof message.text!=='string'||!message.text.trim()||typeof message.deliveryId!=='string'||!message.deliveryId))throw Error('FORWARD_STATE_INVALID');
    for(const message of messages){
     if(message.state==='confirmed')continue;
     const result=await this.send({groupId:this.groupId,text:message.text,deliveryId:message.deliveryId});
     if(result?.delivered!=='database-confirmed')throw Error('TEXT_DELIVERY_UNCONFIRMED');
     message.state='confirmed';message.confirmedAt=Date.now();
     // Persist each bubble before attempting the next one. The underlying
     // text sender also retains the same id across uncertain-delivery retries.
     if(job.messages)this.save();
    }
    job.state='confirmed';job.confirmedAt=Date.now();this.state.lastError='';
   }catch(error){this.state.lastError=String(error.message??'FORWARD_FAILED').slice(0,160);this.save();break;}
   this.save();
  }
  return this.status();
 }
}

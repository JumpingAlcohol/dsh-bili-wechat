import fs from 'node:fs';
import path from 'node:path';
import {Forwarder,latestCompletion} from './bridge.mjs';
import {resolveVideo} from './links.mjs';
import {watchVideo} from './watch.mjs';
import {pathToFileURL} from 'node:url';
import {stateHome,loadConfig,checkFiles} from './config.mjs';
export const name='bili-wechat';
export const inject=['tools'];
const home=stateHome();
const configFile=path.join(home,'config.json');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function tail(file,limit=262144){if(!fs.existsSync(file))return '';const fd=fs.openSync(file,'r');try{const size=fs.fstatSync(fd).size;const buf=Buffer.alloc(Math.min(size,limit));fs.readSync(fd,buf,0,buf.length,Math.max(0,size-buf.length));return buf.toString('utf8');}finally{fs.closeSync(fd);}}
export function apply(ctx){
 const log=ctx.logger??console;
 ctx.tools.register({name:'bili_resolve_link',description:'将用户分享的 B站完整链接、b23.tv 短链接或 BV号解析为可用于 bili_video_info、bili_subtitle、bili_frames 的 BV号。只访问B站官方域名。',parameters:{type:'object',properties:{input:{type:'string',maxLength:2048}},required:['input'],additionalProperties:false},output:{schema:{type:'object',properties:{bvid:{type:'string'},url:{type:'string'}},required:['bvid','url'],additionalProperties:false},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute:(args,exec)=>resolveVideo(args.input,{signal:exec?.signal})});
 ctx.tools.register({name:'bili_watch_video',description:'读取用户分享的B站视频、BV号或b23.tv短链接：获取真实视频信息、可用字幕和3帧抽样画面供你查看。收到分享后先调用本工具，再按实际证据自然回应；不发表评论、不私信、不收藏。',parameters:{type:'object',properties:{input:{type:'string',maxLength:2048}},required:['input'],additionalProperties:false},output:{schema:{type:'object',properties:{},additionalProperties:true},render:(_args,value)=>{const {images=[],...text}=value;return [{type:'text',text:JSON.stringify(text)},...images.map(attachment=>({type:'image',attachment}))];}},async execute(args,exec){
  const settings=loadConfig(home);
  if(!settings.scrollPlugin||!settings.scrollHome)throw Error('BILI_WECHAT_SETUP_REQUIRED');
  const {McpClient}=await import(pathToFileURL(path.join(settings.scrollPlugin,'lib/mcp.mjs')).href);
  const cfg=json(path.join(settings.scrollHome,'config.json'));
  if(typeof cfg.pythonPath!=='string'||!cfg.pythonPath)throw Error('SCROLL_PYTHON_NOT_CONFIGURED');
  const client=new McpClient({command:cfg.pythonPath,args:[path.join(settings.scrollHome,'mcp_server.py')],cwd:settings.scrollHome,env:{PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',BILI_MCP_TOOLS:'bili_video_info,bili_subtitle,bili_frames'}});
  try{return await watchVideo(args.input,{client,signal:exec?.signal,attachImages:async frames=>{
   const attachments=ctx.get('attachments'),llm=ctx.get('llm');
   const routed=exec?.agent?.session?.requestHeader?.()?.config;
   const provider=routed?.provider??exec?.agent?.options?.provider,model=routed?.model??exec?.agent?.options?.model;
   const info=await llm?.resolveModelInfo?.(provider,model,exec?.signal);
   if(!info?.inputModalities?.includes('image')||!attachments?.saveImages)return [];
   return attachments.saveImages(frames.map(image=>({data:Buffer.from(image.data,'base64'),mediaType:image.mimeType})));
  }});}finally{client.stop();}
 }});
 let running=false,forwarder,adapter,signature,lastSignature='',stableSince=0,lastFailure='';
 const tick=async()=>{
  if(running)return;running=true;
  try{
   if(!fs.existsSync(configFile))return;
   const cfg=loadConfig(home);if(cfg.enabled!==true)return;
   if(!checkFiles(cfg).ok)throw Error('BILI_WECHAT_DEPENDENCY_MISSING');
   if(!/^\d+$/.test(cfg.groupId??'')||!cfg.expectedGroupRef?.endsWith('@chatroom'))throw Error('FORWARD_GROUP_CONFIG_INVALID');
   const current=JSON.stringify([cfg.groupId,cfg.expectedGroupRef,cfg.workspace,cfg.scrollHome,cfg.scrollPlugin]);
   if(current!==signature){
    adapter?.fileWorker?.stop?.();
    const {HookOneBot}=await import(pathToFileURL(path.join(cfg.workspace,'scripts/hook-onebot.mjs')).href);
    adapter=new HookOneBot({directory:cfg.workspace,receiptTimeoutMs:12000});
    forwarder=new Forwarder({stateFile:path.join(home,'forward-'+cfg.groupId+'.json'),groupId:cfg.groupId,send:async payload=>{
     adapter.reload();
     if(!adapter.allowed('group',cfg.groupId))throw Error('CONVERSATION_NOT_ALLOWED');
     if(await adapter.resolveTarget('group',cfg.groupId)!==cfg.expectedGroupRef)throw Error('FORWARD_TARGET_CHANGED');
     return adapter.send('group',payload.groupId,payload.text,payload.deliveryId);
    }});signature=current;
   }
   const files=fs.existsSync(path.join(cfg.scrollHome,'out'))?fs.readdirSync(path.join(cfg.scrollHome,'out')).filter(n=>/^\d{4}-\d\d-\d\d\.md$/.test(n)).sort():[];
   const completion=latestCompletion(tail(path.join(cfg.scrollHome,'duty.log')));
   const selected=files.at(-1);
   const reportFile=selected?path.join(cfg.scrollHome,'out',selected):null;
   const report=reportFile?tail(reportFile,1048576):'';
   const now=Date.now(),snapshot=JSON.stringify([completion?.id,reportFile,reportFile?fs.statSync(reportFile).mtimeMs:0,report.length]);
   if(snapshot!==lastSignature){lastSignature=snapshot;stableSince=now;}
   // On first installation only establish a baseline; never send old recommendations.
   if(!forwarder.state||now-stableSince>=10000){
    const status=await forwarder.tick({completion,report});
    fs.mkdirSync(home,{recursive:true});fs.writeFileSync(path.join(home,'status.json'),JSON.stringify({checkedAt:new Date().toISOString(),groupId:cfg.groupId,groupName:cfg.groupName,sourceReport:selected??null,...status},null,2));
    if(status.lastError&&status.lastError!==lastFailure){log.warn('B站微信群转发:',status.lastError);lastFailure=status.lastError;}
   }
  }catch(error){const message=String(error.message??'FORWARD_FAILED').slice(0,160);if(message!==lastFailure){log.warn('B站微信群转发:',message);lastFailure=message;}try{fs.mkdirSync(home,{recursive:true});fs.writeFileSync(path.join(home,'status.json'),JSON.stringify({checkedAt:new Date().toISOString(),error:message}));}catch{}}
  finally{running=false;}
 };
 const timer=setInterval(()=>void tick(),5000);timer.unref?.();void tick();
 ctx.effect(()=>()=>{clearInterval(timer);adapter?.fileWorker?.stop?.();});
 log.info('B站微信桥接已加载：只读视频工具；抽象搞笑、游戏整活与短舞蹈按日报标记和回执去重转发。');
}

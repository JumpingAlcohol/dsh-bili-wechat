import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
function within(base,relative){
 if(typeof relative!=='string'||!relative||relative.includes('\\')||path.isAbsolute(relative)||relative.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('UNSAFE_PATH');
 const resolved=path.resolve(base,relative),prefix=path.resolve(base)+path.sep;if(!resolved.startsWith(prefix))throw Error('UNSAFE_PATH');
 let current=path.resolve(base);for(const part of relative.split('/')){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('UNSAFE_PATH: symbolic link');}
 return resolved;
}
function atomic(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});const temporary=file+'.local-patch-'+process.pid;fs.writeFileSync(temporary,bytes);fs.renameSync(temporary,file);}
function resultingBytes(entry,before,payload){
 if(entry.replacements){
  if(!before)throw Error('SOURCE_MISSING: '+entry.path);let text=before.toString('utf8');
  for(const pair of entry.replacements){if(text.includes(pair.from)){if(text.split(pair.from).length!==2)throw Error('SOURCE_CHANGED: ambiguous replacement '+entry.path);text=text.replace(pair.from,pair.to);}else if(!text.includes(pair.to))throw Error('SOURCE_CHANGED: replacement not found '+entry.path);}
  return Buffer.from(text);
 }
 const bytes=fs.readFileSync(within(payload,entry.payload));if(hash(bytes)!==entry.sha256)throw Error('PAYLOAD_HASH: '+entry.path);
 if(before&&hash(before)!==entry.sha256&&!entry.acceptedBefore?.includes(hash(before)))throw Error('SOURCE_CHANGED: '+entry.path);
 if(!before&&entry.acceptedBefore?.length)throw Error('SOURCE_MISSING: '+entry.path);return bytes;
}
export function planInstallation({root,payload,spec}){
 root=fs.realpathSync(root);if(!/^[a-z][a-z0-9-]*$/.test(spec.id??''))throw Error('UNSAFE_PATCH_ID');
 const workspace=path.join(root,'data/workspace'),bundle=path.join(root,'app/resources/project'),distribution=json(path.join(workspace,'config/distribution.json')),manifestPath=path.join(bundle,'deployment.json'),manifest=json(manifestPath);
 if(distribution.version!==spec.hostVersion||manifest.version!==spec.hostVersion)throw Error('HOST_VERSION: expected '+spec.hostVersion);
 const changes=[];
 for(const entry of spec.files)for(const [scope,base]of [['workspace',workspace],['bundle',bundle]]){
  const target=within(base,entry.path),before=fs.existsSync(target)?fs.readFileSync(target):null,after=resultingBytes(entry,before,payload);
  if(before&&before.equals(after))continue;
  changes.push({scope,relative:entry.path,target,before,after,beforeHash:before?hash(before):null,afterHash:hash(after)});
 }
 return {root,workspace,bundle,spec,manifestPath,manifest,changes};
}
export function applyInstallation(plan){
 if(!plan.changes.length)return {changed:0,alreadyInstalled:true};
 for(const change of plan.changes){const current=fs.existsSync(change.target)?hash(fs.readFileSync(change.target)):null;if(current!==change.beforeHash)throw Error('SOURCE_CHANGED: '+change.relative);}
 const backup=path.join(plan.workspace,'state/local-patches',plan.spec.id,Date.now()+'-'+crypto.randomBytes(3).toString('hex'));fs.mkdirSync(backup,{recursive:true});
 const record={version:1,root:plan.root,manifestPath:plan.manifestPath,files:[],manifestEntries:{}};
 for(const [index,change]of plan.changes.entries()){
  if(change.before)fs.writeFileSync(path.join(backup,index+'.before'),change.before);
  record.files.push({target:change.target,relative:change.relative,scope:change.scope,beforeHash:change.beforeHash,afterHash:change.afterHash,saved:change.before?index+'.before':null});
  if(change.scope==='bundle')record.manifestEntries[change.relative]={hash:plan.manifest.sourceHashes[change.relative]??null,listed:plan.manifest.files.includes(change.relative),afterHash:change.afterHash};
 }
 fs.writeFileSync(path.join(backup,'record.json'),JSON.stringify(record,null,2));fs.writeFileSync(path.join(backup,'deployment-before.json'),JSON.stringify(plan.manifest,null,2));
 try{
  for(const change of plan.changes)atomic(change.target,change.after);
  const manifest=json(plan.manifestPath);for(const [relative,item]of Object.entries(record.manifestEntries)){manifest.sourceHashes[relative]=item.afterHash;if(!manifest.files.includes(relative))manifest.files.push(relative);}
  atomic(plan.manifestPath,JSON.stringify(manifest,null,2)+'\n');
 }catch(error){
  for(const change of plan.changes){if(change.before)atomic(change.target,change.before);else if(fs.existsSync(change.target))fs.unlinkSync(change.target);}
  atomic(plan.manifestPath,JSON.stringify(plan.manifest,null,2)+'\n');throw error;
 }
 return {changed:plan.changes.length,backup};
}
export function restoreInstallation(backup){
 const record=json(path.join(backup,'record.json')),manifest=json(record.manifestPath),root=fs.realpathSync(record.root);
 if(record.version!==1||!Array.isArray(record.files)||record.manifestPath!==path.join(root,'app/resources/project/deployment.json'))throw Error('UNSAFE_BACKUP');
 for(const item of record.files){
  const base=path.join(root,item.scope==='workspace'?'data/workspace':'app/resources/project');if(within(base,item.relative)!==item.target)throw Error('UNSAFE_BACKUP');
  if(!fs.existsSync(item.target)||hash(fs.readFileSync(item.target))!==item.afterHash)throw Error('RESTORE_CONFLICT: '+item.relative);
  if(item.saved&&hash(fs.readFileSync(within(backup,item.saved)))!==item.beforeHash)throw Error('BACKUP_HASH');
 }
 for(const [relative,item]of Object.entries(record.manifestEntries))if(manifest.sourceHashes[relative]!==item.afterHash)throw Error('RESTORE_CONFLICT: deployment '+relative);
 for(const item of record.files){if(item.saved)atomic(item.target,fs.readFileSync(within(backup,item.saved)));else fs.unlinkSync(item.target);}
 for(const [relative,item]of Object.entries(record.manifestEntries)){if(item.hash===null)delete manifest.sourceHashes[relative];else manifest.sourceHashes[relative]=item.hash;if(!item.listed)manifest.files=manifest.files.filter(name=>name!==relative);}
 atomic(record.manifestPath,JSON.stringify(manifest,null,2)+'\n');return {restored:record.files.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
 try{
  if(args.includes('--restore'))console.log(JSON.stringify(restoreInstallation(path.resolve(option('--restore'))),null,2));
  else{
   if(!args.includes('--wechat-agent'))throw Error('Use --wechat-agent <installation root> [--apply]; default is read-only preview. Close WeChatAgent and DSH first.');
   const directory=path.resolve(import.meta.dirname,'..'),spec=json(path.join(directory,'compat/manifest.json'));
   const plan=planInstallation({root:path.resolve(option('--wechat-agent')),payload:path.join(directory,'compat/payload'),spec});
   console.log(JSON.stringify({patch:spec.id,hostVersion:spec.hostVersion,pendingFiles:plan.changes.map(item=>item.scope+'/'+item.relative),applied:false},null,2));
   if(args.includes('--apply'))console.log(JSON.stringify(applyInstallation(plan),null,2));
  }
 }catch(error){console.error(String(error.message));process.exitCode=1;}
}

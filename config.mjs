import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export function stateHome(env=process.env){return path.resolve(env.DSH_BILI_WECHAT_HOME||path.join(env.DSH_HOME||path.join(os.homedir(),'.dsh'),'bili-wechat'));}
export function resolveConfig(raw={}, {home=stateHome()}={}){
 const value={enabled:false,workspace:'',scrollPlugin:'',scrollHome:'',groupId:'',expectedGroupRef:'',...raw,home:path.resolve(home)};
 for(const key of ['workspace','scrollPlugin','scrollHome'])if(value[key])value[key]=path.resolve(value[key]);
 value.groupId=String(value.groupId??'');
 if(value.enabled&&(!/^[1-9]\d*$/.test(value.groupId)||!/^.{1,250}@chatroom$/.test(value.expectedGroupRef??'')))throw Error('FORWARD_GROUP_CONFIG_INVALID');
 return value;
}
export function loadConfig(home=stateHome()){
 const file=path.join(home,'config.json');return resolveConfig(fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):{},{home});
}
export function checkFiles(config){
 const needed=[['workspace',config.workspace,'scripts/hook-onebot.mjs'],['scrollPlugin',config.scrollPlugin,'lib/mcp.mjs'],['scrollHome',config.scrollHome,'config.json'],['scrollHome',config.scrollHome,'mcp_server.py']];
 const missing=needed.filter(([,root,relative])=>!root||!fs.existsSync(path.join(root,relative))).map(([setting,,relative])=>setting+': '+relative);
 return {ok:missing.length===0,missing};
}

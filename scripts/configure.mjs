import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadConfig,stateHome,resolveConfig,checkFiles} from '../config.mjs';
const args=process.argv.slice(2),value=name=>{const at=args.indexOf(name);return at<0?undefined:args[at+1];};
const home=path.resolve(value('--home')||stateHome()),existing=loadConfig(home);
if(args.includes('--help')||!args.length){console.log('node scripts/configure.mjs --workspace <WeChatAgent data/workspace> --scroll-plugin <dsh-bili-scroll> --scroll-home <bili-duty> [--home <data directory>] [--group-id <approved group ID> --enable]\n--check only checks dependencies; --disable stops new forwarding; no command sends a test message.');process.exit(0);}
const settings={...existing};
for(const [option,key]of [['--workspace','workspace'],['--scroll-plugin','scrollPlugin'],['--scroll-home','scrollHome'],['--group-id','groupId']])if(value(option)!==undefined)settings[key]=value(option);
if(args.includes('--check')){const result=checkFiles(resolveConfig(settings,{home}));console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;}
else{
 if(args.includes('--enable')){
  if(!settings.workspace||!settings.groupId)throw Error('Choose workspace and an approved group ID first');
  const {HookOneBot}=await import(pathToFileURL(path.join(settings.workspace,'scripts/hook-onebot.mjs')).href);
  const adapter=new HookOneBot({directory:settings.workspace});
  try{adapter.reload();if(!adapter.allowed('group',String(settings.groupId)))throw Error('GROUP_NOT_IN_WECHAT_WHITELIST');settings.expectedGroupRef=await adapter.resolveTarget('group',String(settings.groupId));settings.enabled=true;}finally{adapter.fileWorker?.stop?.();}
 }
 if(args.includes('--disable'))settings.enabled=false;
 const final=resolveConfig(settings,{home});if(!checkFiles(final).ok)throw Error('Dependencies missing; use --check');
 delete final.home;fs.mkdirSync(home,{recursive:true});const file=path.join(home,'config.json');if(fs.existsSync(file))fs.copyFileSync(file,file+'.backup-'+Date.now());fs.writeFileSync(file,JSON.stringify(final,null,2)+'\n');
 console.log('Configuration saved. Automatic forwarding: '+(final.enabled?'enabled for the selected approved group':'disabled')+'. No message sent.');
}

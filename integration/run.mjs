import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2),at=args.indexOf('--workspace');if(at<0||!args[at+1])throw Error('Use --workspace <WeChatAgent data/workspace>');
const workspace=path.resolve(args[at+1]),distribution=JSON.parse(fs.readFileSync(path.join(workspace,'config/distribution.json'),'utf8').replace(/^\uFEFF/,''));
if(!distribution.python||!fs.existsSync(distribution.python))throw Error('Bundled Python not found');
const env={...process.env,WECHATAGENT_WORKSPACE:workspace,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'};let failed=false;
for(const [command,argv]of [[process.execPath,['--test','wechat-upgrade.test.mjs']],[distribution.python,['-B','-m','unittest','discover','-s','.','-p','*_test.py']]]){const result=spawnSync(command,argv,{cwd:import.meta.dirname,env,stdio:'inherit',windowsHide:true});if(result.status!==0)failed=true;}
process.exitCode=failed?1:0;

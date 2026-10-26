import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
const workspace=process.env.WECHATAGENT_WORKSPACE;
if(!workspace)throw Error('Run integration/run.mjs --workspace <your WeChatAgent workspace>');
const {pluginEnabled}=await import(pathToFileURL(path.join(workspace,'packages/plugin-api/catalog.mjs')).href);
const {replyMessageLimit}=await import(pathToFileURL(path.join(workspace,'packages/dsh-social-bridge-plugin/reply-layout-policy.mjs')).href);

const bridgeFile=path.join(workspace,'components/qq-bridge/src/social-bridge.js');

// Exercise the real CLI's callback expressions, which the upstream engine-only
// tests miss. Use an isolated workspace, never the actual user's settings.
for(const name of ['notebookEnabledFor','maxTextPartsFor']){
  test(`WeChat 0.4.1 ${name} resolves the configured project root`,t=>{
    const root=fs.mkdtempSync(path.join(import.meta.dirname,'upgrade-fixture-'));
    fs.mkdirSync(path.join(root,'config'));
    fs.writeFileSync(path.join(root,'config/wechatagent.json'),JSON.stringify({wechat:{}}));
    t.after(()=>{
      assert.equal(path.dirname(root),import.meta.dirname);
      fs.rmSync(root,{recursive:true,force:true});
    });
    const source=fs.readFileSync(bridgeFile,'utf8');
    const line=source.split(/\r?\n/).find(row=>row.trimStart().startsWith(name+':'));
    assert.ok(line,'callback must be present at the real application call site');
    const expression=line.trim().slice(name.length+1).replace(/,$/,'');
    const callback=vm.runInNewContext('('+expression+')',{
      historyRoot:root,fs,path,pluginEnabled,replyMessageLimit,
    });
    const actual=callback('wechat:private:123');
    assert.equal(actual,name==='notebookEnabledFor'?false:replyMessageLimit({}));
  });
}

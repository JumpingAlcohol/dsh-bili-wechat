# B站 × 微信 · DSH视频桥接

作者：**bb王zyx**（B站同名）。`1.1.0-beta.1`，Windows，本地部署，MIT。把dsh-bili-scroll的新推荐发到指定微信群，让微信AI读取群友分享视频的可用字幕与三帧画面。

**这是DSH插件，不能直接作为WeChatAgent API v2 ZIP导入。**

## 功能

- Scroll成功完成一轮、日报稳定后，仅转发明确选中的抽象搞笑／游戏整活／短舞蹈，档位为“值得看”或“可以看”。
- 两个泡泡：短引导语 → 回执确认 → 标题与规范链接。不是微信原生视频卡片。
- 首次建立基线不补发旧推荐；按群、BV与泡泡持久去重。第二条失败不重发已确认的第一条；未确认任务保持相同操作ID。
- `bili_resolve_link`、`bili_watch_video`只读工具支持BV、官方URL和b23.tv，读取字幕与抽样画面，没有评论、私信、关注、收藏或账号管理工具。
- 普通手机分享卡片appmsg/4、appmsg/5需安装读取端兼容补丁；小程序等其他卡片未经验证。

抽样不等于完整播放，无字幕不编音频／对白。视频内容不是权限指令。读取和模型理解会消耗资源与额度，不承诺免费无限使用。

## 前置条件

先跑通[DSH](https://deepseek-harness.github.io/)、[dsh-bili-scroll](https://github.com/c1overzz/dsh-bili-scroll)的扫码登录与刷视频，以及[WeChatAgent](https://github.com/sourcepro5/WeChatAgent)**0.4.1**的后台微信收发。目标群加入白名单。

需要Node22.13+，可用WeChatAgent随附Node。Scroll数据目录应有`config.json`、`mcp_server.py`、`out/`、`duty.log`。微信、DSH、Hook、Python和账号登录由用户自行安装／配置，本包不包含这些程序与凭据。

## 安装与配置

1. 解压到稳定目录，如`C:\Plugins\dsh-bili-wechat`。在DSH插件管理中按本地目录／npm包方式安装。本包有DSH bundle入口；需要压缩包的版本可先`npm pack`生成`.tgz`，按该版本界面导入。不要从临时目录运行。确认`bili-wechat`日志加载成功。
2. 在项目目录配置自己的路径（示例需替换）：

   ```powershell
   node scripts/configure.mjs --workspace 'C:\Apps\WeChatAgent\data\workspace' --scroll-plugin 'C:\Plugins\dsh-bili-scroll' --scroll-home 'C:\Users\Example\.dsh\bili-duty'
   node scripts/configure.mjs --check
   ```

   默认状态在`$DSH_HOME/bili-wechat`，无DSH_HOME则用户目录`.dsh/bili-wechat`。可在启动DSH前设置`DSH_BILI_WECHAT_HOME`；配置工具与DSH必须使用同一环境。状态不进Git。
3. 默认不开自动发送。从WeChatAgent本地设置查到你自己的群数值ID，加入白名单后：

   ```powershell
   node scripts/configure.mjs --group-id '你自己的数值群ID' --enable
   ```

   命令核实群真实标识，不发测试消息；实际发送再次核对群和白名单。更换群重新配置；暂停用`node scripts/configure.mjs --disable`。
4. 在Scroll规则中补充`docs/report-format.md`。无新字段的旧报告只兼容明确抽象搞笑，不重放旧报告。
5. 在WeChatAgent对应聊天授权`bili_resolve_link`、`bili_watch_video`，人设参考`docs/chat-prompt.md`。是否接未@分享仍服从唤醒与限流策略，不需要授予B站写入工具。

## 手机分享卡片兼容

普通URL／BV可不装补丁。要识别appmsg卡片，从托盘退出WeChatAgent与DSH，保持微信登录，运行：

```powershell
.\Install.ps1 -WeChatAgentPath 'C:\Apps\WeChatAgent'
.\Install.ps1 -WeChatAgentPath 'C:\Apps\WeChatAgent' -Apply
```

仅接受0.4.1已知源文件，备份后同步读取端和启动模板，并局部修复两处工作区变量引用。已安装的峰谷插件逻辑会保留；冲突则拒绝覆盖。详见`docs/compatibility.md`。

## 运行、验证与来源

电脑保持唤醒，DSH、WeChatAgent、匹配版微信后台运行，窗口可最小化。退出DSH后本转发器停止。

`npm test`运行离线核心与安装器测试；`node integration/run.mjs --workspace <你的workspace>`额外验证本机卡片读取（需随附Python）。原本机版本曾取得实际微信群服务器回执；本次可移植版的路径与安装流程通过离线测试、临时安装验证，尚未在第二台电脑完成端到端验收，先用测试群验证。

仓库不含账号、Cookie、token、群号、聊天、个人口味档案或Hook二进制。来源见`NOTICE.md`及`licenses/`。反馈只带去掉账号信息的版本、错误码与必要日志，不上传整个数据目录。

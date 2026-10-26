# 兼容与还原

当前只接受WeChatAgent0.4.1。先退出WeChatAgent与DSH，保持微信登录。Install.ps1默认只预览，加-Apply才修改；不改用户账号配置、人格和记忆。

补丁支持普通appmsg/4、appmsg/5及BLOB解码，不提供原生视频卡片发送，不保证小程序卡片。普通链接不依赖此补丁。

读取端核对SHA256才替换，工作区与启动模板同步。工作区变量修复采用明确局部替换，保留峰谷插件等已有逻辑。冲突或其他版本停止安装。

备份在安装目录`data/workspace/state/local-patches/bili-wechat-cards/`。退出程序后还原：

```powershell
.\Install.ps1 -WeChatAgentPath 'C:\Apps\WeChatAgent' -RestoreBackup 'C:\Apps\WeChatAgent\data\workspace\state\local-patches\bili-wechat-cards\实际备份目录'
```

存在后续修改时拒绝覆盖，保留备份。只恢复本补丁部署条目，不删除账号与转发去重数据。

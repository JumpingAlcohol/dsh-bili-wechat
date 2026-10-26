# Bilibili / WeChat integration — bb王zyx

This local plugin uses the public interfaces of:

- c1overzz/dsh-bili-scroll (MIT): its read-only MCP client and video tools.
- sourcepro5/WeChatAgent: its conversation permissions, native Hook sender and durable server-receipt delivery store.

Image attachments use the DSH attachment reference convention demonstrated by dsh-bili-scroll.
It does not grant the WeChat model Bilibili comment, direct-message or account-management tools.

The optional compatibility payload includes the modified WeChatAgent 0.4.1
reader and a local Bilibili appmsg normalizer. The reader uses the upstream
weflow-cli source subset. MIT notices for WeChatAgent, qq-bridge,
weflow-cli and dsh-bili-scroll are retained in licenses/. No Hook binaries,
WeChat/DSH distributions, credentials or personal state are included.

New portable configuration, compatibility installation and documentation:
Copyright (c) 2026 bb王zyx, MIT.

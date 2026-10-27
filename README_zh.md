# Knowledge Hub

[English](README.md) · [源码仓库](https://github.com/LianWeiSQ/rss-factory) · [许可证](LICENSE)

Knowledge Hub 是面向 AI、金融资讯和长文阅读的本地 RSS 阅读器，基于 [DevXDojo/MrRSS](https://github.com/DevXDojo/MrRSS) **v1.3.41** 二次开发，上游基线提交为 `0b064ef54dfb2723fdfe08e63c50c7fe74746a94`。保留原项目历史、作者署名、版权声明及 GPL-3.0 许可证。

## 本次定制包含什么

- 三栏桌面阅读界面：紧凑的订阅侧栏、文章列表、聚焦正文的阅读区，支持亮色与暗色。
- 优化公众号正文：收敛多余空白、整理编号章节标题、改善图片与段落排版。排版优化不等于采集保障，第三方公众号转 RSS 源仍可能延迟或失效。
- macOS 独立的「显示菜单栏未读数量」开关，默认关闭；阅读器内部的未读计数独立保留。
- 产品名称与仓库、更新链接统一为 Knowledge Hub，同时保留旧版数据和导入格式兼容。

技术底座沿用 MrRSS 的 Go 后端、Vue/TypeScript 前端、Wails 桌面壳和 SQLite 数据库。已有 RSS/Atom、RSSHub、XPath、脚本、Newsletter、过滤规则、文章导出、可选 AI，以及 FreshRSS/Miniflux 集成。各项边界见[架构说明](docs/ARCHITECTURE.md)和[阅读器同步说明](docs/READER_INTEGRATIONS.md)。

## 从源码构建桌面版

依赖版本以 `go.mod` 和 `frontend/package-lock.json` 为准。macOS 需要 Xcode Command Line Tools；其他平台参见[构建要求](docs/BUILD_REQUIREMENTS.md)。iOS 目录属于实验性预留工程，尚不支持一条命令构建可交付的手机版本。

```sh
git clone https://github.com/LianWeiSQ/rss-factory.git
cd rss-factory
cd frontend
CYPRESS_INSTALL_BINARY=0 npm ci
cd ..
CYPRESS_INSTALL_BINARY=0 go run github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-beta.31 build
```

macOS 产物为 `build/bin/KnowledgeHub.app`，显示名称为 **Knowledge Hub**。本机使用时签名后再复制到「应用程序」：

```sh
codesign --deep --force --sign - \
  --entitlements build/darwin/entitlements.plist \
  build/bin/KnowledgeHub.app
codesign --verify --deep --strict build/bin/KnowledgeHub.app
```

替换安装前请完全退出正在运行的阅读器。修改源码不会自动更新已安装的 App。本项目后续安装包以[当前仓库 Releases](https://github.com/LianWeiSQ/rss-factory/releases) 为准；MrRSS 官方安装包不包含本次定制改动。

## 数据兼容

为了避免改名后出现空资料库，默认数据目录有意沿用旧版位置：

| 系统 | 兼容目录 |
| --- | --- |
| macOS | `~/Library/Application Support/MrRSS/` |
| Windows | `%APPDATA%\MrRSS\` |
| Linux | `~/.local/share/MrRSS/` |

已安装应用标识 `io.github.lianweisq.cssfactory` 保持不变，以维持改显示名后的应用身份连续性。`MrRSS-bootstrap/storage.json`、便携版的 `mrrss-storage.json`、`MRRSS_*` 环境变量、单实例标识 `com.mrrss.app`、加密标记 `MrRSS-v1:` 及规则备份格式 `mrrss-rules` 也保留兼容。这些属于数据接口，不是遗漏改名。不要让 MrRSS 和 Knowledge Hub 同时操作同一份资料库。迁移前阅读[数据目录说明](docs/DATA_DIRECTORY.md)；换电脑后，绑定机器加密的凭证可能需要重新输入。

个人数据库、订阅清单、API Key 和编译后的应用均不包含在源码仓库中。

## 浏览器与服务器模式

从这份源码构建，才能包含定制后的前端：

```sh
cd frontend
npm run build
cd ..
go build -tags server -o knowledge-hub-server .
./knowledge-hub-server --host 127.0.0.1 --port 1235 --data-dir ./data
```

浏览器打开 `http://127.0.0.1:1235/`。Server 同时提供阅读页面与 `/api/*`；桌面 App 的回环监听器只提供 API。服务端使用独立的数据目录，**不会自动与桌面数据库同步**。

服务端**没有内置用户登录**。应仅监听本机，或放在有身份校验的私人网关之后。iPhone/iPad 使用需要部署可访问的服务并验证移动布局；添加主屏幕图标不会自动获得完整离线能力或云同步。详见 [Server 模式](docs/SERVER_MODE/README.md)。

## AI 与 Agent 接入

AI 是可选功能。可以按需配置自己的服务商或本地模型；调用时选定内容会发送至所配置的服务。参见[模型服务配置](docs/AI_PROVIDERS.md)。

[Knowledge Hub Assistant](skills/knowledge-hub-assistant/SKILL.md) 让外部 Agent 通过 REST API 检索、阅读运行中的实例。安装见[技能说明](docs/SKILLS.zh.md)。该技能也兼容现有 MrRSS 的本地 API；外部 Agent 分析文章不要求阅读器另配模型密钥，也不要求启用自动摘要。

## 开发与致谢

- 前端测试：在 `frontend/` 执行 `npm run test:unit`。
- 后端测试：在仓库根目录执行 `go test -timeout=5m ./internal/...`。
- [贡献指南](CONTRIBUTING.md)、[项目约定](AGENTS.md)、[安全边界](SECURITY.md)。
- `website/` 仅为站点源码，本项目不使用上游的域名，也不宣称已上线托管服务。

感谢 **Ch3nyang 和 MrRSS 的所有贡献者**。本仓库保留[GPL-3.0 许可证](LICENSE)、上游历史与原始版权头。本次定制以前的版本历史见未改写的上游[变更记录](CHANGELOG.zh-CN.md)。

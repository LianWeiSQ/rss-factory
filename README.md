# CSS Factory

[简体中文](README_zh.md) · [Source](https://github.com/LianWeiSQ/rss-factory) · [License](LICENSE)

CSS Factory is a local-first RSS reader for AI news, financial news and long-form articles. It is a customized distribution of [DevXDojo/MrRSS](https://github.com/DevXDojo/MrRSS), based on **v1.3.41** (commit `0b064ef54dfb2723fdfe08e63c50c7fe74746a94`). The original project, contributors, copyright notices and GPL-3.0 license are retained.

## What this distribution changes

- A quieter three-pane desktop interface with a compact source sidebar, article list and focused reader; supports light and dark themes.
- Improved WeChat article rendering: less empty space, normalized numbered headings, responsive images and readable paragraphs. These changes affect presentation; third-party WeChat-to-RSS sources can still fail or lag.
- A separate **Show Menu Bar Unread Count** setting on macOS, disabled by default. Counts inside the reader remain independent.
- CSS Factory product identity and repository/release links, while retaining storage and import compatibility with MrRSS.

The Go backend, Vue/TypeScript frontend, Wails desktop shell and SQLite database are inherited from MrRSS. Existing capabilities include RSS/Atom, RSSHub integration, XPath and script feeds, Newsletter ingestion, filtering rules, article export, optional AI, and FreshRSS/Miniflux integrations. Refer to the [architecture](docs/ARCHITECTURE.md) and [reader integrations](docs/READER_INTEGRATIONS.md) for their boundaries.

## Build the desktop app

Use the versions in `go.mod` and `frontend/package-lock.json`. macOS requires Xcode Command Line Tools; Windows and Linux have [platform prerequisites](docs/BUILD_REQUIREMENTS.md). The iOS directory is experimental and is not a supported one-command mobile release.

```sh
git clone https://github.com/LianWeiSQ/rss-factory.git
cd rss-factory
cd frontend
CYPRESS_INSTALL_BINARY=0 npm ci
cd ..
CYPRESS_INSTALL_BINARY=0 go run github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-beta.31 build
```

On macOS, the build produces `build/bin/CSSFactory.app`, displayed as **CSS Factory**. For local use, sign it before copying it to Applications:

```sh
codesign --deep --force --sign - \
  --entitlements build/darwin/entitlements.plist \
  build/bin/CSSFactory.app
codesign --verify --deep --strict build/bin/CSSFactory.app
```

Fully quit the running reader before replacing an installed application. Changing source files alone does not update an installed app. Published packages, when available, are listed in [this repository's releases](https://github.com/LianWeiSQ/rss-factory/releases); upstream MrRSS installers do not contain this distribution's changes.

## Data and compatibility

This distribution intentionally keeps the existing default data locations so renaming the product does not silently create an empty library:

| Platform | Existing default directory |
| --- | --- |
| macOS | `~/Library/Application Support/MrRSS/` |
| Windows | `%APPDATA%\MrRSS\` |
| Linux | `~/.local/share/MrRSS/` |

The `MrRSS-bootstrap/storage.json`, portable `mrrss-storage.json`, `MRRSS_*` environment variables, single-instance identity `com.mrrss.app`, encrypted marker `MrRSS-v1:` and rule backup format `mrrss-rules` remain compatibility interfaces. They are not branding omissions. Do not run MrRSS and CSS Factory against the same library concurrently. See [data directory selection and migration](docs/DATA_DIRECTORY.md) before moving data. Machine-bound encrypted credentials may need to be entered again on another computer.

Personal databases, subscriptions, API keys and built applications are not part of this repository.

## Browser / server mode

Build this source tree to retain the customized frontend:

```sh
cd frontend
npm run build
cd ..
go build -tags server -o css-factory-server .
./css-factory-server --host 127.0.0.1 --port 1235 --data-dir ./data
```

Open `http://127.0.0.1:1235/`. Server mode serves both the reader page and `/api/*`. The desktop listener only exposes the local API. A server uses its own data directory; it does **not** automatically synchronize the desktop database.

The server has **no built-in user login**. Keep it on loopback or behind an authenticated private gateway. Phone/iPad access requires reachable deployment and mobile UI verification; complete offline use and cloud synchronization are not supplied by adding a Home Screen icon. See [server mode](docs/SERVER_MODE/README.md).

## AI and agents

AI is optional. Configure your own provider or local model only when needed; selected article content is sent to the configured provider. See [AI provider configuration](docs/AI_PROVIDERS.md).

The [CSS Factory Assistant](skills/css-factory-assistant/SKILL.md) skill lets an external agent inspect and search the running instance through its REST API. Install it using the [skill guide](docs/SKILLS.md). It can read a compatible existing MrRSS instance; neither an application-specific model key nor automatic summaries are required for an external agent to analyze fetched articles.

## Development and attribution

- `cd frontend` then `npm run test:unit` for frontend tests.
- `go test -timeout=5m ./internal/...` for backend tests.
- [Contributing](CONTRIBUTING.md), [project conventions](AGENTS.md), [security boundaries](SECURITY.md).
- The website directory is source only; this fork does not claim the upstream domain or a deployed hosted service.

CSS Factory is based on **MrRSS by Ch3nyang and the MrRSS contributors**. The upstream history, [GPL-3.0 license](LICENSE) and original copyright headers are retained. See the unchanged upstream [changelog](CHANGELOG.md) for history before this distribution's changes.

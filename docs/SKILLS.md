# CSS Factory Skills

English | [简体中文](SKILLS.zh.md)

CSS Factory ships a Codex skill package for users who want an AI agent to inspect and operate their CSS Factory data through the local REST API.

## What Is Included

The release asset `CSSFactory-<version>-skills.zip` contains:

- `css-factory-assistant/SKILL.md` - agent workflow and safety rules.
- `css-factory-assistant/references/api.md` - generated API reference from `docs/SERVER_MODE/swagger.json`.
- `css-factory-assistant/scripts/generate_api_reference.py` - maintenance script for regenerating the API reference.
- `css-factory-assistant/agents/openai.yaml` - Codex UI metadata.

## Install

1. Download `CSSFactory-<version>-skills.zip` from the GitHub release page.
2. Extract it.
3. Copy the extracted `css-factory-assistant` folder into your Codex skills directory:

Windows:

```powershell
Copy-Item -Recurse .\css-factory-assistant "$env:USERPROFILE\.codex\skills\"
```

macOS or Linux:

```bash
cp -R ./css-factory-assistant ~/.codex/skills/
```

4. Restart Codex so it can discover the new skill.

## Use

Start the CSS Factory desktop app. Current desktop builds expose the API at
`http://localhost:1234/api` on the loopback interface while the app is running.
The API is not exposed to other computers on the network. If port `1234` is
already occupied, CSS Factory continues running but the local API is unavailable until
the port is freed and the app is restarted.

Alternatively, run CSS Factory in headless server mode:

```bash
docker run -p 127.0.0.1:1234:1234 ghcr.io/lianweisq/rss-factory:latest-amd64
```

Then ask Codex:

```text
Use $css-factory-assistant to inspect my unread CSS Factory articles and summarize the most important items.
```

The skill defaults to `http://localhost:1234/api`. If your instance uses another host or port, include it in the prompt.

## Safety Model

The skill tells agents to:

- prefer read-only API calls first;
- ask before destructive operations, bulk status changes, cache clearing, or settings updates;
- redact credentials and API keys from responses;
- use CSS Factory API endpoints instead of direct SQLite access unless the user explicitly asks for offline inspection.

## Maintainers

When API routes change, regenerate the reference:

```bash
python skills/css-factory-assistant/scripts/generate_api_reference.py docs/SERVER_MODE/swagger.json skills/css-factory-assistant/references/api.md
```

CI checks that the generated reference stays in sync. The release workflow packages the skill as `CSSFactory-<version>-skills.zip` and uploads it as a release asset.

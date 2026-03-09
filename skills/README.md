```
╔═╗╔═╗╦═╗╔╦╗╔═╗╦ ╦╔═╗╔╗   ╔═╗╦╔═╦╦  ╦  ╔═╗
╠═╝║╣ ╠╦╝║║║╠═╣║║║║╣ ╠╩╗  ╚═╗╠╩╗║║  ║  ╚═╗
╩  ╚═╝╩╚═╩ ╩╩ ╩╚╩╝╚═╝╚═╝  ╚═╝╩ ╩╩╩═╝╩═╝╚═╝
```

A collection of Permaweb CLI skills for [Claude Code](https://claude.ai/code) and [OpenCode](https://opencode.ai).

## Skills

| Skill | Description | Docs |
|-------|-------------|------|
| `arweave` | Upload files/sites to Arweave + manage ArNS records | [skills/arweave/SKILL.md](skills/arweave/SKILL.md) |
| `monitor` | AO Task Monitor client (summaries, alerts, logs) | [skills/monitor/SKILL.md](skills/monitor/SKILL.md) |
| `aoconnect` | Interact with AO processes - spawn, message, read results, monitor | [skills/aoconnect/SKILL.md](skills/aoconnect/SKILL.md) |
| `apus` | AI inference via APUS on AO Network (chat, streaming, TEE attestation) | [skills/apus/SKILL.md](skills/apus/SKILL.md) |

## Installation

Install skills into your project using the `skills` CLI:

```sh
# Install the Arweave skill
npx skills add https://github.com/permaweb/skills --skill arweave

# Install the Monitor skill
npx skills add https://github.com/permaweb/skills --skill monitor

# Install the AO Connect skill
npx skills add https://github.com/permaweb/skills --skill aoconnect

# Install the APUS skill
npx skills add https://github.com/permaweb/skills --skill apus
```

This adds the skill to your project's `.claude/skills/` or `.opencode/skills/` directory.

## Usage with Claude Code

Once installed, invoke skills by asking Claude Code naturally:

### Arweave

```
use arweave to upload ./my-document.md
use arweave to upload ./dist
use arweave to attach <txId> to myname
```

Claude Code will prompt for your wallet path if not configured.

**Full docs:** [skills/arweave/SKILL.md](skills/arweave/SKILL.md)

### Monitor

```
use monitor to get a summary
use monitor to check alerts
use monitor to show logs for ao-token-info
```

Requires `AO_MONITOR_KEY` environment variable (see skill docs for setup).

**Full docs:** [skills/monitor/SKILL.md](skills/monitor/SKILL.md)

### AO Connect

```
use aoconnect to spawn <process>
use aoconnect to message <process> --data=<string>
use aoconnect to read result --message=<id>
use aoconnect to dryrun --message=<id>
```

Claude Code will prompt for your wallet path if not configured.

**Full docs:** [skills/aoconnect/SKILL.md](skills/aoconnect/SKILL.md)

### APUS AI Inference

```
use apus to chat "What is AO?"
use apus to stream "Explain blockchain"
use apus to verify <attestation>
use apus to check health
```

Requires `openai` SDK (`pip install openai` or `npm install openai`).

**Full docs:** [skills/apus/SKILL.md](skills/apus/SKILL.md)

## Manual CLI Usage

You can also run the CLIs directly:

### Arweave

```sh
# Upload a file
node skills/arweave/index.mjs upload ./file.md --wallet ./wallet.json

# Upload a website
node skills/arweave/index.mjs upload-site ./dist --wallet ./wallet.json

# Attach to ArNS name
node skills/arweave/index.mjs attach <txId> myname --wallet ./wallet.json --yes

# Query transactions (with automatic endpoint fallback for reliability)
node skills/arweave/index.mjs query --tag "Content-Type:text/html" --limit 10
node skills/arweave/index.mjs query --owner <address> --limit 50
node skills/arweave/index.mjs query --block-min 587540 --block-max 587550

# Use a custom GraphQL endpoint
node skills/arweave/index.mjs query --tag "App-Name:MyApp" --limit 10 \
  --graphql-endpoint "https://custom-gateway.com/graphql"
```

The query command supports automatic endpoint fallback for reliability. If the primary Arweave gateway is unavailable, it will automatically try alternative endpoints.

**Full docs:** [skills/arweave/SKILL.md](skills/arweave/SKILL.md)

### Monitor

```sh
# System summary
node skills/monitor/index.mjs summary

# Check alerts
node skills/monitor/index.mjs alerts

# View logs
node skills/monitor/index.mjs logs --limit 50
```

**Full docs:** [skills/monitor/SKILL.md](skills/monitor/SKILL.md)

### AO Connect

```sh
# Send a message to an ao process
node skills/aoconnect/index.mjs message \
  --wallet ./wallet.json \
  --process <id> \
  --data=<message> \
  --tags "Action=send"

# Dry run a message without committing
node skills/aoconnect/index.mjs dryrun \
  --message=<id> \
  --process=<id>

# Spawn a new ao process
node skills/aoconnect/index.mjs spawn \
  --wallet ./wallet.json \
  --module=<module-txid> \
  --scheduler=<scheduler-address>

# Monitor messages
node skills/aoconnect/index.mjs monitor \
  --process <id> \
  --on-message "{console.log(msg.tags)}"
```

**Full docs:** [skills/aoconnect/SKILL.md](skills/aoconnect/SKILL.md)

## Requirements

- Node.js 18+
- Internet access
- Arweave wallet (JWK format) for `arweave` and `aoconnect` skills
- `AO_MONITOR_KEY` env var for `monitor` skill
- `@permaweb/aoconnect` package for `aoconnect` skill
- `openai` SDK (Python or Node.js) for `apus` skill

## Development

The `arweave` skill requires a build step (bundles dependencies):

```sh
npm ci
npm run build
node skills/arweave/index.mjs --help
```

The `monitor` skill is dependency-free and runs directly:

```sh
node skills/monitor/index.mjs --help
```

The `aoconnect` skill requires:

```sh
cd skills/aoconnect
npm install
node skills/aoconnect/index.mjs --help
```

## License

MIT

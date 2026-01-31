# Agent Skills for the Permaweb - Upload files and websites to Arweave, manage ArNS domains, and interact with AO processes

A collection of Permaweb CLI skills for [Claude Code](https://claude.ai/code) and [OpenCode](https://opencode.ai).

## Skills

| Skill | Description | Docs |
|-------|-------------|------|
| **aoconnect** | Interact with AO processes - spawn, message, read results, monitor | [skills/aoconnect/SKILL.md](skills/aoconnect/SKILL.md) |
| **arweave** | Upload files/sites to Arweave + manage ArNS records | [skills/arweave/SKILL.md](skills/arweave/SKILL.md) |
| **monitor** | AO Task Monitor client (summaries, alerts, logs) | [skills/monitor/SKILL.md](skills/monitor/SKILL.md) |
| **code-review** | Automated code reviews using OpenCode with kimi-k2 | [skills/code-review/SKILL.md](skills/code-review/SKILL.md) |

## Installation

Install skills into your project using the skills CLI:

```bash
# Install the AO Connect skill
npx skills add https://github.com/permaweb/skills --skill aoconnect

# Install the Arweave skill
npx skills add https://github.com/permaweb/skills --skill arweave

# Install the Monitor skill
npx skills add https://github.com/permaweb/skills --skill monitor

# Install the Code Review skill
npx skills add https://github.com/permaweb/skills --skill code-review
```

This adds the skill to your project's `.claude/skills/` or `.opencode/skills/` directory.

## Usage with Claude Code

Once installed, invoke skills by asking Claude Code naturally:

### AO Connect

```bash
use aoconnect to spawn <process>
use aoconnect to message <process> --data=<string>
use aoconnect to read result --message=<id>
use aoconnect to dryrun --message=<id>
```

Claude Code will prompt for your wallet path if not configured.

### Arweave

```bash
use arweave to upload <file>
use arweave to upload <directory>
use arweave to attach <txId> to <name>
```

Claude Code will prompt for your wallet path if not configured.

### Monitor

```bash
use monitor to get a summary
use monitor to check alerts
use monitor to show logs for ao-token-info
```

Requires `AO_MONITOR_KEY` environment variable (see skill docs for setup).

### Code Review

```bash
use code-review to review <code>
use code-review to generate-workflow
use code-review to post --repo=owner/repo --pr=1
```

Requires OpenCode CLI installed: `npm install -g opencode`

## Manual CLI Usage

You can also run the CLIs directly:

### AO Connect

```bash
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

### Arweave

```bash
# Upload a single file
node skills/arweave/index.mjs upload "<file>" --wallet ./wallet.json

# Upload a website directory
node skills/arweave/index.mjs upload-site "<directory>" --index "index.html" --wallet ./wallet.json

# Attach a transaction to an ArNS name
node skills/arweave/index.mjs attach "<txId>" "<name>" --wallet ./wallet.json --yes
```

### Monitor

```bash
# System summary
node skills/monitor/index.mjs summary

# Check alerts
node skills/monitor/index.mjs alerts

# View logs
node skills/monitor/index.mjs logs --limit 50
```

### Code Review

```bash
# Review a PR with OpenCode
node skills/code-review/index.mjs review --repo=owner/repo --pr=1

# Generate GitHub Actions workflow
node skills/code-review/index.mjs generate-workflow --repo=owner/repo --pr=1

# Post review to GitHub
node skills/code-review/index.mjs post --repo=owner/repo --pr=1 --summary=review-summary.json
```

Requires:
- Node.js 18+
- OpenCode CLI installed: `npm install -g opencode`
- kimi-k2 model access via OpenCode

## Requirements

- Node.js 18+
- Internet access
- **For arweave skill**: Arweave wallet (JWK format)
- **For monitor skill**: `AO_MONITOR_KEY` environment variable
- **For aoconnect skill**: Arweave wallet (JWK format) and `@permaweb/aoconnect` package
- **For code-review skill**: OpenCode CLI and kimi-k2 model access

## Development

### AO Connect

The aoconnect skill requires the dependency:

```bash
cd skills/aoconnect
npm install
node skills/aoconnect/index.mjs --help
```

### Arweave

The arweave skill requires a build step (bundles dependencies):

```bash
cd skills/arweave
npm ci
npm run build
node skills/arweave/index.mjs --help
```

### Monitor

The monitor skill is dependency-free and runs directly:

```bash
cd skills/monitor
node skills/monitor/index.mjs --help
```

### Code Review

The code-review skill has no build step:

```bash
cd skills/code-review
node skills/code-review/index.mjs --help
```

## Tests

```bash
# Test aoconnect
node skills/aoconnect/index.mjs --help

# Test arweave
node skills/arweave/index.mjs --help

# Test monitor
node skills/monitor/index.mjs --help

# Test code-review
node skills/code-review/index.mjs --help
```

## License

MIT

## See Also

- [AO Cookbook](https://cookbook_ao.arweave.net)
- [AR.IO Documentation](https://ar.io)
- [@permaweb/aoconnect Package](https://www.npmjs.com/package/@permaweb/aoconnect)
- [Arweave Docs](https://docs.arweave.org)
- [OpenCode](https://opencode.ai)
- [Kimi-K2 Model](https://opencode.ai/docs/agents/)

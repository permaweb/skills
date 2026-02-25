---
name: arweave
description: Upload files and websites to permanent storage on Arweave (permaweb), and manage ArNS domain records. Use when the user wants to publish content to Arweave, deploy a static site to the permaweb, or attach a transaction to an ArNS name (ar.io).
compatibility: Requires Node.js 18+, internet access, and an Arweave wallet (JWK format)
metadata:
  author: rakis
  version: "0.0.1"
---

# Arweave Upload & ArNS Skill

Upload files and websites to permanent storage on Arweave, and manage ArNS (Arweave Name System) domain records.

## Phrase Mappings

| User Request | Command |
|--------------|---------|
| "use arweave to upload `<file>`" | `upload` |
| "use arweave to upload `<dir>`" | `upload-site` |
| "use arweave to attach `<txId>` to `<name>`" | `attach` |
| "use arweave to query transactions" | `query` |
| "use arweave to generate a wallet" | `generate-wallet` |

## Wallet Handling

**Important**: This skill requires an Arweave wallet file (JWK format).

- If the user has not provided a wallet path, **ask them for it** before proceeding
- Pass the wallet path via `--wallet <path>` argument
- **Never expose or log wallet contents**

## Commands

### Upload a Single File

```sh
node skills/arweave/index.mjs upload "<file>" --wallet "<path/to/wallet.json>"
```

### Turbo (Irys) Upload Support

This skill supports **Turbo/Irys bundling** for faster, cheaper uploads. Turbo is used by default for uploads.

**Benefits of Turbo:**
- **Faster**: Uploads complete in seconds vs. minutes for direct Arweave
- **Cheaper**: Often significantly lower fees, especially for small files
- **Free tier**: Small uploads may be free

**Options:**

- `--turbo` - Use Turbo/Irys for upload (default: enabled)
- `--no-turbo` - Use direct Arweave transactions instead of Turbo
- `--turbo-node <url>` - Use a custom Irys node URL (optional)

```sh
# Upload with Turbo (default - faster and cheaper)
node skills/arweave/index.mjs upload "file.json" --wallet "wallet.json"

# Explicitly use Turbo
node skills/arweave/index.mjs upload "file.json" --turbo --wallet "wallet.json"

# Use direct Arweave instead of Turbo
node skills/arweave/index.mjs upload "file.json" --no-turbo --wallet "wallet.json"

# Use custom Irys node
node skills/arweave/index.mjs upload "file.json" --turbo-node "https://custom-irys.node.io" --wallet "wallet.json"
```

**Note**: Turbo requires an Irys node or API key. The default uses AR.IO's Turbo service. If Turbo fails, the upload will automatically fall back to direct Arweave.

### Upload a Website/Directory

```sh
node skills/arweave/index.mjs upload-site "<directory>" --index "index.html" --wallet "<path/to/wallet.json>"
```

- `--index` specifies the default file served at the root (defaults to `index.html`)
- The returned `txId` is the **manifest transaction** that serves the entire site

### Upload Progress

Add `--progress` flag to upload commands to show upload progress.

```sh
# Show progress bar during upload
node skills/arweave/index.mjs upload-site "./myapp" --progress --wallet "wallet.json"
```

- Shows percentage or bytes uploaded
- Useful for large files

### Attach Transaction to ArNS Name

```sh
node skills/arweave/index.mjs attach "<txId>" "<name>" --wallet "<path/to/wallet.json>" --yes
```

**Options:**
- `--ttl <seconds>` - Time-to-live in seconds (default: 3600)
- `--network <mainnet|testnet>` - Network to use (default: mainnet)
- `--ario-process <id>` - Override network with specific ARIO process ID
- `--yes` - Skip confirmation prompts

**Propagation:** Updates usually appear within a few minutes, but can take up to ~30 minutes to reflect everywhere (gateway/operator caches and client TTLs).

## ArNS Name Format

- Names with underscore like `hello_rakis` mean **undername** `hello` on base name `rakis`
- Strip `.ar.io` suffix if present (e.g., `rakis.ar.io` becomes `rakis`)

Examples:
- `rakis` - base name (updates `@` record)
- `hello_rakis` - undername `hello` under base `rakis`
- `docs_myproject` - undername `docs` under base `myproject`

## Network Selection

By default, the skill uses **mainnet**. You can specify a different network:

```sh
# Use mainnet (default)
node skills/arweave/index.mjs attach "<txId>" "<name>" --network mainnet --wallet "..." --yes

# Use testnet
node skills/arweave/index.mjs attach "<txId>" "<name>" --network testnet --wallet "..." --yes

# Use specific ARIO process ID (overrides --network)
node skills/arweave/index.mjs attach "<txId>" "<name>" --ario-process "<processId>" --wallet "..." --yes
```

### Generate a New Wallet

```sh
node skills/arweave/index.mjs generate-wallet
node skills/arweave/index.mjs generate-wallet "./my-wallet.json"
```

- Generates an RSA-4096 Arweave wallet (JWK) using Node.js built-in `crypto.subtle`
- Defaults to `./wallet.json` if no path given
- Prompts before overwriting an existing file (use `--yes` to skip)
- Prints the wallet address after generation
- **No network calls needed** - purely local key generation
- The new wallet starts with zero balance; fund it before uploading

## Output Handling

After successful upload, report back:

1. **Transaction ID** (`txId`)
2. **Gateway URL**: `https://arweave.net/<txId>`

Example response to user:
```
Uploaded successfully!
- Transaction ID: abc123xyz...
- View at: https://arweave.net/abc123xyz...
```

For site uploads, clarify that the txId represents the manifest transaction serving the entire site.

### Query Transactions

```sh
node skills/arweave/index.mjs query [options]
```

Search and filter Arweave transactions using the GraphQL endpoint.

**Options:**

- `--tag <name:value>` - Filter by tag (can specify multiple, uses AND logic)
- `--owner <address>` - Filter by owner wallet address
- `--recipient <address>` - Filter by recipient wallet address
- `--ids <comma-separated>` - Query specific transaction IDs
- `--block-min <height>` - Minimum block height
- `--block-max <height>` - Maximum block height
- `--limit <number>` - Max results to return (default: 10, set to 0 for all)
- `--sort <HEIGHT_DESC|HEIGHT_ASC>` - Sort order (default: HEIGHT_DESC)

**Tag Syntax:**

Tags use the format `name:value`. Multiple `--tag` flags apply AND logic (all conditions must match).

```sh
# Single tag
--tag "Content-Type:text/html"

# Multiple tags (both must match)
--tag "Content-Type:text/html" --tag "User-Agent:ArweaveAutoDPL/0.1"
```

**Pagination:**

- Default limit is 10 transactions
- Use `--limit 0` to fetch all matching results
- Large queries may take time; consider narrowing filters for faster results

**Examples:**

```sh
# Query last 10 recent transactions
node skills/arweave/index.mjs query --sort HEIGHT_DESC

# Find all HTML content (fetch all results)
node skills/arweave/index.mjs query --tag "Content-Type:text/html" --limit 0

# Query by owner with custom limit
node skills/arweave/index.mjs query --owner "M6w588ZkR8SVFdPkNXdBy4sqbMN0Y3F8ZJUWm2WCm8M" --limit 50

# Multiple tags (AND logic: both conditions must match)
node skills/arweave/index.mjs query \
  --tag "Content-Type:text/html" \
  --tag "User-Agent:ArweaveAutoDPL/0.1" \
  --limit 20

# Query block height range
node skills/arweave/index.mjs query --block-min 587540 --block-max 587550 --limit 100

# Combine filters: HTML in specific block range, oldest first
node skills/arweave/index.mjs query \
  --tag "Content-Type:text/html" \
  --block-min 587540 \
  --block-max 587550 \
  --sort HEIGHT_ASC

# Query specific transaction IDs
node skills/arweave/index.mjs query --ids "abc123,def456,ghi789"

# Find transactions from specific recipient
node skills/arweave/index.mjs query --recipient "M6w588ZkR8SVFdPkNXdBy4sqbMN0Y3F8ZJUWm2WCm8M" --limit 25
```

### GraphQL Endpoint Fallback

The `query` command automatically tries multiple GraphQL endpoints for reliability:

1. `https://arweave.net/graphql` (primary - official gateway)
2. `https://arweave-search.goldsky.com/graphql` (fallback - Goldsky indexer)
3. `https://g8way.io/graphql` (fallback - alternative gateway)

This happens **transparently** - the command uses whichever endpoint responds first. You don't need to do anything; it just works.

#### Custom Endpoint Override

To use a specific GraphQL endpoint (useful for testing or private gateways):

```sh
# Use a custom endpoint
node skills/arweave/index.mjs query --tag "Content-Type:text/html" --limit 5 \
  --graphql-endpoint "https://custom-gateway.com/graphql"

# Force use of a specific public endpoint
node skills/arweave/index.mjs query --owner <address> --limit 10 \
  --graphql-endpoint "https://g8way.io/graphql"
```

**Note**: When `--graphql-endpoint` is provided, the automatic fallback is disabled. Only the specified endpoint will be tried.

## Example Invocations

```sh
# Upload a single markdown file
node skills/arweave/index.mjs upload "foo.md" --wallet "/path/to/wallet.json"

# Upload a website directory
node skills/arweave/index.mjs upload-site "./mywebsite" --index "index.html" --wallet "/path/to/wallet.json"

# Attach a transaction to an ArNS undername (mainnet)
node skills/arweave/index.mjs attach "<txId>" "hello_rakis" --ttl 3600 --network mainnet --wallet "/path/to/wallet.json" --yes

# Attach to testnet
node skills/arweave/index.mjs attach "<txId>" "hello_rakis" --network testnet --wallet "/path/to/wallet.json" --yes

# Attach using specific ARIO process
node skills/arweave/index.mjs attach "<txId>" "hello_rakis" --ario-process testnet --wallet "/path/to/wallet.json" --yes

# Generate a new wallet
node skills/arweave/index.mjs generate-wallet
node skills/arweave/index.mjs generate-wallet "./my-wallet.json"
node skills/arweave/index.mjs generate-wallet "./my-wallet.json" --yes
```

## Cost Estimation

Add `--estimate` or `--dry-run` flag to show upload cost without posting.

```sh
# Estimate cost before uploading
node skills/arweave/index.mjs upload-site "./myapp" --estimate --wallet "wallet.json"
```

- Shows estimated AR cost based on file size
- Does NOT post transaction

## Error Handling

This section documents common errors you may encounter when using Arweave commands and how to resolve them.

### Invalid Wallet File

**What the error looks like:**
```
Error: Invalid JWK wallet file
```
or
```
Error: Wallet file not found
```
or parsing errors related to missing `n`, `e`, or other RSA key components.

**How to fix it:**
- Verify the wallet file path is correct
- Ensure the wallet file is valid JSON in JWK format
- Check that it contains required fields: `n`, `e`, `d`, `p`, `q`, `dp`, `dq`, `qi`

**Recovery steps:**
1. Confirm the file exists at the specified path
2. Validate the JSON structure with `cat wallet.json | jq .`
3. If corrupted, restore from backup or obtain a new wallet

### Insufficient AR Balance

**What the error looks like:**
```
Error: Insufficient AR balance for transaction
```
or
```
Error: Not enough AR to cover winston cost
```

**How to fix it:**
- The wallet does not have enough AR tokens to fund the transaction plus fees

**Recovery steps:**
1. Check wallet balance using an Arweave block explorer (arweave.net)
2. Fund the wallet with more AR tokens
3. For testnet, use the testnet faucet to get test AR

### Network Timeouts

**What the error looks like:**
```
Error: Request timed out
```
or
```
Error: connect ETIMEDOUT
```
or gateway 504/503 errors.

**How to fix it:**
- Temporary network issues or gateway overload

**Recovery steps:**
1. Retry the command (network issues are often transient)
2. Check Arweave network status (arweave.net health endpoints)
3. Try again in a few minutes
4. For uploads, verify the file exists and is accessible

### Transaction Failures

**What the error looks like:**
```
Error: Transaction failed
```
or
```
Error: TX_FAILED
```

**How to fix it:**
- The transaction was rejected by the network (invalid data, insufficient fees, etc.)

**Recovery steps:**
1. Verify the file data is valid and not corrupted
2. Check that the transaction fee is sufficient
3. Retry with a slightly higher fee if the transaction keeps failing
4. Ensure the wallet has sufficient balance

### Invalid ArNS Name Format

**What the error looks like:**
```
Error: Invalid ArNS name format
```
or
```
Error: Name must be lowercase alphanumeric
```

**How to fix it:**
- ArNS names must follow specific formatting rules

**Recovery steps:**
1. Use only lowercase letters (a-z), numbers (0-9), and underscores (_)
2. Ensure format is correct: `name` or `undername_basename`
3. Strip any `.ar.io` suffix (use just `name`, not `name.ar.io`)
4. Examples: `rakis`, `hello_rakis`, `docs_myproject`

## Security

Follow these security best practices when working with Arweave wallets and transactions.

### Wallet File Permissions

**Best practice:** Restrict file permissions to owner-only access.

```sh
# Set permissions to read/write for owner only
chmod 600 /path/to/wallet.json
```

This prevents other users on the system from reading your wallet file.

### Never Share JWK Contents

- Your JWK (JSON Web Key) wallet file contains your private key
- **Never** share the contents of your wallet file with anyone
- Never paste wallet contents into chat, documentation, or code
- Never commit wallet files to version control

### Input Validation for File Paths

- Validate that file paths exist before passing to upload commands
- Be cautious with paths provided by users
- Use absolute paths when possible to avoid ambiguity
- Check that you're not accidentally uploading sensitive files

### Don't Log Sensitive Data

- Never log or output wallet private key contents
- Don't echo wallet file paths in verbose logs
- When reporting errors, redact sensitive information
- Transaction IDs and addresses are safe to share; private keys are not

### Additional Tips

- Keep backups of your wallet in a secure location
- Consider using a hardware wallet or dedicated wallet for production use
- Test with small amounts or testnet before doing mainnet transactions
- Verify transaction IDs after upload to confirm success

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { NodeARx } from '@permaweb/arx/node';
import { ArweaveSigner, ARIO, ANT, AOProcess, ARIO_MAINNET_PROCESS_ID, ARIO_TESTNET_PROCESS_ID } from '@ar.io/sdk/node';
import { connect } from '@permaweb/aoconnect';
import { queryTransactions, QueryParams } from './graphql.js';

interface ParsedArgs {
  command: string | null;
  target: string | null;
  name: string | null;
  wallet: string | null;
  index: string;
  ttl: number;
  yes: boolean;
  help: boolean;
  force: boolean;
  network: 'mainnet' | 'testnet';
  arioProcess: string | null;
  queryIds?: string[];
  queryOwners?: string[];
  queryRecipients?: string[];
  queryTags?: { name: string; values: string[] }[];
  queryBlockMin?: number;
  queryBlockMax?: number;
  querySort?: 'HEIGHT_DESC' | 'HEIGHT_ASC';
  queryLimit?: number;
  graphqlEndpoint?: string;
}

interface ArweaveJWK {
  kty: string;
  n: string;
  [key: string]: unknown;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: null,
    target: null,
    name: null,
    wallet: null,
    index: 'index.html',
    ttl: 3600,
    yes: false,
    help: false,
    force: false,
    network: 'mainnet',
    arioProcess: null,
  };

  const positional: string[] = [];
  let i = 0;

  // Helper to validate that a flag has a value
  function requireFlagValue(flag: string): string {
    const nextArg = args[i + 1];
    if (nextArg === undefined || nextArg.startsWith('--')) {
      console.error(`Error: ${flag} requires a value`);
      process.exit(1);
    }
    i++; // consume the value
    return nextArg;
  }

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      i++;
    } else if (arg === '--wallet') {
      result.wallet = requireFlagValue('--wallet');
      i++;
    } else if (arg === '--index') {
      result.index = requireFlagValue('--index');
      i++;
    } else if (arg === '--ttl') {
      const ttlStr = requireFlagValue('--ttl');
      result.ttl = parseInt(ttlStr, 10);
      i++;
    } else if (arg === '--yes' || arg === '-y') {
      result.yes = true;
      i++;
    } else if (arg === '--force' || arg === '-f') {
      result.force = true;
      i++;
    } else if (arg === '--network') {
      const val = requireFlagValue('--network');
      if (val === 'mainnet' || val === 'testnet') {
        result.network = val;
      } else {
        console.error(`Error: --network must be 'mainnet' or 'testnet', got '${val}'`);
        process.exit(1);
      }
      i++;
    } else if (arg === '--ario-process') {
      result.arioProcess = requireFlagValue('--ario-process');
      i++;
    } else if (arg === '--ids') {
      const idsStr = requireFlagValue('--ids');
      result.queryIds = idsStr.split(',').map(id => id.trim()).filter(id => id.length > 0);
      i++;
    } else if (arg === '--owner') {
      const owner = requireFlagValue('--owner');
      if (!result.queryOwners) {
        result.queryOwners = [];
      }
      result.queryOwners.push(owner);
      i++;
    } else if (arg === '--recipient') {
      const recipient = requireFlagValue('--recipient');
      if (!result.queryRecipients) {
        result.queryRecipients = [];
      }
      result.queryRecipients.push(recipient);
      i++;
    } else if (arg === '--tag') {
      const tagStr = requireFlagValue('--tag');
      const colonCount = (tagStr.match(/:/g) || []).length;
      if (colonCount !== 1) {
        console.error(`Error: --tag format must be 'name:value', got '${tagStr}'`);
        process.exit(1);
      }
      const colonIndex = tagStr.indexOf(':');
      const tagName = tagStr.slice(0, colonIndex).trim();
      const tagValue = tagStr.slice(colonIndex + 1).trim();
      
      if (!tagName || !tagValue) {
        console.error(`Error: --tag format must have non-empty name and value, got '${tagStr}'`);
        process.exit(1);
      }
      
      if (!result.queryTags) {
        result.queryTags = [];
      }
      
      // Find existing tag with same name or create new one
      const existingTag = result.queryTags.find(t => t.name === tagName);
      if (existingTag) {
        existingTag.values.push(tagValue);
      } else {
        result.queryTags.push({ name: tagName, values: [tagValue] });
      }
      i++;
    } else if (arg === '--block-min') {
      const blockMinStr = requireFlagValue('--block-min');
      result.queryBlockMin = parseInt(blockMinStr, 10);
      i++;
    } else if (arg === '--block-max') {
      const blockMaxStr = requireFlagValue('--block-max');
      result.queryBlockMax = parseInt(blockMaxStr, 10);
      i++;
    } else if (arg === '--sort') {
      const sortVal = requireFlagValue('--sort');
      if (sortVal === 'HEIGHT_DESC' || sortVal === 'HEIGHT_ASC') {
        result.querySort = sortVal;
      } else {
        console.error(`Error: --sort must be 'HEIGHT_DESC' or 'HEIGHT_ASC', got '${sortVal}'`);
        process.exit(1);
      }
      i++;
    } else if (arg === '--limit') {
      const limitStr = requireFlagValue('--limit');
      result.queryLimit = parseInt(limitStr, 10);
      i++;
    } else if (arg === '--graphql-endpoint') {
      result.graphqlEndpoint = requireFlagValue('--graphql-endpoint');
      i++;
    } else if (arg.startsWith('--')) {
      // Unknown flag - warn but continue
      console.error(`Warning: Unknown flag '${arg}'. Use --help for usage.`);
      i++;
    } else {
      positional.push(arg);
      i++;
    }
  }

  // Validate --ttl is a finite positive integer
  if (!Number.isFinite(result.ttl) || result.ttl <= 0 || !Number.isInteger(result.ttl)) {
    console.error('Error: --ttl must be a positive integer');
    process.exit(1);
  }

  // Validate query flags
  if (result.queryBlockMin !== undefined) {
    if (!Number.isFinite(result.queryBlockMin) || !Number.isInteger(result.queryBlockMin)) {
      console.error('Error: --block-min must be an integer');
      process.exit(1);
    }
  }

  if (result.queryBlockMax !== undefined) {
    if (!Number.isFinite(result.queryBlockMax) || !Number.isInteger(result.queryBlockMax)) {
      console.error('Error: --block-max must be an integer');
      process.exit(1);
    }
  }

  if (result.queryBlockMin !== undefined && result.queryBlockMax !== undefined) {
    if (result.queryBlockMin > result.queryBlockMax) {
      console.error('Error: --block-min must be less than or equal to --block-max');
      process.exit(1);
    }
  }

  if (result.queryLimit !== undefined) {
    if (!Number.isFinite(result.queryLimit) || !Number.isInteger(result.queryLimit) || result.queryLimit < 0) {
      console.error('Error: --limit must be a non-negative integer');
      process.exit(1);
    }
  }

  // First positional is the command
  if (positional.length > 0) {
    result.command = positional[0];
  }

  // Second positional is the target (file/dir/txId)
  if (positional.length > 1) {
    result.target = positional[1];
  }

  // Third positional is the name (for attach command)
  if (positional.length > 2) {
    result.name = positional[2];
  }

  return result;
}

function showHelp(): void {
  console.log(`
Arweave Skill Tool

Usage:
  arweave-skill <command> [options]

Commands:
  upload <file>                       Upload a file to Arweave
  upload-site <dir> [--index file]    Upload a directory as a static site
  attach <txId> <name>                Attach an ArNS name to a transaction
  query                               Query transactions from Arweave GraphQL
  generate-wallet [path]              Generate a new Arweave wallet (JWK)

Options:
  --wallet <path>       Path to Arweave wallet keyfile (JWK json)
  --index <file>        Index file for site uploads (default: index.html)
  --ttl <seconds>       TTL for ArNS name (default: 3600)
  --network <net>       Network: mainnet or testnet (default: mainnet)
  --ario-process <id>   ARIO process ID (overrides --network)
                        Can be: mainnet, testnet, or a process ID
  --force               Continue upload-site even if index file is missing
  --yes, -y             Skip confirmation prompts
  --help, -h            Show this help message

Query Options:
  --ids <id1,id2,...>   Filter by comma-separated transaction IDs
  --owner <address>     Filter by owner address (repeatable)
  --recipient <address> Filter by recipient address (repeatable)
  --tag <name:value>    Filter by tag (repeatable, same name = OR logic)
  --block-min <height>  Minimum block height
  --block-max <height>  Maximum block height
  --limit <n>           Maximum number of results (default: 10)
  --sort <order>        Sort order: HEIGHT_DESC or HEIGHT_ASC (default: HEIGHT_DESC)
  --graphql-endpoint <url> Custom GraphQL endpoint (default: auto-fallback)

Environment:
  ARWEAVE_WALLET        Path to wallet keyfile (alternative to --wallet)

Examples:
  arweave-skill upload ./file.md --wallet ./wallet.json
  arweave-skill upload-site ./dist --wallet ./wallet.json
  arweave-skill attach <txId> myname --network mainnet --wallet ./wallet.json
  arweave-skill attach <txId> sub_myname --ario-process testnet --wallet ./wallet.json --yes
  arweave-skill query --owner <address> --limit 5
  arweave-skill query --tag App-Name:MyApp --tag Type:post --block-min 1000000
  arweave-skill query --ids <txId1>,<txId2>,<txId3>
  arweave-skill query --owner <address> --graphql-endpoint https://arweave.net/graphql
  arweave-skill generate-wallet
  arweave-skill generate-wallet ./my-wallet.json
`);
}

async function promptForInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function validateWallet(walletPath: string): ArweaveJWK {
  // Check file exists
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet file not found: ${walletPath}`);
  }

  // Read and parse JSON
  let walletData: unknown;
  try {
    const content = fs.readFileSync(walletPath, 'utf-8');
    walletData = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse wallet file as JSON: ${walletPath}`);
  }

  // Validate JWK structure
  if (
    typeof walletData !== 'object' ||
    walletData === null ||
    !('kty' in walletData) ||
    !('n' in walletData)
  ) {
    throw new Error(
      'Invalid Arweave wallet: missing required JWK properties (kty, n)'
    );
  }

  return walletData as ArweaveJWK;
}

async function resolveWallet(cliWalletPath: string | null): Promise<ArweaveJWK> {
  let walletPath: string | null = null;

  // 1. Check CLI argument
  if (cliWalletPath) {
    walletPath = cliWalletPath;
  }
  // 2. Check environment variable
  else if (process.env.ARWEAVE_WALLET) {
    walletPath = process.env.ARWEAVE_WALLET;
  }
  // 3. Prompt on stdin
  else {
    walletPath = await promptForInput('Path to Arweave wallet keyfile (JWK json): ');
  }

  if (!walletPath) {
    throw new Error('No wallet path provided');
  }

  // Resolve relative paths
  const resolvedPath = path.resolve(walletPath);
  return validateWallet(resolvedPath);
}

async function handleUpload(args: ParsedArgs): Promise<void> {
  if (!args.target) {
    console.error('Error: upload requires a file path');
    process.exit(1);
  }

  // Resolve the file path
  const filePath = path.resolve(args.target);
  
  // Verify file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Verify it's a file, not a directory
  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) {
    console.error('Error: Path is a directory. Use upload-site for directories.');
    process.exit(1);
  }

  const wallet = await resolveWallet(args.wallet);
  
  console.log(`Uploading file: ${filePath}`);

  // Initialize arx and upload
  const arx = new NodeARx({
    token: 'arweave',
    url: 'https://turbo.ardrive.io',
    key: wallet,
  });

  await arx.ready();

  const result = await arx.uploadFile(filePath);
  const txId = result.id;

  console.log('');
  console.log('Upload successful!');
  console.log(`  Transaction ID: ${txId}`);
  console.log(`  Gateway URL: https://arweave.net/${txId}`);
}

async function handleUploadSite(args: ParsedArgs): Promise<void> {
  if (!args.target) {
    console.error('Error: upload-site requires a directory path');
    process.exit(1);
  }

  // Resolve the directory path
  const dirPath = path.resolve(args.target);

  // Verify directory exists
  if (!fs.existsSync(dirPath)) {
    console.error(`Error: Directory not found: ${dirPath}`);
    process.exit(1);
  }

  // Verify it's a directory
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    console.error('Error: Path is not a directory. Use upload for single files.');
    process.exit(1);
  }

  // Check if index file exists
  let indexFile = args.index;
  const indexPath = path.join(dirPath, indexFile);
  if (!fs.existsSync(indexPath)) {
    // Try to find a default index file
    const defaultIndexes = ['index.html', 'index.htm'];
    const found = defaultIndexes.find(f => fs.existsSync(path.join(dirPath, f)));
    if (found) {
      indexFile = found;
    } else if (args.force) {
      // --force: warn but continue
      console.warn(`Warning: Index file '${indexFile}' not found in directory (continuing due to --force)`);
    } else {
      // No --force: fail fast
      console.error(`Error: Index file '${indexFile}' not found in directory`);
      console.error(`  Use --force to upload anyway, or --index to specify a different index file`);
      process.exit(1);
    }
  }

  const wallet = await resolveWallet(args.wallet);

  console.log(`Uploading site: ${dirPath}`);
  console.log(`  Index file: ${indexFile}`);

  // Initialize arx and upload folder
  const arx = new NodeARx({
    token: 'arweave',
    url: 'https://turbo.ardrive.io',
    key: wallet,
  });

  await arx.ready();

  const result = await arx.uploadFolder(dirPath, { indexFile });
  const txId = result.id;

  console.log('');
  console.log('Site upload successful!');
  console.log(`  Manifest Transaction ID: ${txId}`);
  console.log(`  Gateway URL: https://arweave.net/${txId}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

async function handleAttach(args: ParsedArgs): Promise<void> {
  if (!args.target) {
    console.error('Error: attach requires a transaction ID');
    process.exit(1);
  }

  if (!args.name) {
    console.error('Error: attach requires a name');
    process.exit(1);
  }

  const wallet = await resolveWallet(args.wallet);
  const txId = args.target;
  let name = args.name;

  // Strip .ar.io suffix if present
  if (name.endsWith('.ar.io')) {
    name = name.slice(0, -6);
  }

  // Parse undername vs base name
  // Format: undername_basename (e.g., hello_rakis)
  let baseName: string;
  let undername: string | null = null;

  if (name.includes('_')) {
    const parts = name.split('_');
    undername = parts[0];
    baseName = parts.slice(1).join('_');
  } else {
    baseName = name;
  }

  // Determine ARIO process ID (using exported constants from @ar.io/sdk)

  let arioProcessId: string;
  let networkLabel: string;

  if (args.arioProcess) {
    // --ario-process overrides --network
    if (args.arioProcess === 'mainnet') {
      arioProcessId = ARIO_MAINNET_PROCESS_ID;
      networkLabel = 'mainnet';
    } else if (args.arioProcess === 'testnet') {
      arioProcessId = ARIO_TESTNET_PROCESS_ID;
      networkLabel = 'testnet';
    } else {
      arioProcessId = args.arioProcess;
      networkLabel = `custom (${args.arioProcess.slice(0, 8)}...)`;
    }
  } else {
    // Use --network flag
    if (args.network === 'testnet') {
      arioProcessId = ARIO_TESTNET_PROCESS_ID;
      networkLabel = 'testnet';
    } else {
      arioProcessId = ARIO_MAINNET_PROCESS_ID;
      networkLabel = 'mainnet';
    }
  }

  console.log(`Attaching transaction to ArNS name`);
  console.log(`  Network: ${networkLabel}`);
  console.log(`  Transaction ID: ${txId}`);
  console.log(`  Base name: ${baseName}`);
  if (undername) {
    console.log(`  Undername: ${undername}`);
  }
  console.log(`  TTL: ${args.ttl} seconds`);

  // Confirmation prompt unless --yes
  if (!args.yes) {
    const confirm = await promptForInput(`This will update a ${networkLabel} ArNS record. Continue? (y/N): `);
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // Configure AO connection with reliable endpoints (permaweb-deploy pattern)
  const ao = connect({
    CU_URL: 'https://cu.ardrive.io',
    MU_URL: 'https://mu.ao-testnet.xyz',
    MODE: 'legacy',
  });

  // Initialize signer
  const signer = new ArweaveSigner(wallet);

  // Initialize ARIO with configured AO
  const ario = ARIO.init({
    signer,
    process: new AOProcess({ processId: arioProcessId, ao }),
  });

  // Get ArNS record to find the ANT process ID (with timeout)
  console.log(`\nLooking up ArNS record for '${baseName}'...`);
  
  let arnsRecord;
  try {
    arnsRecord = await withTimeout(
      ario.getArNSRecord({ name: baseName }),
      60000,
      `ArNS lookup for '${baseName}' on ${networkLabel}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    console.error(`  Network: ${networkLabel}`);
    console.error(`  ARIO Process: ${arioProcessId}`);
    console.error(`  Tip: Try a different --network or --ario-process`);
    process.exit(1);
  }

  if (!arnsRecord) {
    console.error(`Error: ArNS name '${baseName}' not found on ${networkLabel}`);
    process.exit(1);
  }

  console.log(`  Found ANT process: ${arnsRecord.processId}`);

  // Initialize ANT with configured AO (need to pass ao for fast endpoints)
  const ant = ANT.init({
    signer,
    process: new AOProcess({ processId: arnsRecord.processId, ao }),
  });

  // Update record - use '@' for base record, undername for undernames
  console.log('Updating record...');
  const recordUndername = undername || '@';

  try {
    await withTimeout(
      ant.setRecord({
        undername: recordUndername,
        transactionId: txId,
        ttlSeconds: args.ttl,
      }),
      90000,
      `ANT setRecord on ${networkLabel}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    console.error(`  Network: ${networkLabel}`);
    console.error(`  ANT Process: ${arnsRecord.processId}`);
    process.exit(1);
  }

  console.log('');
  console.log('ArNS record updated successfully!');
  if (undername) {
    console.log(`  ${undername}_${baseName}.arweave.net now points to ${txId}`);
  } else {
    console.log(`  ${baseName}.arweave.net now points to ${txId}`);
  }
}

function toB64Url(buf: Uint8Array): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function handleGenerateWallet(args: ParsedArgs): Promise<void> {
  const outPath = args.target
    ? path.resolve(args.target)
    : path.resolve('wallet.json');

  // Safety: don't overwrite an existing wallet unless --yes
  if (fs.existsSync(outPath) && !args.yes) {
    const confirm = await promptForInput(
      `File already exists: ${outPath}\nOverwrite? (y/N): `
    );
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  console.log('Generating Arweave wallet (RSA-4096)...');

  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength: 4096,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey!);

  // Derive address: SHA-256 of the public modulus (n)
  const nBytes = Buffer.from(jwk.n!, 'base64');
  const addressHash = await crypto.subtle.digest('SHA-256', nBytes);
  const address = toB64Url(new Uint8Array(addressHash));

  fs.writeFileSync(outPath, JSON.stringify(jwk, null, 2));

  console.log('');
  console.log('Wallet generated successfully!');
  console.log(`  File: ${outPath}`);
  console.log(`  Address: ${address}`);
  console.log('');
  console.log('IMPORTANT: Back up this file securely. Anyone with this file controls the wallet.');
  console.log('NOTE: This is a new wallet with zero balance. Fund it before uploading.');
}

async function handleQuery(args: ParsedArgs): Promise<void> {
  // Validate that at least one filter is provided
  const hasFilter = 
    (args.queryIds && args.queryIds.length > 0) ||
    (args.queryOwners && args.queryOwners.length > 0) ||
    (args.queryRecipients && args.queryRecipients.length > 0) ||
    (args.queryTags && args.queryTags.length > 0) ||
    args.queryBlockMin !== undefined ||
    args.queryBlockMax !== undefined;

  if (!hasFilter) {
    console.error('Error: query requires at least one filter');
    console.error('  Use --ids, --owner, --recipient, --tag, --block-min, or --block-max');
    process.exit(1);
  }

  // Build QueryParams object from parsed args
  const queryParams: QueryParams = {};

  if (args.queryIds && args.queryIds.length > 0) {
    queryParams.ids = args.queryIds;
  }

  if (args.queryOwners && args.queryOwners.length > 0) {
    queryParams.owners = args.queryOwners;
  }

  if (args.queryRecipients && args.queryRecipients.length > 0) {
    queryParams.recipients = args.queryRecipients;
  }

  if (args.queryTags && args.queryTags.length > 0) {
    queryParams.tags = args.queryTags;
  }

  if (args.queryBlockMin !== undefined) {
    queryParams.blockMin = args.queryBlockMin;
  }

  if (args.queryBlockMax !== undefined) {
    queryParams.blockMax = args.queryBlockMax;
  }

  if (args.querySort) {
    queryParams.sort = args.querySort;
  }

  if (args.queryLimit !== undefined) {
    queryParams.limit = args.queryLimit;
  }

  if (args.graphqlEndpoint) {
    queryParams.endpointOverride = args.graphqlEndpoint;
  }

  try {
    // Call queryTransactions (progress feedback goes to stderr)
    const transactions = await queryTransactions(queryParams);

    // Format results as pretty JSON to stdout
    const output = {
      query: queryParams,
      results: {
        total: transactions.length,
        transactions: transactions,
      },
    };

    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Handle specific error types with clear messages
    if (message.includes('timed out')) {
      console.error(`Error: Query timed out`);
      console.error(`  ${message}`);
      console.error(`  Tip: Try narrowing your query filters or reducing --limit`);
    } else if (message.includes('GraphQL error')) {
      console.error(`Error: ${message}`);
      console.error(`  Tip: Check your filter values (IDs, addresses, tags)`);
    } else if (message.includes('Failed to query Arweave GraphQL')) {
      console.error(`Error: Unable to reach Arweave GraphQL endpoints`);
      console.error(`  ${message}`);
      console.error(`  Tip: Check your internet connection or try --graphql-endpoint with a custom gateway`);
    } else if (message.includes('Failed to reach')) {
      console.error(`Error: Network error`);
      console.error(`  ${message}`);
      console.error(`  Tip: Check your internet connection`);
    } else {
      console.error(`Error: ${message}`);
    }

    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.command) {
    showHelp();
    process.exit(args.help ? 0 : 1);
  }

  try {
    switch (args.command) {
      case 'upload':
        await handleUpload(args);
        break;

      case 'upload-site':
        await handleUploadSite(args);
        break;

      case 'attach':
        await handleAttach(args);
        break;

      case 'query':
        await handleQuery(args);
        break;

      case 'generate-wallet':
        await handleGenerateWallet(args);
        break;

      default:
        console.error(`Unknown command: ${args.command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();

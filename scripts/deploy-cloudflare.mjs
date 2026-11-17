import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const config = JSON.parse(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8'));
const runtime = resolve(root, '.cloudflare-deploy.generated.json');
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
function run(args, capture = false) {
  return execFileSync(npx, ['--yes', 'wrangler@4.164.0', ...args], {
    cwd: root, env, encoding: 'utf8', stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    shell: process.platform === 'win32',
  });
}
// Provision once, preserve the same database on subsequent deployments.
const name = config.d1_databases[0].database_name;
let databases = JSON.parse(run(['d1', 'list', '--json'], true));
let database = databases.find(row => row.name === name);
if (!database) {
  run(['d1', 'create', name]);
  databases = JSON.parse(run(['d1', 'list', '--json'], true));
  database = databases.find(row => row.name === name);
}
if (!database?.uuid) throw new Error('Could not find the Cloudflare D1 database after provisioning. Retry deployment; no existing data has been deleted.');
config.d1_databases[0].database_id = database.uuid;
writeFileSync(runtime, JSON.stringify(config, null, 2) + '\n');
try {
  run(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', runtime]);
  run(['deploy', '--config', runtime]);
} finally {
  unlinkSync(runtime);
}

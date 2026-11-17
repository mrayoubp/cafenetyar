import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  VITE_CONVEX_URL: process.env.VITE_CONVEX_URL || 'https://striped-cobra-115.convex.cloud',
  VITE_MANAGED_ACCOUNTS: 'false',
  VITE_SITE_ADMIN: 'true',
};
execFileSync(npm, ['run', 'build'], { cwd: resolve(root, 'source'), env, stdio: 'inherit', shell: process.platform === 'win32' });
execFileSync(process.execPath, ['scripts/build-original-with-admin.mjs'], { cwd: root, env, stdio: 'inherit' });

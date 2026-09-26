// Ensure a Chromium is available for Buyer Arena.
// BUYER_ARENA_CHROMIUM_PATH (air-gapped machines, containers with their own Chromium) skips the
// download entirely; otherwise Playwright installs its managed Chromium once.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const custom = process.env.BUYER_ARENA_CHROMIUM_PATH;
if (custom) {
  if (!existsSync(custom)) {
    console.error(`BUYER_ARENA_CHROMIUM_PATH points to a missing file: ${custom}`);
    process.exit(1);
  }
  console.log(`Using Chromium at ${custom} (BUYER_ARENA_CHROMIUM_PATH); no download.`);
  process.exit(0);
}
const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['playwright', 'install', 'chromium'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);

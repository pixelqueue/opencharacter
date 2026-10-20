import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  packageName,
  PLACEHOLDER_TAG,
  placeholderManifest,
  registryUrl,
  stagedId,
  trustCommand,
} from './npm-setup.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: pnpm release:setup <pack-id or package name>...');
  process.exit(1);
}

const workspace = new Set(
  execFileSync('git', ['ls-files', '--', 'packages/*/package.json', 'packs/*/*/package.json'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .map((f) => (JSON.parse(readFileSync(join(root, f), 'utf8')) as { name: string }).name),
);
const names = args.map(packageName);
const unknown = names.filter((n) => !workspace.has(n));
if (unknown.length > 0) {
  console.error(`Not a published package in this repo: ${unknown.join(', ')}`);
  process.exit(1);
}

try {
  console.log(`npm user: ${execFileSync('npm', ['whoami'], { encoding: 'utf8' }).trim()}`);
} catch {
  console.error('Not logged in to npm. Run `npm login` first.');
  process.exit(1);
}

const onNpm = async (name: string) => (await fetch(registryUrl(name))).status === 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const staged: { name: string; id: string | undefined }[] = [];
for (const name of names) {
  if (await onNpm(name)) {
    console.log(
      `${name} is already on npm: nothing to stage. If its trust link has expired, delete it on npmjs.com before running the command below.`,
    );
    continue;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ocf-npm-setup-'));
  try {
    writeFileSync(
      join(dir, 'package.json'),
      `${JSON.stringify(placeholderManifest(name), null, 2)}\n`,
    );
    writeFileSync(
      join(dir, 'README.md'),
      '# Placeholder\n\nHolds the name for trusted publishing setup.\n',
    );
    const run = spawnSync(
      'npm',
      ['stage', 'publish', '--access', 'public', '--tag', PLACEHOLDER_TAG],
      { cwd: dir, encoding: 'utf8' },
    );
    if (run.status !== 0) {
      console.error(`${name}: npm stage publish failed.\n${run.stderr}`);
      process.exit(1);
    }
    const id = stagedId(`${run.stdout}\n${run.stderr}`);
    staged.push({ name, id });
    console.log(`${name}: placeholder staged${id ? ` (${id})` : ''}. Waiting for npm's stub…`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const { name } of staged) {
  let found = false;
  for (let i = 0; i < 60 && !found; i++) {
    found = await onNpm(name);
    if (!found) await sleep(15_000);
  }
  console.log(
    found ? `${name}: on npm.` : `${name}: not on npm after 15 minutes; check \`npm stage list\`.`,
  );
}

console.log(`
1. In your own terminal (npm asks for 2FA in the browser; choose "skip for 5 minutes"):

${names.map(trustCommand).join(' && sleep 2 && \\\n')}

2. Merge the Version Packages pull request within 2 days: a trust link no publish has used expires.
3. A new package's first version can take up to an hour to show on npm. Don't re-run the release
   meanwhile. Once \`npm view <package> versions\` lists it, reject the placeholder:
${staged.length > 0 ? `\n${staged.map((s) => `npm stage reject ${s.id ?? '<id from npm stage list>'}   # ${s.name}`).join('\n')}` : '\n(nothing staged)'}`);

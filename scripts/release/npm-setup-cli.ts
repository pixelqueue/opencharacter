import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  packageName,
  parseTrustList,
  PLACEHOLDER_TAG,
  placeholderManifest,
  publishedPackages,
  registryUrl,
  releaseLinks,
  stagedId,
  trustArgs,
  trustCommand,
  type WorkspacePackage,
} from './npm-setup.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const renew = args.includes('--renew');
const printOnly = args.includes('--print');
const listed = args.filter((a) => !a.startsWith('--'));

const workspace = execFileSync(
  'git',
  ['ls-files', '--', 'packages/*/package.json', 'packs/*/*/package.json'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)
  .map((f) => JSON.parse(readFileSync(join(root, f), 'utf8')) as WorkspacePackage);
const known = new Set(workspace.map((p) => p.name));

const names = listed.length > 0 ? listed.map(packageName) : publishedPackages(workspace);
const unknown = names.filter((n) => !known.has(n));
if (unknown.length > 0) {
  console.error(`Not a published package in this repo: ${unknown.join(', ')}`);
  process.exit(1);
}

const onNpm = async (name: string) => (await fetch(registryUrl(name))).status === 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// npm may ask for 2FA in the browser: let it talk to the terminal.
const npm = (npmArgs: string[]) => spawnSync('npm', npmArgs, { stdio: 'inherit' }).status === 0;
// Like npm(), but also keeps stdout to parse: npm prints its 2FA login link there too, so the
// output goes to the terminal as it arrives.
const npmShown = (npmArgs: string[]) =>
  new Promise<{ status: number | null; stdout: string }>((resolve) => {
    const child = spawn('npm', npmArgs, { stdio: ['inherit', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.on('close', (status) => resolve({ status, stdout }));
  });

try {
  console.log(`npm user: ${execFileSync('npm', ['whoami'], { encoding: 'utf8' }).trim()}`);
} catch {
  console.error('Not logged in to npm. Run `npm login` first.');
  process.exit(1);
}
console.log(`Packages: ${names.join(', ')}\n`);

// 1. Every package must exist on npm before it can be trusted: stage a placeholder for new ones.
const staged: { name: string; id: string | undefined }[] = [];
for (const name of names) {
  if (await onNpm(name)) continue;
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
  if (!found) {
    console.error(`${name}: not on npm after 15 minutes; check \`npm stage list\` and run again.`);
    process.exit(1);
  }
  console.log(`${name}: on npm.`);
}

// 2. Trust: check each package's links to release.yml and create the missing ones.
const failed: string[] = [];
const created: string[] = [];
if (printOnly) {
  console.log(
    `\nRun in your own terminal:\n\n${names.map(trustCommand).join(' && sleep 2 && \\\n')}`,
  );
} else {
  console.log(
    '\nnpm may ask for 2FA in the browser for each package; choose "skip for 5 minutes" once.\n',
  );
  for (const name of names) {
    const list = await npmShown(['trust', 'list', name, '--json']);
    if (list.status !== 0) {
      console.error(`${name}: npm trust list failed; skipped.`);
      failed.push(name);
      continue;
    }
    const links = releaseLinks(parseTrustList(list.stdout));
    if (links.length > 0 && !renew) {
      console.log(`${name}: trusted.`);
      continue;
    }
    if (renew) {
      for (const link of links) {
        if (!link.id || !npm(['trust', 'revoke', name, `--id=${link.id}`])) {
          console.error(`${name}: could not revoke link ${link.id ?? '(no id)'}; skipped.`);
          failed.push(name);
          continue;
        }
      }
      if (failed.includes(name)) continue;
    }
    if (npm(trustArgs(name))) {
      created.push(name);
      console.log(`${name}: ${links.length > 0 ? 'link renewed' : 'link created'}.`);
    } else {
      console.error(`${name}: npm trust github failed.`);
      failed.push(name);
    }
    await sleep(2_000);
  }
}

console.log(`
Done.${created.length > 0 ? ` New or renewed links: ${created.join(', ')}.` : ''}${failed.length > 0 ? `\nFailed (fix and run again with these names): ${failed.join(' ')}` : ''}

- Merge the release pull request within 2 days of creating a link: a link no publish has used expires.
- A new package's first version can take up to an hour to show on npm. Don't re-run the release
  meanwhile. Once \`npm view <package> versions\` lists it, reject the placeholder:
${staged.length > 0 ? `\n${staged.map((s) => `npm stage reject ${s.id ?? '<id from npm stage list>'}   # ${s.name}`).join('\n')}` : '\n(nothing staged)'}`);
process.exit(failed.length > 0 ? 1 : 0);

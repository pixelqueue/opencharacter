import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Renders og/card.html into public/og.png (1200 × 630), the social card every page links. Needs a
// Chromium: set CHROME to its path, or install Playwright's headless shell. Run it after changing
// the card or the icon; the PNG is committed, so builds don't need a browser.

const site = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const mono =
  require.resolve('@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2');
const chrome = process.env.CHROME;
if (!chrome) throw new Error('Set CHROME to a Chromium or Chrome headless shell binary.');

const card = `${site}og/card.html`;
const page = `${site}og/.card.html`;
writeFileSync(page, readFileSync(card, 'utf8').replace('MONO_FONT', `file://${mono}`));
try {
  execFileSync(chrome, [
    '--headless',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--window-size=1200,630',
    '--virtual-time-budget=3000',
    `--screenshot=${site}public/og.png`,
    `file://${page}`,
  ]);
} finally {
  rmSync(page, { force: true });
}
console.log('wrote public/og.png');

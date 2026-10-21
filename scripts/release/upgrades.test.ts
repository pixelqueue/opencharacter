import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  type CharacterDoc,
  computeSheet,
  loadRuleset,
  type PackRelease,
  upgrade,
} from '../../packages/engine/src/index.ts';
import { releaseAt, releaseFromSource } from './index.ts';

// Each published pack's upgrade scripts, run on saved data of the old shape: a fixture names a
// script by its `from` and `to`. The old side is the release published at `from` (its git tag);
// the new side is the release published at `to` once it is tagged, else the pack as built here
// at version `to` (a pending changeset's bump). The test needs the tags, so it is skipped in a
// clone without them (CI's build job has them).

const root = fileURLToPath(new URL('../..', import.meta.url));
const fixtures = fileURLToPath(new URL('./upgrade-fixtures', import.meta.url));

interface Fixture {
  pack: string;
  from: string;
  to: string;
  /** JSON Pointers into the upgraded character: the value there, or nothing. */
  expect: { at: string; value?: unknown; absent?: boolean }[];
  /** Field values of the upgraded character's sheet. */
  values?: Record<string, unknown>;
  /** Choices pending after the upgrade that weren't before (a requireChoice's). */
  pending?: unknown[];
  /** The saved character, without `packs`: it pins the pack at `from`. */
  character: Omit<CharacterDoc, 'packs'>;
}

const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const tagged = (pack: string, version: string) =>
  git('tag', '--list', `@opencharacter/${pack}@${version}`).trim() !== '';

function packDir(id: string): string {
  for (const manifest of git('ls-files', 'packs/*/*/pack.yaml').split('\n').filter(Boolean)) {
    if ((parse(readFileSync(join(root, manifest), 'utf8')) as { id: string }).id === id)
      return join(root, dirname(manifest));
  }
  throw new Error(`no pack ${id}`);
}

/** The release at `to`: published, else as built here, which must not be past it yet. */
function releaseTo(pack: string, dir: string, to: string): PackRelease {
  if (tagged(pack, to)) return releaseAt(root, `@opencharacter/${pack}@${to}`, dir);
  const built = releaseFromSource(root, dir);
  if (semver.gt(built.manifest.version, to))
    throw new Error(`${pack} ${to} is not tagged, and the pack is at ${built.manifest.version}`);
  return { ...built, manifest: { ...built.manifest, version: to } };
}

function at(doc: unknown, pointer: string): { found: boolean; value?: unknown } {
  let node = doc;
  for (const raw of pointer.split('/').slice(1)) {
    const key = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, key))
      return { found: false };
    node = (node as Record<string, unknown>)[key];
  }
  return { found: true, value: node };
}

const loaded = (packs: PackRelease[]) => {
  const result = loadRuleset(packs);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.ruleset;
};

const cases = readdirSync(fixtures)
  .filter((f) => f.endsWith('.yaml'))
  .map((file) => ({ file, fixture: parse(readFileSync(join(fixtures, file), 'utf8')) as Fixture }));

describe('upgrade scripts on old saved data', () => {
  for (const { file, fixture } of cases) {
    const { pack, from, to } = fixture;
    it.skipIf(!tagged(pack, from))(
      file,
      () => {
        const dir = packDir(pack);
        expect(existsSync(join(dir, 'upgrades', `${from}-to-${to}.yaml`))).toBe(true);
        const old = loaded([releaseAt(root, `@opencharacter/${pack}@${from}`, dir)]);
        const next = loaded([releaseTo(pack, dir, to)]);
        const character = {
          ...fixture.character,
          packs: [{ id: pack, version: from }],
        } as CharacterDoc;

        const before = computeSheet(old, character);
        expect(before.errors ?? []).toEqual([]);
        const result = upgrade(old, next, character);
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        const { character: upgraded, report, pending } = result;

        expect(upgraded.packs).toEqual([{ id: pack, version: to }]);
        expect(report.steps.some((s) => s.from === from && s.to === to)).toBe(true);
        expect(report.errors).toEqual([]);
        for (const { at: pointer, value, absent } of fixture.expect) {
          const found = at(upgraded, pointer);
          if (absent) expect(found, pointer).toEqual({ found: false });
          else expect(found, pointer).toEqual({ found: true, value });
        }
        const sheet = computeSheet(next, upgraded);
        expect(sheet.errors ?? []).toEqual([]);
        for (const [field, value] of Object.entries(fixture.values ?? {}))
          expect(sheet.values[field]?.value, field).toEqual(value);
        const was = new Set(before.pending.map((p) => JSON.stringify(p.path)));
        expect(pending.filter((p) => !was.has(JSON.stringify(p.path))).map((p) => p.path)).toEqual(
          fixture.pending ?? [],
        );
      },
      120_000,
    );
  }
});

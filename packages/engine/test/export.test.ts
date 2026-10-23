import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { paths } from '@opencharacter/spec/node';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  computeSheet,
  createExport,
  loadRuleset,
  readExport,
  releaseIntegrity,
} from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';
import { canonicalJson, sha256 } from '../src/core/export.ts';
import { readPack } from './packs.ts';

const root = resolve(paths.root, '..', '..');
const read = (file: string) =>
  parse(readFileSync(join(root, 'examples', 'characters', file), 'utf8')) as CharacterDoc;

const pack = (id: string, version: string, extra: object = {}): PackRelease =>
  ({
    manifest: {
      id,
      version,
      specVersion: '0.1.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: {},
    content: [],
    ...extra,
  }) as PackRelease;

const character = (id: string, pins: [string, string][]): CharacterDoc =>
  ({
    specVersion: '0.2.0',
    id,
    packs: pins.map(([p, version]) => ({ id: p, version })),
  }) as CharacterDoc;

describe('release integrity', () => {
  it('hashes as SHA-256 does', () => {
    for (const length of [0, 1, 55, 56, 63, 64, 65, 1000]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 31 + 7) % 256);
      expect(Buffer.from(sha256(bytes)).toString('hex')).toBe(
        createHash('sha256').update(bytes).digest('hex'),
      );
    }
  });

  it('writes canonical JSON (RFC 8785): sorted keys, no whitespace', () => {
    expect(canonicalJson({ b: [1, { d: 'é', c: null }], a: true, u: undefined })).toBe(
      '{"a":true,"b":[1,{"c":null,"d":"é"}]}',
    );
  });

  it('is the base64 SHA-256 of the canonical JSON, whatever the key order', () => {
    const a = pack('test-a', '1.0.0');
    const reordered = { content: [], rules: {}, manifest: { ...a.manifest } } as PackRelease;
    const expected = `sha256-${createHash('sha256').update(canonicalJson(a)).digest('base64')}`;
    expect(releaseIntegrity(a)).toBe(expected);
    expect(releaseIntegrity(reordered)).toBe(expected);
    expect(releaseIntegrity(pack('test-a', '1.0.1'))).not.toBe(expected);
  });
});

describe('createExport', () => {
  const a = pack('test-a', '1.0.0');
  const b = pack('test-b', '2.0.0');

  it('lists every pinned pack version once, with its integrity', () => {
    const result = createExport(
      [
        character('one', [
          ['test-a', '1.0.0'],
          ['test-b', '2.0.0'],
        ]),
        character('two', [['test-a', '1.0.0']]),
      ],
      [a, b],
      { url: (r) => `https://example.com/${r.manifest.id}.json` },
    );
    expect(result.ok && result.export.packs).toEqual([
      {
        id: 'test-a',
        version: '1.0.0',
        url: 'https://example.com/test-a.json',
        integrity: releaseIntegrity(a),
      },
      {
        id: 'test-b',
        version: '2.0.0',
        url: 'https://example.com/test-b.json',
        integrity: releaseIntegrity(b),
      },
    ]);
  });

  it('embeds the releases it is told to (a bundle)', () => {
    const result = createExport(
      [
        character('one', [
          ['test-a', '1.0.0'],
          ['test-b', '2.0.0'],
        ]),
      ],
      [a, b],
      { embed: (r) => r.manifest.id === 'test-b' },
    );
    expect(result.ok && result.export.packs).toEqual([
      { id: 'test-a', version: '1.0.0', integrity: releaseIntegrity(a) },
      { release: b, integrity: releaseIntegrity(b) },
    ]);
  });

  it('fails for a pinned version it was not given', () => {
    const result = createExport([character('one', [['test-a', '1.0.1']])], [a]);
    expect(!result.ok && result.errors).toEqual([
      {
        code: 'unknown-id',
        data: { id: 'test-a', pack: 'test-a', version: '1.0.1' },
        path: '/characters/0/packs/0',
      },
    ]);
  });
});

describe('readExport', () => {
  const a = pack('test-a', '1.0.0');
  const other = pack('test-a', '1.0.0', { content: [{ id: 'x', type: 'y' }] });

  it("uses the app's copy when it matches, else the embedded release", () => {
    const result = readExport(
      {
        specVersion: '0.2.0',
        characters: [character('one', [['test-a', '1.0.0']])],
        packs: [{ release: a as never, integrity: releaseIntegrity(a) }],
      },
      [other],
    );
    expect(result).toEqual({ releases: [a], missing: [] });
    const own = readExport(
      {
        specVersion: '0.2.0',
        characters: [character('one', [['test-a', '1.0.0']])],
        packs: [{ release: a as never }],
      },
      [other],
    );
    expect(own.releases).toEqual([other]);
  });

  it('lists a reference with no matching copy as missing', () => {
    const ref = { id: 'test-a', version: '1.0.0', integrity: releaseIntegrity(a) };
    const file = {
      specVersion: '0.2.0',
      characters: [character('one', [['test-a', '1.0.0']])],
      packs: [ref],
    };
    expect(readExport(file, [other])).toEqual({ releases: [], missing: [ref] });
    expect(readExport(file, [a])).toEqual({ releases: [a], missing: [] });
  });

  it('round-trips characters and their packs', () => {
    const mb = readPack(join(root, 'packs', 'mork-borg', 'core'));
    const grub = read('mork-borg-grub.yaml');
    const hound = read('mork-borg-grub-hound.yaml');
    const created = createExport([grub, hound], [mb], { embed: true });
    if (!created.ok) throw new Error(JSON.stringify(created.errors));
    const file = JSON.parse(JSON.stringify(created.export));
    const { releases, missing } = readExport(file, []);
    expect(missing).toEqual([]);
    const loaded = loadRuleset(releases);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    expect(computeSheet(loaded.ruleset, file.characters[0]).errors).toEqual([]);
  });
});

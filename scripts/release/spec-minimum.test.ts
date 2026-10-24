import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { BuiltPack } from '../build/index.ts';
import { releaseCheck } from './index.ts';
import { specNeed, specRelease, syncPackSpecVersions } from './spec-minimum.ts';

// Toy specs: 0.2.0 adds the rules key `extra`, 0.3.0 the function `newFn`.
const schema = (version: string, keys: string[]) => ({
  $id: `https://example.org/schemas/${version}/pack-release.schema.json`,
  type: 'object',
  properties: {
    rules: {
      type: 'object',
      properties: Object.fromEntries(keys.map((k) => [k, {}])),
      additionalProperties: false,
    },
  },
});
const specs = [
  specRelease('0.1.0', [schema('0.1', ['fields'])], ['min']),
  specRelease('0.2.0', [schema('0.2', ['fields', 'extra'])], ['min']),
  specRelease('0.3.0', [schema('0.3', ['fields', 'extra'])], ['min', 'newFn']),
];

const dir = mkdtempSync(join(tmpdir(), 'ocf-spec-min-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function pack(specVersion: string, rules: object, fn = 'min'): BuiltPack {
  writeFileSync(join(dir, 'pack.yaml'), `id: demo\nversion: 0.1.0\nspecVersion: ${specVersion}\n`);
  return {
    id: 'demo',
    dir,
    release: {
      manifest: { id: 'demo', version: '0.1.0', specVersion },
      rules,
      content: [],
      formulas: { 'x()': { text: 'x()', tree: { type: 'call', fn, args: [] } } },
    },
    i18n: {},
    defaultLanguage: 'en',
  } as unknown as BuiltPack;
}

describe('the spec version a pack needs', () => {
  it('is enough when the declared spec has every key and function the pack uses', () => {
    expect(specNeed(pack('0.1.0', { fields: {} }), specs, '0.4.0')).toBeUndefined();
    expect(specNeed(pack('0.2.0', { extra: 1 }), specs, '0.4.0')).toBeUndefined();
  });

  it('is the lowest published spec the release is valid under', () => {
    expect(specNeed(pack('0.1.0', { extra: 1 }), specs, '0.4.0')).toEqual({
      version: '0.2.0',
      problems: ['/rules must NOT have additional properties: extra'],
    });
    expect(specNeed(pack('0.1.0', {}, 'newFn'), specs, '0.4.0')?.version).toBe('0.3.0');
  });

  it("is the tree's spec when no published one is enough", () => {
    expect(specNeed(pack('0.2.0', { later: 1 }), specs, '0.4.0')?.version).toBe('0.4.0');
    expect(specNeed(pack('0.4.0', { later: 1 }), specs, '0.4.0')).toBeUndefined();
  });

  it('release:check refuses a too-low specVersion, or waits for the version step', () => {
    const p = pack('0.1.0', { extra: 1 }, 'newFn');
    const check = (pending: Map<string, string>, version = '0.3.0') =>
      releaseCheck([p], () => ({}), undefined, pending, { releases: specs, version })
        .filter((f) => f.code.startsWith('spec-'))
        .map((f) => `${f.level} ${f.code}`);
    expect(check(new Map())).toEqual(['error spec-version-too-low']);
    const next = new Map([['spec', '0.4.0']]);
    expect(check(next, '0.3.0')).toEqual(['error spec-version-too-low']);
    expect(check(new Map([...next, ['demo', '0.2.0']]), '0.3.0')).toEqual([
      'error spec-version-too-low',
    ]);
    const later = pack('0.3.0', { later: 1 });
    const pendingOnly = (pending: Map<string, string>) =>
      releaseCheck([later], () => ({}), undefined, pending, { releases: specs, version: '0.3.0' })
        .filter((f) => f.code.startsWith('spec-'))
        .map((f) => `${f.level} ${f.code}`);
    expect(pendingOnly(next)).toEqual(['error spec-version-too-low']);
    expect(pendingOnly(new Map([...next, ['demo', '0.2.0']]))).toEqual([
      'info spec-version-pending',
    ]);
  });

  it('the version step raises pack.yaml to the spec it needs', () => {
    const p = pack('0.2.0', { later: 1 });
    expect(syncPackSpecVersions([p], specs, '0.4.0')).toEqual([
      { id: 'demo', from: '0.2.0', to: '0.4.0' },
    ]);
    expect(readFileSync(join(dir, 'pack.yaml'), 'utf8')).toContain('specVersion: 0.4.0\n');
    expect(syncPackSpecVersions([pack('0.2.0', { extra: 1 })], specs, '0.4.0')).toEqual([]);
  });
});

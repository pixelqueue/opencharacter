import { describe, expect, it } from 'vitest';
import { loadRuleset } from '../src/index.ts';
import { evaluateTags } from '../src/core/ruleset.ts';

function load(tags: unknown[]) {
  return loadRuleset([
    {
      manifest: {
        id: 'test-pack',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: {
        tags: ['roll', 'fire'],
        actions: [{ id: 'go', steps: [{ id: 'roll', kind: 'roll', tags, parts: [{ value: 1 }] }] }],
      },
      content: [],
    } as never,
  ]);
}

const value = (data: unknown) =>
  Array.isArray(data)
    ? { kind: 'list', value: data.map((v) => ({ kind: typeof v, value: v })) }
    : { kind: typeof data, value: data };

describe('computed tags', () => {
  it('type-check a string or a list of strings', () => {
    expect(load([{ formula: "'fire'" }]).ok).toBe(true);
    expect(load([{ formula: "['roll', 'fire']" }]).ok).toBe(true);
    expect(load([{ formula: '[1, 2]' }]).ok).toBe(false);
  });

  it('spread lists, drop repeats and reject undeclared tags', () => {
    const loaded = load([]);
    if (!loaded.ok) throw new Error('did not load');
    const values: Record<string, unknown> = { a: ['roll', 'fire'], b: 'roll', c: [], d: ['ice'] };
    const tags = (list: (string | { formula: string })[]) =>
      evaluateTags(loaded.ruleset, list, (formula) => value(values[formula as string]));
    expect(tags(['roll', { formula: 'a' }, { formula: 'b' }, { formula: 'c' }])).toEqual({
      ok: true,
      tags: ['roll', 'fire'],
    });
    expect(tags([{ formula: 'd' }])).toMatchObject({ ok: false, code: 'unknown-tag' });
  });
});

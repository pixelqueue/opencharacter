import { describe, expect, it } from 'vitest';
import { loadRuleset, type PackRelease } from '../src/index.ts';

describe('a pack release missing a part', () => {
  it('is invalid-shape on the prechecked path too, before anything reads its manifest', () => {
    const pack = { rules: {}, content: [], formulas: {} } as unknown as PackRelease;
    const loaded = loadRuleset([pack], { prechecked: new Set([pack]) });
    expect(loaded.ok).toBe(false);
    if (!loaded.ok)
      expect(loaded.errors.map((e) => [e.code, e.path])).toEqual([
        ['invalid-shape', '/packs/0/manifest'],
      ]);
  });
});

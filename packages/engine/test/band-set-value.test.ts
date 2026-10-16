import { describe, expect, it } from 'vitest';
import { loadRuleset } from '../src/index.ts';

function load(resultBands: Record<string, unknown>) {
  return loadRuleset([
    {
      manifest: {
        id: 'test-pack',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: { resultBands },
      content: [],
    } as never,
  ]);
}

describe('a band set value', () => {
  it('types roll.value as the value formula', () => {
    const loaded = load({
      rank: {
        value: 'roll.total >= 4 ? 1 : 0',
        bands: [
          { id: 'hit', when: 'size(roll.value) > 0' },
          { id: 'miss', when: true },
        ],
      },
    });
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.errors[0]).toMatchObject({ code: 'formula-error' });
  });

  it('loads a set whose bands compare the value', () => {
    const loaded = load({
      rank: {
        value: 'roll.total >= 4 ? 1 : 0',
        bands: [
          { id: 'hit', when: 'roll.value == 1' },
          { id: 'miss', when: true },
        ],
      },
    });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.ruleset.rules.bands['test-pack:rank']?.value).toBe('roll.total >= 4 ? 1 : 0');
  });
});

import { describe, expect, it } from 'vitest';
import { loadRuleset } from '../src/index.ts';

function load(rolls: unknown[]) {
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
        tags: ['stat'],
        fields: { strength: { type: 'integer', input: true, default: 30, tags: ['stat'] } },
        actions: [
          {
            id: 'check',
            params: {
              stat: { type: 'id', of: 'field', where: "'stat' in item.tags" },
              mode: { type: 'enum', values: ['plain', 'hard'], optional: true },
            },
            steps: [{ id: 'roll', kind: 'roll', parts: [{ id: 'd', dice: '1d100' }] }],
          },
        ],
        display: { fields: { strength: { rolls, with: [{ field: 'strength', as: 'detail' }] } } },
      },
      content: [],
    } as never,
  ]);
}

describe('field rolls', () => {
  it('qualifies the action and a field parameter, keeping other values', () => {
    const loaded = load([{ action: 'check', params: { stat: 'strength', mode: 'hard' } }]);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    expect(loaded.ruleset.rules.display.fields['test-pack:strength']?.rolls).toEqual([
      { action: 'test-pack:check', params: { stat: 'test-pack:strength', mode: 'hard' } },
    ]);
  });

  // A companion's field is qualified too (its self-reference is the validator's).
  it('qualifies a companion field', () => {
    const loaded = load([{ action: 'check' }]);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    expect(loaded.ruleset.rules.display.fields['test-pack:strength']?.with).toEqual([
      { field: 'test-pack:strength', as: 'detail' },
    ]);
  });

  it('refuses an unknown action or field', () => {
    for (const roll of [{ action: 'nope' }, { action: 'check', params: { stat: 'nope' } }]) {
      const loaded = load([roll]);
      expect(loaded.ok).toBe(false);
      if (!loaded.ok) expect(loaded.errors[0]?.code).toBe('unknown-reference');
    }
  });
});

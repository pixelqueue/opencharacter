import { describe, expect, it } from 'vitest';
import { applyChanges, diceFrom, loadRuleset, startAction } from '../src/index.ts';

const members = { under: ['damage'], tags: ['nonmagical'], except: ['damage.weapon'] };

function load(extra: Record<string, unknown> = {}) {
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
        tags: ['damage.fire', 'damage.cold', 'damage.weapon.silver', 'nonmagical', 'other'],
        fields: {
          resists: { type: 'set', of: 'tag', input: true, default: [], members, ...extra },
        },
        actions: [
          {
            id: 'resist',
            params: { kind: { type: 'id', of: 'tag', members } },
            steps: [{ id: 'roll', kind: 'roll', parts: [{ id: 'd', dice: '1d6' }] }],
          },
        ],
      },
      content: [],
    } as never,
  ]);
}

function ruleset() {
  const loaded = load();
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  return loaded.ruleset;
}

const character = { specVersion: '0.1.0', id: 'c', packs: [{ id: 'test-pack', version: '1.0.0' }] };

const set = (value: string[]) =>
  applyChanges(ruleset(), character as never, [{ type: 'set', field: 'test-pack:resists', value }]);

const run = (kind: string) =>
  startAction(
    ruleset(),
    character as never,
    { action: { id: 'test-pack:resist' }, params: { kind } },
    diceFrom([3]),
  );

describe('tag members', () => {
  // A parent and an excepted tag are left out; the tags below an excepted one are not.
  it('lists the declared tags a field takes', () => {
    expect(ruleset().fields['test-pack:resists']?.tagOptions).toEqual([
      'damage.cold',
      'damage.fire',
      'damage.weapon.silver',
      'nonmagical',
    ]);
    expect(ruleset().rules.actions['test-pack:resist']?.params?.kind?.tagOptions).toHaveLength(4);
  });

  it('refuses an undeclared tag in members', () => {
    const loaded = load({ members: { under: ['acid'] } });
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.errors[0]?.code).toBe('unknown-tag');
  });

  it('rejects setting a tag outside members', () => {
    expect(set(['damage.fire', 'nonmagical']).ok).toBe(true);
    for (const bad of ['damage', 'damage.weapon', 'other']) {
      const result = set([bad]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0]?.code).toBe('invalid-option');
    }
  });

  it('rejects a tag parameter outside members', () => {
    expect('status' in run('damage.cold')).toBe(true);
    const bad = run('other');
    expect('status' in bad).toBe(false);
    if (!('status' in bad)) expect(bad.errors[0]?.code).toBe('invalid-option');
  });
});

import { describe, expect, it } from 'vitest';
import { applyChanges, computeSheet, loadRuleset, startAction, upgrade } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

function pack(version: string, content: unknown[]): PackRelease {
  return {
    manifest: {
      id: 'test-pack',
      version,
      specVersion: '0.1.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: {
      fields: {
        held: { type: 'integer', formula: 0 },
        known: { type: 'set', of: 'string' },
      },
      contentTypes: {
        feature: {},
        // A once-a-day power: its use is its own state.
        power: {
          state: { used: { type: 'boolean', default: false } },
          effects: [{ target: 'held', op: 'add', value: 'self.used ? 1 : 0' }],
          actions: [
            {
              id: 'use',
              steps: [
                {
                  id: 'mark',
                  kind: 'changes',
                  to: 'self',
                  changes: [{ type: 'setState', grant: 'self', key: 'used', value: true }],
                },
              ],
            },
          ],
        },
        school: {},
      },
    },
    content,
  } as unknown as PackRelease;
}

const content = [
  { id: 'powers.ward', type: 'power' },
  { id: 'powers.blink', type: 'power' },
  {
    id: 'schools.abjuration',
    type: 'school',
    choices: [
      {
        id: 'focus',
        from: { values: ['wards', 'seals'] },
        effects: [{ target: 'known', op: 'grant', value: { formula: 'pick.value' } }],
      },
    ],
    effects: [{ target: 'known', op: 'grant', value: { formula: "'abjuration'" } }],
  },
  {
    id: 'features.magic',
    type: 'feature',
    choices: [
      {
        id: 'school',
        from: { type: 'school' },
        effects: [{ target: 'known', op: 'grant', value: { formula: 'pick.id' } }],
      },
    ],
  },
  // Two grants of one power share its saved state; the second's preset nests a pick.
  {
    id: 'features.warden',
    type: 'feature',
    grants: [
      { item: 'powers.ward' },
      { item: 'powers.ward' },
      {
        item: 'features.magic',
        choices: {
          school: [{ option: 'schools.abjuration', choices: { focus: [{ option: 'seals' }] } }],
        },
      },
      { item: 'features.magic', choices: { school: [{ option: { formula: '1 / 0' } }] } },
    ],
  },
  // A feature that is no grant runs a grant's action: `grant: self` is unknown there.
  {
    id: 'features.plain',
    type: 'feature',
    actions: [
      {
        id: 'mark',
        steps: [
          {
            id: 'mark',
            kind: 'changes',
            to: 'self',
            changes: [{ type: 'setState', grant: 'self', key: 'used', value: true }],
          },
        ],
      },
    ],
  },
];

const loaded = loadRuleset([pack('1.0.0', content)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const character: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  features: [{ id: 'warden', item: 'test-pack:features.warden' }],
};

describe('grant storage', () => {
  it('presets nested picks, and leaves out a preset that fails with a formula-error', () => {
    const sheet = computeSheet(ruleset, character);
    expect(sheet.values['test-pack:known']?.value).toEqual([
      'abjuration',
      'seals',
      'test-pack:schools.abjuration',
    ]);
    const school = sheet.choices.filter((c) => c.id === 'school');
    expect(school.map((c) => [c.picks, c.preset])).toEqual([
      [['test-pack:schools.abjuration'], true],
      [[], true],
    ]);
    // A preset that gives nothing still answers its choice.
    expect(sheet.pending).toEqual([]);
    expect(sheet.errors.map((e) => e.code)).toEqual(['division-by-zero']);
  });

  it('runs an action of granted content, saving its state where the grant keeps it', () => {
    const result = startAction(ruleset, character, {
      action: { id: 'test-pack:powers.ward#use', entry: 'warden', source: 'test-pack:powers.ward' },
    });
    if (!('status' in result)) throw new Error(JSON.stringify(result.errors));
    const changes = (
      result as unknown as { proposedChanges: { change: never }[] }
    ).proposedChanges.map((p) => p.change);
    expect(changes).toEqual([
      {
        type: 'setState',
        entry: 'warden',
        grant: 'test-pack:powers.ward',
        key: 'used',
        value: true,
      },
    ]);
    const applied = applyChanges(ruleset, character, changes);
    if (!applied.ok) throw new Error(JSON.stringify(applied.errors));
    expect(applied.character.features?.[0]?.grants).toEqual({
      'test-pack:powers.ward': { state: { used: true } },
    });
    // Both grants of the ward read the one saved value.
    expect(computeSheet(ruleset, applied.character).values['test-pack:held']?.value).toBe(2);
  });

  it('rejects `grant: self` outside granted content', () => {
    const plain: CharacterDoc = {
      ...character,
      features: [{ id: 'plain', item: 'test-pack:features.plain' }],
    };
    const result = startAction(ruleset, plain, {
      action: { id: 'test-pack:features.plain#mark', entry: 'plain' },
    });
    expect('errors' in result && result.errors.map((e) => e.code)).toEqual(['unknown-reference']);
  });

  it('rejects unchoose on a preset choice', () => {
    const result = applyChanges(ruleset, character, [
      {
        type: 'unchoose',
        path: { entry: 'warden', choice: ['test-pack:features.magic/school'] },
        option: 'test-pack:schools.abjuration',
      },
    ]);
    expect(!result.ok && result.errors.map((e) => e.code)).toEqual(['preset-choice']);
  });

  it('upgrades move or drop the saved state of renamed or removed granted content', () => {
    const saved: CharacterDoc = {
      ...character,
      features: [
        {
          id: 'warden',
          item: 'test-pack:features.warden',
          grants: {
            'test-pack:powers.ward': { state: { used: true } },
            'test-pack:powers.blink': { state: { used: true } },
          },
        },
      ],
    };
    const renamed = content.map((c) =>
      c.id === 'powers.ward'
        ? { ...c, id: 'powers.shield' }
        : c.id === 'features.warden'
          ? {
              ...c,
              grants: (c.grants as { item: string }[]).map((g) =>
                g.item === 'powers.ward' ? { ...g, item: 'powers.shield' } : g,
              ),
            }
          : c,
    );
    const next = {
      ...pack(
        '2.0.0',
        renamed.filter((c) => c.id !== 'powers.blink'),
      ),
      upgrades: [
        {
          pack: 'test-pack',
          from: '1.0.0',
          to: '2.0.0',
          steps: [
            { op: 'renameContent', from: 'powers.ward', to: 'powers.shield' },
            { op: 'removeContent', id: 'powers.blink' },
          ],
        },
      ],
    } as unknown as PackRelease;
    const to = loadRuleset([next]);
    if (!to.ok) throw new Error(JSON.stringify(to.errors));
    const result = upgrade(ruleset, to.ruleset, saved);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.character.features?.[0]?.grants).toEqual({
      'test-pack:powers.shield': { state: { used: true } },
    });
  });
});

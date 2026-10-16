import { describe, expect, it } from 'vitest';
import {
  applyChanges,
  formula as f,
  loadRuleset,
  type PackRelease,
  startAction,
} from '../src/index.ts';

const manifest = {
  id: 'test-pack',
  version: '1.0.0',
  specVersion: '0.1.0',
  license: 'CC0-1.0',
  defaultLanguage: 'en',
};
const character = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
};

const release1 = (passed: string) =>
  ({
    manifest,
    rules: {
      actions: [
        {
          id: 'inner',
          participants: { target: {} },
          steps: [{ id: 'done', kind: 'outcome', data: { count: 'size(participants.target)' } }],
        },
        {
          id: 'outer',
          participants: { target: {} },
          steps: [
            { id: 'pass', kind: 'action', use: 'inner', participants: { target: passed } },
            { id: 'done', kind: 'outcome', data: { count: 'steps.pass.data.count' } },
          ],
        },
      ],
    },
    content: [],
  }) as PackRelease;

const term2 = (count?: number): f.DiceTerm => ({
  count: 4,
  sides: 6,
  sign: 1,
  modifiers: [
    { type: 'rerollOnce', compare: '<=', target: 3, ...(count === undefined ? {} : { count }) },
  ],
});

const release3 = (where: string) =>
  ({
    manifest,
    rules: {
      contentTypes: { condition: { fields: { grip: { type: 'integer' } } }, gear: {} },
      actions: [
        {
          id: 'end',
          params: { condition: { type: 'id', of: 'condition', where } },
          steps: [{ id: 'done', kind: 'outcome', data: { ended: 'params.condition' } }],
        },
      ],
    },
    content: [
      { id: 'conditions.charmed', type: 'condition', fields: { grip: 3 } },
      { id: 'gear.rope', type: 'gear' },
    ],
  }) as PackRelease;

const release4 = (template: string, equipped: string) =>
  ({
    manifest,
    rules: {
      contentTypes: { blade: { carried: true, equippable: true } },
      actions: [
        {
          id: 'whet',
          steps: [
            {
              id: 'go',
              kind: 'changes',
              changes: [
                { type: 'equip', entry: 'knife-1', equipped },
                { type: 'applyTemplate', entry: 'knife-1', template },
              ],
            },
          ],
        },
      ],
    },
    content: [
      { id: 'blades.knife', type: 'blade' },
      { id: 'keen', type: 'template', appliesTo: { type: 'blade' } },
    ],
  }) as PackRelease;

const release5 = (option: string) =>
  ({
    manifest,
    rules: {
      contentTypes: { spell: {}, charm: {} },
      actions: [
        {
          id: 'enchant',
          steps: [
            {
              id: 'add',
              kind: 'changes',
              changes: [
                {
                  type: 'addItem',
                  forEach: "['spells.light', 'spells.sleep']",
                  entry: {
                    item: "'charms.spellbound'",
                    choices: { spell: [{ option: { formula: option } }] },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    content: [
      { id: 'spells.light', type: 'spell' },
      { id: 'spells.sleep', type: 'spell' },
      {
        id: 'charms.spellbound',
        type: 'charm',
        choices: [{ id: 'spell', from: { type: 'spell' } }],
      },
    ],
  }) as PackRelease;

const release6 = (amount: string, by = '-params.hit') =>
  ({
    manifest,
    rules: {
      tags: ['damage'],
      fields: { hp: { type: 'integer', input: true, default: 10, min: 0 } },
      contentTypes: { wound: { state: { amount: { type: 'integer', default: 0 } } } },
      actions: [
        {
          id: 'strike',
          params: { hit: { type: 'integer' } },
          steps: [
            {
              id: 'deal',
              kind: 'changes',
              changes: [
                { type: 'adjust', field: 'hp', by, tags: ['damage'] },
                { type: 'applyEffect', source: "'wounds.cut'", state: { amount } },
              ],
            },
          ],
        },
      ],
    },
    content: [{ id: 'wounds.cut', type: 'wound' }],
  }) as PackRelease;

describe('participants passed on as views', () => {
  const release = release1;
  const run = (passed: string) => {
    const loaded = loadRuleset([release(passed)]);
    if (!loaded.ok) return loaded.errors.map((e) => e.code);
    return startAction(loaded.ruleset, character, {
      action: { id: 'test-pack:outer' },
      participants: { target: [{ id: 'a' }, { id: 'b' }] },
    });
  };

  it('passes views and IDs alike', () => {
    for (const passed of [
      'participants.target',
      '[participants.target[1], participants.target[0]]',
      "['a', 'b']",
    ])
      expect(run(passed)).toMatchObject({ status: 'finished', outcome: { data: { count: 2 } } });
  });

  it('rejects a list of anything else when the pack loads', () => {
    expect(run('[1, 2]')).toEqual(['formula-error']);
  });
});

describe('reroll with a count', () => {
  const term = term2;
  const roll = (count: number | undefined, faces: number[]) => {
    const result = f.roll({ terms: [term(count)], flat: 0 }, f.facesFrom(faces));
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };

  it('rerolls the lowest matching dice first, earliest among equal faces', () => {
    const rolled = roll(2, [3, 1, 2, 1, 6, 5]);
    expect(rolled.total).toBe(16);
    expect(rolled.terms[0]?.faces.map((face) => face.rerolled ?? false)).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
    ]);
  });

  it('rerolls every matching die without a count, and none with a count of 0', () => {
    expect(roll(undefined, [3, 1, 2, 4, 6, 6, 6]).total).toBe(22);
    expect(roll(0, [3, 1, 2, 4]).total).toBe(10);
  });

  it('prints a reroll with a count as the plain reroll', () => {
    const parsed = f.parse('4d6ro<=3');
    if (!parsed.ok) throw new Error('parse');
    const tree = parsed.value as { modifiers: f.DiceModifier[] };
    tree.modifiers[0] = { ...(tree.modifiers[0] as f.DiceModifier), count: 2 };
    expect(f.print(parsed.value)).toBe('4d6ro<=3');
  });
});

describe('where on a content parameter', () => {
  const release = release3;
  const run = (where: string, condition: string) => {
    const loaded = loadRuleset([release(where)]);
    if (!loaded.ok) return loaded.errors.map((e) => e.code);
    return startAction(loaded.ruleset, character, {
      action: { id: 'test-pack:end' },
      params: { condition },
    });
  };

  it('takes a qualified or local ID of a matching item', () => {
    for (const id of ['conditions.charmed', 'test-pack:conditions.charmed'])
      expect(run('item.grip <= 3', id)).toMatchObject({
        status: 'finished',
        outcome: { data: { ended: 'test-pack:conditions.charmed' } },
      });
  });

  it('refuses an item of another type or an unknown ID', () => {
    for (const id of ['gear.rope', 'conditions.nope'])
      expect(run('true', id)).toMatchObject({ errors: [{ code: 'invalid-option' }] });
  });

  it('type-checks `where` against the content type', () => {
    expect(run('item.gripp <= 3', 'conditions.charmed')).toEqual(['formula-error']);
  });
});

describe('proposed equip and templates', () => {
  const release = release4;
  const run = (template: string, equipped = 'true') => {
    const loaded = loadRuleset([release(template, equipped)]);
    if (!loaded.ok) return loaded.errors.map((e) => e.code);
    return startAction(
      loaded.ruleset,
      { ...character, inventory: [{ id: 'knife-1', item: 'test-pack:blades.knife' }] },
      { action: { id: 'test-pack:whet' } },
    );
  };

  it('qualifies the template and evaluates equipped', () => {
    expect(run("'keen'")).toMatchObject({
      status: 'finished',
      proposedChanges: [
        { change: { type: 'equip', entry: 'knife-1', equipped: true } },
        { change: { type: 'applyTemplate', entry: 'knife-1', template: 'test-pack:keen' } },
      ],
    });
  });

  it('refuses content that is not a template', () => {
    expect(run("'blades.knife'")).toMatchObject({ errors: [{ code: 'unknown-reference' }] });
  });

  it('type-checks equipped and template', () => {
    expect(run('1')).toEqual(['formula-error']);
    expect(run("'keen'", '1')).toEqual(['formula-error']);
  });
});

describe('computed picks on a proposed addItem', () => {
  const release = release5;

  it('gives each copy its pick, which applyChanges accepts', () => {
    const loaded = loadRuleset([release("'test-pack:' + x")]);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const result = startAction(loaded.ruleset, character, { action: { id: 'test-pack:enchant' } });
    if (!('status' in result) || result.status !== 'finished') throw new Error('not finished');
    const applied = applyChanges(
      loaded.ruleset,
      character,
      result.proposedChanges.map((p) => p.change),
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.character.features?.map((e) => e.choices)).toEqual([
      { spell: [{ option: 'test-pack:spells.light' }] },
      { spell: [{ option: 'test-pack:spells.sleep' }] },
    ]);
  });

  it('type-checks the formula', () => {
    expect(loadRuleset([release('true')]).ok).toBe(false);
  });
});

describe('batch in passed-on formulas', () => {
  const release = release6;
  const formula = 'params.hit - sumList(batch.adjustments, x.by, x.reason == "requested") * 0';

  it('passes a state value reading batch on as { formula }, action roots substituted', () => {
    const loaded = loadRuleset([release(formula)]);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const result = startAction(loaded.ruleset, character, {
      action: { id: 'test-pack:strike' },
      params: { hit: 3 },
    });
    if (!('status' in result) || result.status !== 'finished') throw new Error('not finished');
    const effect = result.proposedChanges[1]?.change as unknown as { state: { amount: unknown } };
    expect(effect.state.amount).toEqual({
      formula: "3 - sumList(batch.adjustments, x.by, x.reason == 'requested') * 0",
    });
    const applied = applyChanges(
      loaded.ruleset,
      character,
      result.proposedChanges.map((p) => p.change),
    );
    expect(applied.ok && applied.character.applied?.[0]?.state).toEqual({ amount: 3 });
  });

  it('rejects batch where nothing passes it on', () => {
    expect(loadRuleset([release('1', 'size(batch.adjustments)')]).ok).toBe(false);
  });
});

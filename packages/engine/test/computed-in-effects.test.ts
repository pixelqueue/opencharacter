import { describe, expect, it } from 'vitest';
import { diceFrom, loadRuleset, startAction } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

/** A feature computing `bonus` (the tier), with these effects; `strike` rolls and hits. */
const pack = (effects: unknown[]): PackRelease =>
  ({
    manifest: {
      id: 'p',
      version: '1.0.0',
      specVersion: '0.3.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: {
      tags: ['attack'],
      fields: {
        tier: { type: 'integer', input: true, default: 2 },
        n: { type: 'integer', input: true, default: 0 },
      },
      contentTypes: { feature: { computed: { bonus: { type: 'integer', formula: 'tier' } } } },
      actions: [
        {
          id: 'strike',
          tags: ['attack'],
          params: { spend: { type: 'integer', default: 0 } },
          steps: [
            { id: 'roll', kind: 'roll', tags: ['attack'], parts: [{ dice: '1d20' }] },
            { id: 'hit', kind: 'changes', tags: ['attack'] },
            { id: 'done', kind: 'outcome', data: { total: 'steps.roll.total' } },
          ],
        },
      ],
    },
    content: [{ id: 'features.f', type: 'feature', effects }],
  }) as unknown as PackRelease;

const character: CharacterDoc = {
  specVersion: '0.3.0',
  id: 'hero',
  packs: [{ id: 'p', version: '1.0.0' }],
  features: [{ id: 'f', item: 'p:features.f' }],
};

const load = (effects: unknown[]) => loadRuleset([pack(effects)]);

const run = (effects: unknown[], params: Record<string, unknown> = {}) => {
  const loaded = load(effects);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  return startAction(
    loaded.ruleset,
    character,
    { action: { id: 'p:strike' }, params },
    diceFrom([10]),
  );
};

const causes = (effects: unknown[]) => {
  const loaded = load(effects);
  return loaded.ok ? [] : loaded.errors.map((e) => (e.data as { cause?: string }).cause);
};

describe("effects reading their content's computed values", () => {
  it('roll effects add them', () => {
    const result = run([{ target: { rolls: ['attack'] }, op: 'add', value: 'self.bonus' }]);
    expect(result).toMatchObject({ outcome: { data: { total: 12 } } });
  });

  it('changes effects propose with them, and their when reads them', () => {
    const result = run([
      {
        target: { steps: ['attack'] },
        op: 'changes',
        when: 'self.bonus > 1',
        value: { changes: [{ type: 'adjust', field: 'n', by: 'self.bonus' }] },
      },
    ]);
    expect(result).toMatchObject({
      proposedChanges: [{ change: { type: 'adjust', field: 'p:n', by: 2 } }],
    });
  });

  it('params effects bound with them', () => {
    const effects = [
      { target: { actions: ['attack'] }, op: 'params', value: { spend: { max: 'self.bonus' } } },
    ];
    expect(run(effects, { spend: 2 })).toMatchObject({ status: 'finished' });
    expect(run(effects, { spend: 3 })).toMatchObject({ errors: [{ code: 'out-of-range' }] });
  });

  it("granted content's effects read its own, as its actions do", () => {
    const base = pack([]);
    const release = {
      ...base,
      rules: { ...base.rules, contentTypes: { ...base.rules.contentTypes, class: {} } },
      content: [
        { id: 'classes.c', type: 'class', grants: [{ item: 'features.g' }] },
        {
          id: 'features.g',
          type: 'feature',
          computed: { extra: { type: 'integer', formula: 'self.bonus + 1' } },
          effects: [{ target: { rolls: ['attack'] }, op: 'add', value: 'self.extra' }],
        },
      ],
    } as unknown as PackRelease;
    const loaded = loadRuleset([release]);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const result = startAction(
      loaded.ruleset,
      { ...character, features: [{ id: 'c', item: 'p:classes.c' }] },
      { action: { id: 'p:strike' } },
      diceFrom([10]),
    );
    expect(result).toMatchObject({ outcome: { data: { total: 13 } } });
  });

  it('field effects, and applied ones, cannot: unknown-name at load', () => {
    expect(causes([{ target: 'n', op: 'add', value: 'self.bonus' }])).toEqual(['unknown-name']);
    expect(causes([{ target: 'n', op: 'add', value: '1', when: 'self.bonus > 0' }])).toEqual([
      'unknown-name',
    ]);
    expect(
      causes([{ target: { rolls: ['attack'] }, op: 'add', value: 'self.bonus', scope: 'applied' }]),
    ).toEqual(['unknown-name']);
  });
});

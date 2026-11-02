import { describe, expect, it } from 'vitest';
import { describeAction, loadRuleset, startAction, type PackRelease } from '../src/index.ts';

/** A pack whose `use-ability` (tagged `ability`) declares `surges`, with these features' effects. */
const pack = (effects: Record<string, unknown[]>, steps?: unknown[]): PackRelease =>
  ({
    manifest: {
      id: 'p',
      version: '1.0.0',
      specVersion: '0.3.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: {
      tags: ['ability', 'ability.magic', 'turn', 'aura', 'aura.fire'],
      fields: { n: { type: 'integer', input: true, default: 0 } },
      contentTypes: { feature: {} },
      actions: [
        {
          id: 'use-ability',
          tags: ['ability'],
          params: { surges: { type: 'integer', default: 0 } },
          steps: steps ?? [{ id: 'done', kind: 'outcome' }],
        },
        {
          id: 'start-turn',
          tags: ['turn'],
          steps: [{ id: 'cast', kind: 'action', use: 'use-ability' }],
        },
      ],
    },
    content: Object.entries(effects).map(([id, list]) => ({
      id: `features.${id}`,
      type: 'feature',
      effects: list,
    })),
  }) as unknown as PackRelease;

const adds = (tag: string, params: Record<string, unknown>) => ({
  target: { actions: [tag] },
  op: 'params',
  value: params,
});

const reasons = (release: PackRelease) => {
  const loaded = loadRuleset([release]);
  return loaded.ok
    ? []
    : loaded.errors.map((e) => [e.code, (e.data as { reason?: string }).reason]);
};

describe('params effects at load', () => {
  it('accepts optional and defaulted parameters, and one name added alike twice', () => {
    const boost = { type: 'boolean', default: false };
    expect(
      reasons(
        pack({
          a: [adds('ability', { boost, note: { type: 'string', optional: true } })],
          b: [adds('ability.magic', { boost })],
        }),
      ),
    ).toEqual([]);
  });

  it('reports a required parameter', () => {
    expect(reasons(pack({ a: [adds('ability', { boost: { type: 'boolean' } })] }))).toEqual([
      ['invalid-added-param', 'required'],
    ]);
  });

  it('reports a name an action its tags reach declares', () => {
    expect(
      reasons(pack({ a: [adds('ability', { surges: { type: 'integer', default: 1 } })] })),
    ).toEqual([['invalid-added-param', 'declared']]);
    // `turn` reaches only start-turn, which declares no `surges`.
    expect(
      reasons(pack({ a: [adds('turn', { surges: { type: 'integer', default: 1 } })] })),
    ).toEqual([]);
  });

  it('reports one name added with other declarations over tags that meet', () => {
    expect(
      reasons(
        pack({
          a: [adds('ability', { boost: { type: 'boolean', default: false } })],
          b: [adds('ability.magic', { boost: { type: 'integer', default: 0 } })],
        }),
      ),
    ).toEqual([['invalid-added-param', 'conflict']]);
    expect(
      reasons(
        pack({
          a: [adds('ability', { boost: { type: 'boolean', default: false } })],
          b: [adds('turn', { boost: { type: 'integer', default: 0 } })],
        }),
      ),
    ).toEqual([]);
  });

  it('reports a conflict over tags no action carries yet', () => {
    // No action carries `aura`: the targets still meet.
    expect(
      reasons(
        pack({
          a: [adds('aura.fire', { boost: { type: 'boolean', default: false } })],
          b: [adds('aura', { boost: { type: 'integer', default: 0 } })],
        }),
      ),
    ).toEqual([['invalid-added-param', 'conflict']]);
  });

  it("lets two items' from: self effects declare a name otherwise, not an item and a type", () => {
    const self = (values: string[]) => ({
      ...adds('ability', { element: { type: 'enum', values, optional: true } }),
      target: { actions: ['ability'], from: 'self' },
    });
    expect(reasons(pack({ a: [self(['fire', 'cold'])], b: [self(['acid'])] }))).toEqual([]);
    // One item's two effects can share a run.
    expect(reasons(pack({ a: [self(['fire', 'cold']), self(['acid'])] }))).toEqual([
      ['invalid-added-param', 'conflict'],
    ]);
    // Only one side self-scoped.
    expect(
      reasons(
        pack({
          a: [self(['fire', 'cold'])],
          b: [adds('ability', { element: { type: 'enum', values: ['acid'], optional: true } })],
        }),
      ),
    ).toEqual([['invalid-added-param', 'conflict']]);
  });
});

describe('params effects at run time', () => {
  it('reach only the run the app starts, not an action step', () => {
    // The feature's changes on the shared action's tagged step read the parameter it adds.
    const release = pack(
      {
        a: [
          adds('ability', { boost: { type: 'boolean', default: true } }),
          {
            target: { steps: ['ability'] },
            op: 'changes',
            when: 'has(params.boost)',
            value: { changes: [{ type: 'adjust', field: 'n', by: 1 }] },
          },
        ],
      },
      [{ id: 'hit', kind: 'changes', tags: ['ability'] }],
    );
    const loaded = loadRuleset([release]);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const character = {
      specVersion: '0.3.0',
      id: 'hero',
      packs: [{ id: 'p', version: '1.0.0' }],
      features: [{ id: 'a', item: 'p:features.a' }],
    };
    const changes = (id: string) => {
      const run = startAction(loaded.ruleset, character, { action: { id } });
      return 'proposedChanges' in run ? run.proposedChanges.length : -1;
    };
    expect(changes('p:use-ability')).toBe(1);
    expect(changes('p:start-turn')).toBe(0);
  });
});

describe('parameter bounds that read params', () => {
  // Healing Grace: one enhancement per point of the Spend.
  const release = pack({
    grace: [
      adds('ability', {
        stand: { type: 'boolean', default: false },
        recoveries: {
          type: 'integer',
          default: 0,
          min: 0,
          max: 'params.surges - (params.stand ? 1 : 0)',
        },
      }),
    ],
  });
  const own = {
    ...release,
    rules: {
      ...release.rules,
      actions: [
        {
          id: 'use-ability',
          tags: ['ability'],
          params: {
            surges: { type: 'integer', default: 0, max: 'params.cap' },
            cap: { type: 'integer', default: 3 },
          },
          steps: [{ id: 'done', kind: 'outcome' }],
        },
      ],
    },
  } as unknown as PackRelease;
  const character = {
    specVersion: '0.3.0',
    id: 'hero',
    packs: [{ id: 'p', version: '1.0.0' }],
    features: [{ id: 'grace', item: 'p:features.grace' }],
  };
  const run = (r: PackRelease, params: Record<string, unknown>) => {
    const loaded = loadRuleset([r]);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const result = startAction(loaded.ruleset, character, {
      action: { id: 'p:use-ability' },
      params,
    });
    return 'errors' in result && result.errors
      ? result.errors.map((e) => [e.code, (e.data as { max?: number }).max])
      : 'ok';
  };

  it('see every parameter, the app’s and the defaults, added ones included', () => {
    expect(run(release, { surges: 2, recoveries: 2 })).toBe('ok');
    expect(run(release, { surges: 2, recoveries: 2, stand: true })).toEqual([['out-of-range', 1]]);
    expect(run(release, { recoveries: 1 })).toEqual([['out-of-range', 0]]);
  });

  it('on an action’s own parameter, read a later one', () => {
    expect(run(own, { surges: 3 })).toBe('ok');
    expect(run(own, { surges: 3, cap: 2 })).toEqual([['out-of-range', 2]]);
  });

  it('are left out of describeAction', () => {
    const loaded = loadRuleset([release]);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const described = describeAction(loaded.ruleset, character, { id: 'p:use-ability' });
    if (!('action' in described)) throw new Error(JSON.stringify(described));
    expect(described.action.params.find((p) => p.name === 'recoveries')).toMatchObject({
      min: 0,
    });
    expect(described.action.params.find((p) => p.name === 'recoveries')).not.toHaveProperty('max');
  });
});

import { describe, expect, it } from 'vitest';
import { loadRuleset, startAction, type PackRelease } from '../src/index.ts';

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
      tags: ['ability', 'ability.magic', 'turn'],
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

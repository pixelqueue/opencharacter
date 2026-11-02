import { describe, expect, it } from 'vitest';
import { describeAction, loadRuleset, startAction, type PackRelease } from '../src/index.ts';

/**
 * A pack whose `strike` (tagged `attack`) takes `spend` and derives `cost` from it, adjusting `n`
 * by `cost`; a feature's effects may add more.
 */
const pack = (params: Record<string, unknown>, effects: unknown[] = []): PackRelease =>
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
      fields: { n: { type: 'integer', input: true, default: 0 } },
      contentTypes: { feature: {} },
      actions: [
        {
          id: 'strike',
          tags: ['attack'],
          params,
          participants: { target: { max: 2 } },
          steps: [
            {
              id: 'hit',
              kind: 'changes',
              tags: ['attack'],
              changes: [{ type: 'adjust', field: 'n', by: 'params.cost' }],
            },
          ],
        },
        {
          id: 'twice',
          steps: [{ id: 'again', kind: 'action', use: 'strike', params: { spend: 1, cost: 5 } }],
        },
      ],
    },
    content: [{ id: 'features.f', type: 'feature', effects }],
  }) as unknown as PackRelease;

const character = {
  specVersion: '0.3.0',
  id: 'hero',
  packs: [{ id: 'p', version: '1.0.0' }],
  features: [{ id: 'f', item: 'p:features.f' }],
};

const own = {
  spend: { type: 'integer', default: 0 },
  cost: { type: 'integer', formula: 'params.spend * 2' },
};

const load = (release: PackRelease) => {
  const loaded = loadRuleset([release]);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  return loaded.ruleset;
};

const run = (
  release: PackRelease,
  params: Record<string, unknown>,
  id = 'p:strike',
  participants: Record<string, { id: string; values: Record<string, unknown> }[]> = {},
) => {
  const result = startAction(load(release), character, { action: { id }, params, participants });
  if ('errors' in result && result.errors)
    return result.errors.map((e) => [e.code, (e.data as { param?: string }).param]);
  return 'proposedChanges' in result
    ? result.proposedChanges.map((c) => (c.change as { by?: number }).by)
    : result;
};

describe('derived parameters', () => {
  it('are worked out from the given ones, and steps read them', () => {
    expect(run(pack(own), { spend: 3 })).toEqual([6]);
    expect(run(pack(own), {})).toEqual([0]);
  });

  it('read the derived ones before them, and bounds see them', () => {
    const params = {
      ...own,
      total: { type: 'integer', formula: 'params.cost + 1', max: 5 },
      spend: { type: 'integer', default: 0, max: 'params.total' },
    };
    expect(run(pack(params), { spend: 2 })).toEqual([4]);
    // total 7: over its own max.
    expect(run(pack(params), { spend: 3 })).toEqual([['out-of-range', undefined]]);
  });

  it('are never given: invalid-param, from the app or an action step', () => {
    expect(run(pack(own), { spend: 1, cost: 9 })).toEqual([['invalid-param', 'cost']]);
    expect(run(pack(own), {}, 'p:twice')).toEqual([['invalid-param', 'cost']]);
  });

  it('give their declared type', () => {
    const params = { ...own, cost: { type: 'integer', formula: 'params.spend / 2' } };
    // A decimal formula for an integer parameter is caught at load.
    const loaded = loadRuleset([pack(params)]);
    expect(loaded.ok).toBe(false);
  });

  it('can read only those declared before them: a later one is unknown at load', () => {
    const loaded = loadRuleset([
      pack({
        spend: { type: 'integer', default: 0 },
        cost: { type: 'integer', formula: 'params.total' },
        total: { type: 'integer', formula: 'params.cost' },
      }),
    ]);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok)
      expect(loaded.errors.map((e) => (e.data as { cause?: string }).cause)).toEqual([
        'unknown-name',
      ]);
  });

  it('may be added by a params effect, read by its changes', () => {
    const release = pack({ ...own }, [
      {
        target: { actions: ['attack'] },
        op: 'params',
        value: {
          extra: { type: 'boolean', default: false },
          bonus: { type: 'integer', formula: 'params.extra ? params.cost : 0' },
        },
      },
      {
        target: { steps: ['attack'] },
        op: 'changes',
        value: { changes: [{ type: 'adjust', field: 'n', by: 'params.bonus' }] },
      },
    ]);
    expect(run(release, { spend: 2, extra: true })).toEqual([4, 4]);
    expect(run(release, { spend: 2 })).toEqual([4, 0]);
  });

  it("read the run's participants", () => {
    const params = { cost: { type: 'integer', formula: 'size(participants.target) * 3' } };
    const two = {
      target: [
        { id: 'a', values: {} },
        { id: 'b', values: {} },
      ],
    };
    expect(run(pack(params), {}, 'p:strike', two)).toEqual([6]);
  });

  it('describeAction marks them derived, never required', () => {
    const described = describeAction(load(pack(own)), character, { id: 'p:strike' });
    if (!('action' in described)) throw new Error(JSON.stringify(described));
    expect(described.action.params).toEqual([
      { name: 'spend', type: 'integer', required: false, default: 0 },
      { name: 'cost', type: 'integer', required: false, derived: true },
    ]);
  });
});

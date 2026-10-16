import { describe, expect, it } from 'vitest';
import { loadRuleset, type PackRelease } from '../src/index.ts';

const manifest = (id: string, dependencies?: Record<string, string>) => ({
  id,
  version: '1.0.0',
  specVersion: '0.1.0',
  license: 'CC0-1.0',
  defaultLanguage: 'en',
  ...(dependencies ? { dependencies } : {}),
});

/** A base pack whose `cast` action sets `slot` (an int) and has a choice step tagged `cost`. */
const base = (): PackRelease =>
  ({
    manifest: manifest('base'),
    rules: {
      tags: ['cost', 'cost.spell', 'other'],
      contentTypes: { trait: {} },
      actions: [
        {
          id: 'cast',
          steps: [
            { id: 'start', kind: 'branch', cases: [{ when: true, flags: { slot: 1 } }] },
            { id: 'cost', kind: 'choice', tags: ['cost.spell'], options: [{ id: 'slot' }] },
          ],
        },
      ],
    },
    content: [],
  }) as unknown as PackRelease;

/** A pack depending on `base` with one trait adding an option with these flags to `target`. */
const addon = (flags: Record<string, unknown>, target = 'cost'): PackRelease =>
  ({
    manifest: manifest('addon', { base: '^1.0.0' }),
    rules: {},
    content: [
      {
        id: 'traits.legacy',
        type: 'trait',
        effects: [{ target: { choices: [target] }, op: 'option', value: { id: 'legacy', flags } }],
      },
    ],
  }) as unknown as PackRelease;

const errors = (packs: PackRelease[]) => {
  const loaded = loadRuleset(packs);
  return loaded.ok
    ? []
    : loaded.errors.map((e) => [e.code, (e.data as { cause?: string } | undefined)?.cause]);
};

describe('option flags at load', () => {
  it('accepts a flag an action in a dependency sets, of its type', () => {
    expect(errors([base(), addon({ slot: 2 })])).toEqual([]);
  });

  it('reports a flag the reached action does not set', () => {
    expect(errors([base(), addon({ level: 2 })])).toEqual([['formula-error', 'unknown-name']]);
  });

  it('reports a value of another type', () => {
    expect(errors([base(), addon({ slot: "'two'" })])).toEqual([
      ['formula-error', 'type-mismatch'],
    ]);
  });

  it('does not check an option that reaches no step', () => {
    expect(errors([base(), addon({ level: 2 }, 'other')])).toEqual([]);
  });

  it("checks the actions content types carry, with the type's roots", () => {
    const pack = base() as unknown as { rules: Record<string, unknown> };
    pack.rules.contentTypes = {
      trait: {},
      spell: {
        fields: { level: { type: 'integer', default: 1 } },
        actions: [
          {
            id: 'channel',
            steps: [
              {
                id: 'start',
                kind: 'branch',
                cases: [{ when: true, flags: { power: 'item.level' } }],
              },
              { id: 'pay', kind: 'choice', tags: ['cost'], options: [{ id: 'hp' }] },
            ],
          },
        ],
      },
    };
    // `cost` reaches both actions: `cast` sets `slot` but not `power`.
    expect(errors([pack as unknown as PackRelease, addon({ power: 3 })])).toEqual([
      ['formula-error', 'unknown-name'],
    ]);
    expect(errors([pack as unknown as PackRelease, addon({ slot: 3 }, 'cost.spell')])).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { computeSheet, diceFrom, loadRuleset, startAction } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';

const pack = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.1.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    tags: ['quality-roll'],
    fields: { tier: { type: 'integer', input: true, default: 2 } },
    contentTypes: {
      gear: {
        carried: true,
        state: {
          charges: { type: 'integer', default: 1 },
          label: { type: 'string', default: 'lamp' },
        },
        computed: {
          ratio: { type: 'decimal', formula: 'tier / self.charges' },
          // `character.inventory` is dyn, so only the value's type can fail.
          size: { type: 'integer', formula: 'character.inventory[0].state.label' },
          quality: { type: 'integer', formula: 'tier' },
        },
        // A roll effect sees the copy without its computed values.
        effects: [
          {
            target: { rolls: ['quality-roll'] },
            op: 'add',
            value: '10',
            when: 'has(roll.self.quality)',
          },
        ],
        actions: [
          {
            id: 'roll',
            steps: [
              {
                id: 'roll',
                kind: 'roll',
                tags: ['quality-roll'],
                parts: [{ id: 'pool', dice: '(self.quality)d6kh1' }],
              },
              { id: 'done', kind: 'outcome', data: { total: 'steps.roll.total' } },
            ],
          },
        ],
      },
    },
  },
  content: [{ id: 'gear.lamp', type: 'gear' }],
} as unknown as PackRelease;

const loaded = loadRuleset([pack]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const character: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  inventory: [{ id: 'lamp-1', item: 'test-pack:gear.lamp', state: { charges: 0 } }],
};

describe('computed values on copies', () => {
  it('reports a failing formula with the copy, the name and the cause', () => {
    const sheet = computeSheet(ruleset, character);
    expect(sheet.copies).toEqual({ 'lamp-1': { quality: 2 } });
    expect(sheet.errors.map((e) => [e.code, e.data?.entry, e.data?.name, e.data?.cause])).toEqual([
      ['formula-error', 'lamp-1', 'ratio', 'division-by-zero'],
      ['formula-error', 'lamp-1', 'size', 'type-mismatch'],
    ]);
  });

  it("reads them in the copy's action but not in its roll effects", () => {
    const result = startAction(
      ruleset,
      character,
      { action: { id: 'test-pack:gear.lamp#roll', entry: 'lamp-1' } },
      diceFrom([3, 5]),
    );
    expect(result).toMatchObject({ status: 'finished', outcome: { data: { total: 5 } } });
  });
});

const withItem = (item: Record<string, unknown>) =>
  ({
    ...pack,
    rules: {
      fields: { tier: { type: 'integer', input: true, default: 2 } },
      contentTypes: {
        gear: {
          carried: true,
          computed: {
            base: { type: 'integer', formula: 'tier' },
            rank: { type: 'integer', formula: 'self.base' },
          },
        },
      },
    },
    content: [{ id: 'gear.relic', type: 'gear', ...item }],
  }) as unknown as PackRelease;

describe('computed values reading earlier ones', () => {
  it("lets an item's replacement read what comes before the replaced name", () => {
    const result = loadRuleset([
      withItem({ computed: { rank: { type: 'integer', formula: 'self.base + 1' } } }),
    ]);
    expect(result.ok).toBe(true);
  });

  it('rejects a replacement reading a name after it, or itself', () => {
    for (const formula of ['self.rank', 'self.base', 'self.extra']) {
      const result = loadRuleset([
        withItem({
          computed: {
            base: { type: 'integer', formula },
            extra: { type: 'integer', formula: '1' },
          },
        }),
      ]);
      expect(result.ok, formula).toBe(false);
    }
  });

  it("lets an item's new value read every one of the type's", () => {
    const result = loadRuleset([
      withItem({ computed: { edge: { type: 'integer', formula: 'self.rank + self.base' } } }),
    ]);
    expect(result.ok).toBe(true);
  });
});

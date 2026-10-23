import { describe, expect, it } from 'vitest';
import { diceFrom, loadRuleset, startAction } from '../src/index.ts';
import type { PackRelease } from '../src/index.ts';

// A roll effect's `then` is proposed only when the effect changed the roll: a bound that raised
// the total, not one the roll already beat.
const pack = {
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.2.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    tags: ['check'],
    contentTypes: { feat: { state: { used: { type: 'boolean', default: false } } } },
    actions: [
      {
        id: 'check',
        steps: [{ id: 'roll', kind: 'roll', tags: ['check'], parts: [{ dice: '1d20' }] }],
      },
    ],
  },
  content: [
    {
      id: 'feats.steady',
      type: 'feat',
      effects: [
        {
          target: { rolls: ['check'] },
          op: 'atLeast',
          value: 10,
          // oxlint-disable-next-line unicorn/no-thenable
          then: [{ type: 'setState', entry: 'self', key: 'used', value: true }],
        },
      ],
    },
  ],
} as unknown as PackRelease;

const loaded = loadRuleset([pack]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

const character = {
  specVersion: '0.2.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  features: [{ id: 'steady', item: 'test-pack:feats.steady' }],
} as never;

const run = (face: number) =>
  startAction(loaded.ruleset, character, { action: { id: 'test-pack:check' } }, diceFrom([face]));

describe('then on roll effects', () => {
  it('proposes the change when the effect changed the roll', () => {
    expect(run(3)).toMatchObject({
      status: 'finished',
      proposedChanges: [
        {
          to: 'self',
          step: 'roll',
          change: { type: 'setState', entry: 'steady', key: 'used', value: true },
        },
      ],
    });
  });

  it("proposes nothing when it didn't", () => {
    expect(run(15)).toMatchObject({ status: 'finished', proposedChanges: [] });
  });
});

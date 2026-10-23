import { describe, expect, it } from 'vitest';
import { type CharacterDoc, loadRuleset, startAction } from '../src/index.ts';

// A rest's `rest.end` changes step, which a picked feat and a granted gift add to, each
// resetting its own use; a plain trait without state can't.
const loaded = loadRuleset([
  {
    manifest: {
      id: 'test-pack',
      version: '1.0.0',
      specVersion: '0.2.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: {
      tags: ['rest'],
      contentTypes: {
        feat: { state: { used: { type: 'boolean', default: true } } },
        gift: { state: { used: { type: 'boolean', default: true } } },
        trait: {},
        artifact: { carried: true },
      },
      choices: [{ id: 'feats', from: { type: 'feat' }, required: false }],
      actions: [
        {
          id: 'rest',
          params: { trait: { type: 'boolean', default: false } },
          steps: [{ id: 'end', kind: 'changes', tags: ['rest'] }],
        },
      ],
    },
    content: [
      {
        id: 'feats.lucky',
        type: 'feat',
        effects: [
          {
            target: { steps: ['rest'] },
            op: 'changes',
            value: { changes: [{ type: 'setState', pick: 'owner', key: 'used', value: false }] },
          },
        ],
      },
      {
        id: 'gifts.ward',
        type: 'gift',
        effects: [
          {
            target: { steps: ['rest'] },
            op: 'changes',
            value: { changes: [{ type: 'setState', grant: 'owner', key: 'used', value: false }] },
          },
        ],
      },
      {
        id: 'traits.plain',
        type: 'trait',
        effects: [
          {
            target: { steps: ['rest'] },
            op: 'changes',
            when: 'params.trait',
            value: { changes: [{ type: 'setState', pick: 'owner', key: 'used', value: false }] },
          },
        ],
      },
      { id: 'artifacts.charm', type: 'artifact', grants: [{ item: 'gifts.ward' }] },
    ],
  } as never,
]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { ruleset } = loaded;

const character: CharacterDoc = {
  specVersion: '0.2.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  choices: { feats: [{ option: 'test-pack:feats.lucky' }] },
  features: [{ id: 'plain', item: 'test-pack:traits.plain' }],
  inventory: [{ id: 'charm', item: 'test-pack:artifacts.charm' }],
};

describe('pick: owner and grant: owner', () => {
  it('name the pick or grant of the content carrying a changes effect', () => {
    const result = startAction(ruleset, character, { action: { id: 'test-pack:rest' } });
    expect(result).toMatchObject({
      status: 'finished',
      proposedChanges: [
        {
          change: {
            type: 'setState',
            path: { choice: ['feats'] },
            option: 'test-pack:feats.lucky',
            key: 'used',
          },
        },
        {
          change: { type: 'setState', entry: 'charm', grant: 'test-pack:gifts.ward', key: 'used' },
        },
      ],
    });
  });

  it('is unknown-reference for content that is no pick with state', () => {
    const result = startAction(ruleset, character, {
      action: { id: 'test-pack:rest' },
      params: { trait: true },
    });
    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: 'unknown-reference', data: { kind: 'pick', id: 'owner' } }],
    });
  });
});

import { describe, expect, it } from 'vitest';
import { loadRuleset, startAction } from '../src/index.ts';

const loaded = loadRuleset([
  {
    manifest: {
      id: 'test-pack',
      version: '1.0.0',
      specVersion: '0.1.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: {
      contentTypes: { kit: { carried: true }, power: {} },
      actions: [
        {
          id: 'whose',
          available: false,
          results: ['done'],
          steps: [{ id: 'result', kind: 'outcome', result: "'done'", data: { item: 'item.id' } }],
        },
      ],
    },
    content: [
      { id: 'kits.kit', type: 'kit', grants: [{ item: 'powers.zap' }] },
      {
        id: 'powers.zap',
        type: 'power',
        actions: [
          {
            id: 'zap',
            results: ['done'],
            steps: [
              { id: 'inner', kind: 'action', use: 'whose' },
              {
                id: 'result',
                kind: 'outcome',
                result: "'done'",
                data: { item: 'steps.inner.data.item' },
              },
            ],
          },
        ],
      },
    ],
  } as never,
]);

describe('an action step from granted content', () => {
  it('runs the used rules action with the content as its item', () => {
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const character = {
      specVersion: '0.1.0',
      id: 'c',
      packs: [{ id: 'test-pack', version: '1.0.0' }],
      inventory: [{ id: 'k1', item: 'test-pack:kits.kit' }],
    };
    const result = startAction(loaded.ruleset, character as never, {
      action: { id: 'test-pack:powers.zap#zap', entry: 'k1', source: 'test-pack:powers.zap' },
    });
    expect(result).toMatchObject({
      status: 'finished',
      outcome: { data: { item: 'test-pack:powers.zap' } },
    });
  });
});

describe("an action step naming a copy's own item by source", () => {
  it('runs the action the copy lists, with the copy as self', () => {
    const character = {
      specVersion: '0.1.0',
      id: 'c',
      packs: [{ id: 'test-pack', version: '1.0.0' }],
      features: [{ id: 'zapper', item: 'test-pack:powers.zap' }],
    };
    const bySource = loadRuleset([
      {
        manifest: {
          id: 'test-pack',
          version: '1.0.0',
          specVersion: '0.1.0',
          license: 'CC0-1.0',
          defaultLanguage: 'en',
        },
        rules: {
          contentTypes: { power: {} },
          actions: [
            {
              id: 'run',
              steps: [
                { id: 'inner', kind: 'action', source: "'powers.zap'", use: 'zap' },
                { id: 'result', kind: 'outcome', data: { copy: 'steps.inner.data.copy' } },
              ],
            },
          ],
        },
        content: [
          {
            id: 'powers.zap',
            type: 'power',
            actions: [
              {
                id: 'zap',
                listed: false,
                steps: [{ id: 'result', kind: 'outcome', data: { copy: 'self.id' } }],
              },
            ],
          },
        ],
      } as never,
    ]);
    if (!bySource.ok) throw new Error(JSON.stringify(bySource.errors));
    expect(
      startAction(bySource.ruleset, character as never, { action: { id: 'test-pack:run' } }),
    ).toMatchObject({ status: 'finished', outcome: { data: { copy: 'zapper' } } });
  });
});

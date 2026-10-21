import { describe, expect, it } from 'vitest';
import { loadRuleset, startAction } from '../src/index.ts';

const pack = (actions: unknown[]) => ({
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.1.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: { contentTypes: { kit: { carried: true } }, actions },
  content: [{ id: 'kits.basic', type: 'kit' }],
});

const add = { type: 'addItem', entry: { item: "'kits.basic'" } };

const run = (actions: unknown[], action: string) => {
  const loaded = loadRuleset([pack(actions) as never]);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  const character = {
    specVersion: '0.1.0',
    id: 'c',
    packs: [{ id: 'test-pack', version: '1.0.0' }],
    inventory: [{ id: 'kits-basic-1', item: 'test-pack:kits.basic' }],
  };
  return startAction(loaded.ruleset, character as never, { action: { id: `test-pack:${action}` } });
};

describe('steps.<id>.added', () => {
  it("lists a repeated choice's copies across picks, and only a changes step's own to self", () => {
    const result = run(
      [
        {
          id: 'gain',
          steps: [
            {
              id: 'pick',
              kind: 'choice',
              repeat: { max: 2, min: 2 },
              recommend: 'options[0]',
              options: [{ id: 'a' }],
              changes: [add],
            },
            {
              id: 'give',
              kind: 'changes',
              changes: [{ type: 'addItem', entry: { id: 'gift', item: "'kits.basic'" } }],
            },
            { id: 'other', kind: 'changes', to: 'target', changes: [add] },
            {
              id: 'done',
              kind: 'outcome',
              data: {
                pick: 'steps.pick.added',
                give: 'steps.give.added',
                other: 'steps.other.added',
              },
            },
          ],
        },
      ],
      'gain',
    );
    expect(result).toMatchObject({
      status: 'finished',
      outcome: {
        data: { pick: ['kits-basic-2', 'kits-basic-3'], give: ['gift'], other: [] },
      },
    });
  });

  it("leaves out the held changes a step releases; the nested step's own lists them", () => {
    const result = run(
      [
        {
          id: 'inner',
          available: false,
          steps: [
            { id: 'add', kind: 'changes', changes: [add] },
            { id: 'done', kind: 'outcome', data: { added: 'steps.add.added' } },
          ],
        },
        {
          id: 'outer',
          steps: [
            { id: 'nested', kind: 'action', use: 'inner', hold: true },
            { id: 'out', kind: 'changes', release: { steps: ['nested'] } },
            {
              id: 'done',
              kind: 'outcome',
              data: { nested: 'steps.nested.data.added', out: 'steps.out.added' },
            },
          ],
        },
      ],
      'outer',
    );
    expect(result).toMatchObject({
      status: 'finished',
      outcome: { data: { nested: ['kits-basic-2'], out: [] } },
    });
  });

  it('types a changes step result at load', () => {
    const loaded = loadRuleset([
      pack([
        {
          id: 'bad',
          steps: [
            { id: 'add', kind: 'changes', changes: [add] },
            { id: 'done', kind: 'outcome', data: { n: 'steps.add.total' } },
          ],
        },
      ]) as never,
    ]);
    expect(loaded.ok ? [] : loaded.errors.map((e) => e.code)).toEqual(['formula-error']);
  });
});

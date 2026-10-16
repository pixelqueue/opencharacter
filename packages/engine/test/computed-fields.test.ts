import { describe, expect, it } from 'vitest';
import { applyChanges, loadRuleset, startAction, type PackRelease } from '../src/index.ts';
import type { CharacterDoc, RulesDoc } from '../src/core/pack-types.ts';

const release = (rules: RulesDoc): PackRelease => ({
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.1.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules,
  content: [],
});

const character: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'tester',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
};

const fields = {
  marks: { type: 'integer', input: true, default: 0 },
  'boxes.a': { type: 'integer', input: true, default: 0 },
  'boxes.b': { type: 'integer', input: true, default: 0 },
  double: { type: 'integer', formula: 'marks * 2' },
};

function load(rules: RulesDoc) {
  const loaded = loadRuleset([release(rules)]);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  return loaded.ruleset;
}

describe('forEach and computed fields in follow-ups', () => {
  const ruleset = load({
    fields,
    followUps: [
      {
        id: 'fill',
        becomes: 'marks >= 2',
        changes: [
          { type: 'adjust', forEach: "['boxes.a', 'boxes.b']", field: { formula: 'x' }, by: 1 },
        ],
      },
      {
        id: 'broken',
        becomes: 'marks >= 2',
        changes: [{ type: 'adjust', field: { formula: "'double'" }, by: 1 }],
      },
    ],
  });

  it('lists one change per element, and leaves out a follow-up whose field is derived', () => {
    const result = applyChanges(ruleset, character, [
      { type: 'adjust', field: 'test-pack:marks', by: 2 },
    ]);
    expect(result.ok && result.followUps).toEqual([
      {
        id: 'fill-1',
        kind: 'ephemeral',
        followUp: 'test-pack:fill',
        to: 'self',
        required: false,
        changes: [
          { type: 'adjust', field: 'test-pack:boxes.a', by: 1 },
          { type: 'adjust', field: 'test-pack:boxes.b', by: 1 },
          { type: 'clearFollowUp', id: 'fill-1' },
        ],
      },
    ]);
  });

  it('counts each copy toward maxFollowUps', () => {
    const many = load({
      fields,
      followUps: [
        {
          id: 'flood',
          becomes: 'marks >= 2',
          changes: [
            {
              type: 'adjust',
              forEach: `[${Array(101).fill(1).join(', ')}]`,
              field: 'boxes.a',
              by: 'x',
            },
          ],
        },
      ],
    });
    const result = applyChanges(many, character, [
      { type: 'adjust', field: 'test-pack:marks', by: 2 },
    ]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.map((e) => e.code)).toEqual(['safety-limit-exceeded']);
  });
});

describe('forEach in an action', () => {
  it('counts each copy toward maxActionSteps', () => {
    const ruleset = load({
      fields,
      actions: [
        {
          id: 'flood',
          steps: [
            {
              id: 'mark',
              kind: 'changes',
              changes: [
                {
                  type: 'adjust',
                  forEach: `[${Array(1001).fill(1).join(', ')}]`,
                  field: 'marks',
                  by: 1,
                },
              ],
            },
          ],
        },
      ],
    });
    const result = startAction(ruleset, character, { action: { id: 'test-pack:flood' } });
    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ code: 'safety-limit-exceeded' })],
    });
  });
});

function errors(changes: unknown[]) {
  const loaded = loadRuleset([
    release({
      fields,
      actions: [
        {
          id: 'mark',
          params: { name: { type: 'string' } },
          steps: [{ id: 'mark', kind: 'changes', changes: changes as never }],
        },
      ],
    }),
  ]);
  return loaded.ok ? [] : loaded.errors.map((e) => [e.code, e.data?.cause]);
}

describe('the type checker', () => {
  it('needs a list for forEach and types x as its element', () => {
    expect(
      errors([{ type: 'adjust', forEach: "['boxes.a']", field: { formula: 'x' }, by: 1 }]),
    ).toEqual([]);
    expect(errors([{ type: 'adjust', forEach: 'params.name', field: 'marks', by: 1 }])).toEqual([
      ['formula-error', 'type-mismatch'],
    ]);
    expect(errors([{ type: 'adjust', forEach: '[1, 2]', field: 'marks', by: "x + 'a'" }])).toEqual([
      ['formula-error', 'type-mismatch'],
    ]);
    expect(errors([{ type: 'adjust', field: 'marks', by: 'x' }])).toEqual([
      ['formula-error', 'unknown-name'],
    ]);
  });

  it('needs a string for a computed field', () => {
    expect(errors([{ type: 'set', field: { formula: '1' }, value: 1 }])).toEqual([
      ['formula-error', 'type-mismatch'],
    ]);
  });
});

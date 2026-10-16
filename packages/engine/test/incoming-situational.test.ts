import { describe, expect, it } from 'vitest';
import { applyChanges, buildRelease, loadRuleset } from '../src/index.ts';
import type { Change } from '../src/core/changes.ts';
import type { CharacterDoc } from '../src/core/pack-types.ts';

const pack = (rules: Record<string, unknown>) =>
  loadRuleset([
    buildRelease({
      manifest: {
        id: 'test-pack',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: [rules as never],
      content: [],
    }),
  ]);

const base = {
  tags: ['damage', 'attack'],
  fields: {
    hp: { type: 'integer', input: true, default: 20, min: 0 },
    agile: { type: 'boolean', input: true, default: true },
    checks: { type: 'integer', input: true, default: 0 },
  },
  situational: [
    {
      id: 'dodge',
      type: 'boolean',
      default: false,
      incoming: { fields: ['hp'], tags: ['attack'] },
      available: 'agile',
      effects: [{ target: { incoming: { tags: ['damage'] } }, op: 'multiply', value: 0.5 }],
    },
  ],
  actions: [
    {
      id: 'check',
      params: { damage: { type: 'integer' }, requested: { type: 'integer' } },
      results: ['done'],
      steps: [{ id: 'result', kind: 'outcome', result: "'done'" }],
    },
  ],
};
const loaded = pack(base);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const character: CharacterDoc = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
};
const hit = (by: number, dodge?: unknown): Change =>
  ({
    type: 'adjust',
    field: 'test-pack:hp',
    by,
    tags: ['damage', 'attack'],
    ...(dodge !== undefined ? { situational: { 'test-pack:dodge': dodge } } : {}),
  }) as unknown as Change;

describe('situational choices on incoming changes', () => {
  it('reports the choice in situational-unavailable, at the change', () => {
    const tired = { ...character, values: { 'test-pack:agile': false } };
    const result = applyChanges(ruleset, tired, [hit(-4), hit(-4, true)]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      {
        code: 'situational-unavailable',
        path: '/changes/1',
        data: { situational: 'test-pack:dodge' },
      },
    ]);
  });

  it('replays its output changes to the same character', () => {
    const first = applyChanges(ruleset, character, [hit(-8, true), hit(-3)]);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.character.values?.['test-pack:hp']).toBe(20 - 4 - 3);
    const replay = applyChanges(ruleset, character, first.changes);
    expect(replay.ok && replay.character).toEqual(first.character);
  });

  it('gives incoming-change effects the choices as situational, defaults for the rest', () => {
    const reading = pack({
      ...base,
      effects: [
        {
          target: { incoming: { fields: ['hp'] } },
          op: 'add',
          value: 1,
          when: '!situational.dodge',
        },
      ],
    });
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    const result = applyChanges(reading.ruleset, character, [hit(-4, true), hit(-4)]);
    expect(result.ok && result.character.values?.['test-pack:hp']).toBe(20 - 2 - 3);
  });

  it('type-checks a choice incoming-change effect without roll roots', () => {
    const bad = pack({
      ...base,
      situational: [
        {
          ...base.situational[0],
          effects: [
            {
              target: { incoming: { tags: ['damage'] } },
              op: 'multiply',
              value: 0.5,
              when: 'roll.total > 0',
            },
          ],
        },
      ],
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.map((e) => e.data?.cause ?? e.code)).toContain('unknown-name');
  });
});

describe('follow-ups once per batch', () => {
  const once = pack({
    ...base,
    followUps: [
      {
        id: 'check',
        on: { field: 'hp', tags: ['damage'], once: true },
        when: 'change.taken < 0',
        action: 'check',
        params: { damage: '-change.taken', requested: '-change.requested' },
      },
    ],
  });

  it('fires once on the batch, with the amount taken summed', () => {
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const result = applyChanges(once.ruleset, character, [hit(-8, true), hit(-3)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.adjustments).toEqual([
      { field: 'test-pack:hp', by: -4, requested: -8, taken: -4, reason: 'requested' },
      { field: 'test-pack:hp', by: -3, requested: -3, taken: -3, reason: 'requested' },
    ]);
    expect(result.followUps).toEqual([
      {
        id: 'check-1',
        kind: 'ephemeral',
        followUp: 'test-pack:check',
        to: 'self',
        required: false,
        action: { id: 'test-pack:check', followUp: 'check-1' },
        params: { damage: 7, requested: 11 },
        cause: {
          field: 'test-pack:hp',
          by: -7,
          requested: -11,
          taken: -7,
          reason: 'requested',
          clamped: false,
          tags: ['damage', 'attack'],
        },
      },
    ]);
  });

  it('fires once for a batch of one change', () => {
    if (!once.ok) return;
    const result = applyChanges(once.ruleset, character, [hit(-2)]);
    expect(result.ok && result.followUps.map((f) => f.params)).toEqual([
      { damage: 2, requested: 2 },
    ]);
  });
});

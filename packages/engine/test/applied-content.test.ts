import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyChanges, computeSheet, loadRuleset, startAction } from '../src/index.ts';
import type { CharacterDoc, ProposedChange } from '../src/core/pack-types.ts';
import type { PackRelease } from '../src/core/release.ts';
import { readPack } from './packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const loaded = loadRuleset([readPack(`${root}packages/spec/tests/packs/test-applied`)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const character = (extra: Partial<CharacterDoc>): CharacterDoc => ({
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-applied', version: '0.1.0' }],
  ...extra,
});
const speed = (c: CharacterDoc) => computeSheet(ruleset, c).values['test-applied:speed']?.value;

describe('applied content from actions', () => {
  it('drinks a potion: the proposed applyEffect gets its ID from applyChanges, and applies', () => {
    const before = character({
      inventory: [{ id: 'haste', item: 'test-applied:potions.haste', quantity: 2 }],
    });
    const run = startAction(ruleset, before, {
      action: { id: 'test-applied:potions.haste#drink', entry: 'haste' },
    });
    if (!('status' in run) || run.status !== 'finished') throw new Error(JSON.stringify(run));
    const changes = run.proposedChanges.map((p) => p.change);
    const once = applyChanges(ruleset, before, changes);
    if (!once.ok) throw new Error(JSON.stringify(once.errors));
    expect(once.character.applied).toEqual([
      { id: 'potions-haste-1', source: 'test-applied:potions.haste' },
    ]);
    expect(speed(once.character)).toBe(40);
    // Replaying the same batch on the same character gives the same ID.
    const again = applyChanges(ruleset, before, changes);
    expect(again.ok && again.character.applied).toEqual(once.character.applied);
    // A second potion gets the next ID; both apply.
    const twice = applyChanges(ruleset, once.character, changes);
    expect(twice.ok && twice.character.applied?.map((a) => a.id)).toEqual([
      'potions-haste-1',
      'potions-haste-2',
    ]);
  });

  it('worsens a poison by query and reads the new level on the sheet', () => {
    const poisoned = character({
      applied: [{ id: 'p', source: 'test-applied:conditions.poisoned', state: { level: 2 } }],
    });
    expect(speed(poisoned)).toBe(20);
    const run = startAction(ruleset, poisoned, {
      action: { id: 'test-applied:worsen' },
      params: { by: 1 },
    });
    if (!('status' in run) || run.status !== 'finished') throw new Error(JSON.stringify(run));
    const result = applyChanges(
      ruleset,
      poisoned,
      run.proposedChanges.map((p) => p.change),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(speed(result.character)).toBe(15);
    expect(result.adjustments).toEqual([{ applied: ['p'] }, { applied: [] }]);
  });

  it("reports the state key an applyEffect's source doesn't declare", () => {
    const result = applyChanges(ruleset, character({}), [
      { type: 'applyEffect', source: 'test-applied:conditions.poisoned', state: { rank: 1 } },
    ]);
    expect(result).toEqual({
      ok: false,
      errors: [{ code: 'unknown-state-key', path: '/changes/0', data: { key: 'rank' } }],
    });
  });

  it('names an applied entry the change can not find', () => {
    const result = applyChanges(ruleset, character({}), [
      { type: 'setState', entry: 'gone', key: 'level', value: 2 },
    ]);
    expect(result.ok || result.errors[0]).toEqual({
      code: 'not-owned',
      path: '/changes/0',
      data: { entry: 'gone' },
    });
  });
});

const pack = (changes: ProposedChange[]): PackRelease => ({
  manifest: {
    id: 'test-pack',
    version: '1.0.0',
    specVersion: '0.1.0',
    license: 'CC0-1.0',
    defaultLanguage: 'en',
  },
  rules: {
    contentTypes: { condition: { carried: false } },
    actions: [{ id: 'hex', steps: [{ id: 'hex', kind: 'changes', changes }] }],
  },
  content: [{ id: 'conditions.hexed', type: 'condition' }],
});

const causes = (changes: ProposedChange[]) => {
  const result = loadRuleset([pack(changes)]);
  return result.ok ? [] : result.errors.map((e) => e.data?.cause ?? e.code);
};

describe('the type checker on applied content', () => {
  it('takes a string source, a boolean active and a boolean where', () => {
    expect(
      causes([
        { type: 'applyEffect', source: "'conditions.hexed'", active: 'true' },
        { type: 'removeEffect', applied: { where: "self.id == 'x' && item.id != ''" } },
      ]),
    ).toEqual([]);
  });

  it('rejects a source that is not a string and an active that is not a boolean', () => {
    expect(causes([{ type: 'applyEffect', source: '1', active: '2' }])).toEqual([
      'type-mismatch',
      'type-mismatch',
    ]);
  });

  it("rejects a where that isn't a condition", () => {
    expect(causes([{ type: 'removeEffect', applied: { where: '1' } }])).toEqual(['type-mismatch']);
  });
});

/** The causes of the load errors of a potion whose applied action is available when `when`. */
const appliedActionCauses = (when: string) => {
  const result = loadRuleset([
    {
      manifest: {
        id: 'test-pack',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: {
        contentTypes: {
          potion: { carried: true, state: { surges: { type: 'integer', default: 2 } } },
        },
      },
      content: [
        {
          id: 'potions.haste',
          type: 'potion',
          actions: [
            {
              id: 'surge',
              scope: 'applied',
              available: when,
              steps: [{ id: 'done', kind: 'outcome' }],
            },
          ],
        },
      ],
    },
  ]);
  return result.ok ? [] : result.errors.map((e) => e.data?.cause ?? e.code);
};

describe("the type checker on an applied entry's actions", () => {
  it("reads the entry's ID and state as `self`", () => {
    expect(appliedActionCauses("self.surges > 0 && self.id != ''")).toEqual([]);
  });

  it('types its state keys', () => {
    expect(appliedActionCauses('self.surges && true')).toEqual(['type-mismatch']);
  });
});

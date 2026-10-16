import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyChanges, computeSheet, loadRuleset } from '../src/index.ts';
import type { CharacterDoc } from '../src/core/pack-types.ts';
import { readPack } from './packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const loaded = loadRuleset([readPack(`${root}packages/spec/tests/packs/test-immunity`)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const character = (extra: Partial<CharacterDoc>): CharacterDoc => ({
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-immunity', version: '0.1.0' }],
  ...extra,
});

const issues = (sources: string[]) =>
  computeSheet(
    ruleset,
    character({
      applied: sources.map((s) => ({ id: s, source: `test-immunity:conditions.${s}` })),
    }),
  ).issues.map((i) => [i.id, i.data]);

describe('immunity to applied content', () => {
  it("names the immunity's activation as the source and the blocked entry in data", () => {
    const sheet = computeSheet(
      ruleset,
      character({
        features: [{ id: 'steady', item: 'test-immunity:features.steady' }],
        applied: [{ id: 'slow', source: 'test-immunity:conditions.slowed' }],
      }),
    );
    expect(sheet.issues).toEqual([
      {
        code: 'immune',
        id: 'test-immunity:features.steady/slowed',
        source: { type: 'item', id: 'test-immunity:features.steady', entry: 'steady' },
        data: { entry: 'slow', item: 'test-immunity:conditions.slowed' },
      },
    ]);
    expect(sheet.effects).toEqual([]);
  });

  it("gives a rules immunity the rules as its source, and an applied entry's its source", () => {
    const sheet = computeSheet(
      ruleset,
      character({
        values: { 'test-immunity:immunities': ['test-immunity:conditions.dazed'] },
        applied: [
          { id: 'daze', source: 'test-immunity:conditions.dazed' },
          { id: 'stone', source: 'test-immunity:conditions.stone' },
          { id: 'slow', source: 'test-immunity:conditions.slowed' },
        ],
      }),
    );
    expect(sheet.issues.map((i) => [i.id, i.source, i.data])).toEqual([
      [
        'test-immunity:listed',
        { type: 'rules', id: 'test-immunity:listed' },
        { entry: 'daze', item: 'test-immunity:conditions.dazed' },
      ],
      [
        'test-immunity:conditions.stone/slowed',
        { type: 'item', id: 'test-immunity:conditions.stone' },
        { entry: 'slow', item: 'test-immunity:conditions.slowed' },
      ],
    ]);
  });

  it('blocks an applied entry in either direction, and the earlier of two that block each other', () => {
    const stone = [
      [
        'test-immunity:conditions.stone/slowed',
        { entry: 'slowed', item: 'test-immunity:conditions.slowed' },
      ],
    ];
    expect(issues(['slowed', 'stone'])).toEqual(stone);
    expect(issues(['stone', 'slowed'])).toEqual(stone);
    expect(issues(['frozen', 'burning'])).toEqual([
      [
        'test-immunity:conditions.frozen/burning',
        { entry: 'burning', item: 'test-immunity:conditions.burning' },
      ],
    ]);
    // A cycle: its earliest entry wins, whatever comes before it.
    expect(issues(['paper', 'scissors', 'rock'])).toEqual([
      [
        'test-immunity:conditions.paper/rock',
        { entry: 'rock', item: 'test-immunity:conditions.rock' },
      ],
    ]);
  });

  it('lets a blocked entry apply again once the entry blocking it is removed', () => {
    const before = character({
      applied: [
        { id: 'slow', source: 'test-immunity:conditions.slowed' },
        { id: 'stone', source: 'test-immunity:conditions.stone' },
      ],
    });
    expect(computeSheet(ruleset, before).values['test-immunity:speed']?.value).toBe(25);
    const result = applyChanges(ruleset, before, [{ type: 'removeEffect', id: 'stone' }]);
    expect(result.ok && result.issues).toEqual([]);
    if (!result.ok) return;
    expect(computeSheet(ruleset, result.character).values['test-immunity:speed']?.value).toBe(20);
  });

  it('applies the entry again once the immunity is gone', () => {
    const before = character({
      features: [{ id: 'steady', item: 'test-immunity:features.steady' }],
      applied: [{ id: 'slow', source: 'test-immunity:conditions.slowed' }],
    });
    const result = applyChanges(ruleset, before, [{ type: 'removeItem', entry: 'steady' }]);
    expect(result.ok && result.issues).toEqual([]);
    if (!result.ok) return;
    const sheet = computeSheet(ruleset, result.character);
    expect(sheet.values['test-immunity:speed']?.value).toBe(20);
  });
});

const sheetIssues = (extra: Partial<CharacterDoc>) =>
  computeSheet(ruleset, character(extra)).issues.map((i) => [i.id, i.data]);

/** `magic`: the active applied entries whose `magical` is true, read from `character.applied`. */
const magic = (applied: NonNullable<CharacterDoc['applied']>) =>
  computeSheet(
    ruleset,
    character({ features: [{ id: 'unbound', item: 'test-immunity:features.unbound' }], applied }),
  ).values['test-immunity:magic']?.value;

describe('immunities that read applied entries', () => {
  const daze = { id: 'daze', source: 'test-immunity:conditions.dazed' };
  const sleep = { id: 'sleep', source: 'test-immunity:conditions.asleep' };
  const alert = [{ id: 'alert', item: 'test-immunity:features.alert' }];
  const blockedDaze = [
    [
      'test-immunity:features.alert/dazed',
      { entry: 'daze', item: 'test-immunity:conditions.dazed' },
    ],
  ];

  it('holds a when over character.applied while no active entry of the source is applied', () => {
    expect(sheetIssues({ features: alert, applied: [daze] })).toEqual(blockedDaze);
    expect(sheetIssues({ features: alert, applied: [daze, { ...sleep, active: false }] })).toEqual(
      blockedDaze,
    );
    expect(sheetIssues({ features: alert, applied: [sleep, daze] })).toEqual([]);
  });

  it('reads character.applied raw: an entry an immunity blocks still counts', () => {
    expect(
      sheetIssues({
        values: { 'test-immunity:immunities': ['test-immunity:conditions.asleep'] },
        features: alert,
        applied: [daze, sleep],
      }),
    ).toEqual([
      ['test-immunity:listed', { entry: 'sleep', item: 'test-immunity:conditions.asleep' }],
    ]);
  });

  it("gives character.applied each entry's active flag and state, defaults included", () => {
    const slow = { source: 'test-immunity:conditions.slowed' };
    expect(magic([{ id: 'a', ...slow }])).toBe(0);
    // The magical slow is blocked by unbound, and still counted.
    expect(magic([{ id: 'a', ...slow, state: { magical: true } }])).toBe(1);
    expect(magic([{ id: 'a', ...slow, state: { magical: true }, active: false }])).toBe(0);
  });

  it('binds entry in a query to the candidate: its id and state, defaults included', () => {
    const sheet = computeSheet(
      ruleset,
      character({
        features: [
          { id: 'warded', item: 'test-immunity:features.warded' },
          { id: 'unbound', item: 'test-immunity:features.unbound' },
        ],
        applied: [
          { id: 'fey', source: 'test-immunity:conditions.dazed', state: { by: 'fey' } },
          { id: 'beast', source: 'test-immunity:conditions.dazed', state: { by: 'beast' } },
          { id: 'plain', source: 'test-immunity:conditions.dazed' },
          { id: 'spell', source: 'test-immunity:conditions.slowed', state: { magical: true } },
          { id: 'mud', source: 'test-immunity:conditions.slowed', state: { magical: false } },
        ],
      }),
    );
    expect(sheet.issues.map((i) => [i.id, (i.data as { entry: string }).entry])).toEqual([
      ['test-immunity:features.warded/fey', 'fey'],
      ['test-immunity:features.unbound/magical', 'spell'],
    ]);
    // 30, the two other dazes -2, the unmagical slow -10.
    expect(sheet.values['test-immunity:speed']?.value).toBe(18);
  });
});

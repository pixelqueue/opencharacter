import { describe, expect, it } from 'vitest';
import { applyChanges, checkRelease, computeSheet, loadRuleset, upgrade } from '../src/index.ts';
import type { CharacterDoc, PackRelease, Ruleset } from '../src/index.ts';

const manifest = (version: string) => ({
  id: 'test-pack',
  version,
  specVersion: '0.1.0',
  license: 'CC0-1.0',
  defaultLanguage: 'en',
});

const v1: PackRelease = {
  manifest: manifest('1.0.0'),
  rules: {
    tags: ['energy', 'heavy'],
    fields: {
      'stats.might': { type: 'integer', input: true, default: 1 },
      'stats.bonus': { type: 'integer', input: true, default: 0 },
      'stats.power': { type: 'integer', formula: 'stats.might * 2' },
    },
    contentTypes: {
      weapon: {
        carried: true,
        fields: {
          damage: { type: 'integer', default: 1 },
          kind: { type: 'enum', values: ['melee', 'ranged'], default: 'melee' },
          ammo: { type: 'id', of: 'gear', optional: true },
          boosts: { type: 'id', of: 'field', optional: true },
          mark: { type: 'id', of: 'tag', optional: true },
        },
        state: { shots: { type: 'integer', default: 0 } },
      },
      gear: { carried: true },
    },
    actions: [{ id: 'strike', steps: [{ id: 'result', kind: 'outcome', result: 'item.id' }] }],
  },
  content: [{ id: 'gear.battery', type: 'gear' }],
} as never;

const v2: PackRelease = {
  manifest: manifest('2.0.0'),
  rules: {
    tags: ['power', 'bulky'],
    fields: {
      'stats.might': { type: 'integer', input: true, default: 1 },
      'stats.edge': { type: 'integer', input: true, default: 0 },
      'stats.force': { type: 'integer', formula: 'stats.might * 2' },
    },
    contentTypes: {
      arm: {
        carried: true,
        fields: {
          harm: { type: 'integer', default: 1 },
          kind: { type: 'enum', values: ['melee', 'shooting'], default: 'melee' },
          ammo: { type: 'id', of: 'gear', optional: true },
          boosts: { type: 'id', of: 'field', optional: true },
          mark: { type: 'id', of: 'tag', optional: true },
        },
        state: { charges: { type: 'integer', default: 0 } },
      },
      gear: { carried: true },
    },
    actions: [{ id: 'hit', steps: [{ id: 'result', kind: 'outcome', result: 'item.id' }] }],
  },
  content: [{ id: 'gear.cell', type: 'gear' }],
  upgrades: [
    {
      pack: 'test-pack',
      from: '1.0.0',
      to: '2.0.0',
      steps: [
        { op: 'renameContent', from: 'gear.battery', to: 'gear.cell' },
        { op: 'renameField', from: 'stats.bonus', to: 'stats.edge' },
        { op: 'renameField', from: 'stats.power', to: 'stats.force' },
        { op: 'renameContentType', from: 'weapon', to: 'arm' },
        { op: 'renameItemField', type: 'arm', from: 'damage', to: 'harm' },
        { op: 'mapItemValues', type: 'arm', field: 'kind', map: { ranged: 'shooting' } },
        { op: 'renameState', type: 'arm', from: 'shots', to: 'charges' },
        { op: 'renameTag', from: 'energy', to: 'power' },
        { op: 'renameTag', from: 'heavy', to: 'bulky' },
        { op: 'renameAction', from: 'strike', to: 'hit' },
      ],
    },
  ],
} as never;

const load = (...packs: PackRelease[]): Ruleset => {
  const result = loadRuleset(packs);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.ruleset;
};
const from = load(v1);
const to = load(v2);

const homebrew = () => ({
  content: [
    // The homebrew's own gear.cell: the pack's new gear.cell is written qualified.
    { id: 'gear.cell', type: 'gear' },
    {
      id: 'weapons.blaster',
      type: 'weapon',
      tags: ['energy'],
      fields: {
        damage: 3,
        kind: 'ranged',
        ammo: 'gear.battery',
        boosts: 'stats.bonus',
        mark: 'heavy',
      },
      actions: [{ use: 'strike' }],
      effects: [{ target: 'stats.power', op: 'add', value: 'item.damage + self.shots' }],
      prerequisites: [
        { id: 'p', when: "'test-pack:gear.battery' != '' && stats.power >= 1 && stats.bonus >= 0" },
      ],
    },
  ],
});

const character = (extra: Record<string, unknown> = {}): CharacterDoc =>
  ({
    specVersion: '0.1.0',
    id: 'c',
    packs: [{ id: 'test-pack', version: '1.0.0' }],
    values: { 'test-pack:stats.bonus': 2 },
    inventory: [
      { id: 'b', item: 'homebrew:weapons.blaster', state: { shots: 2 } },
      { id: 'c', item: 'homebrew:gear.cell' },
    ],
    homebrew: homebrew(),
    ...extra,
  }) as CharacterDoc;

describe('upgrade steps rewrite the homebrew', () => {
  const result = upgrade(from, to, character());
  if (!result.ok) throw new Error(JSON.stringify(result.errors));

  it('rewrites every reference, qualified, and the formulas as canonical text', () => {
    expect(result.character.homebrew).toEqual({
      content: [
        { id: 'gear.cell', type: 'gear' },
        {
          id: 'weapons.blaster',
          type: 'test-pack:arm',
          tags: ['power'],
          fields: {
            harm: 3,
            kind: 'shooting',
            ammo: 'test-pack:gear.cell',
            boosts: 'test-pack:stats.edge',
            mark: 'bulky',
          },
          actions: [{ use: 'test-pack:hit' }],
          effects: [
            { target: 'test-pack:stats.force', op: 'add', value: 'item.harm + self.charges' },
          ],
          prerequisites: [
            {
              id: 'p',
              when: "'test-pack:gear.cell' != '' && stats.force >= 1 && stats.edge >= 0",
            },
          ],
        },
      ],
    });
  });

  it('moves saved state too, and the homebrew loads on the new ruleset', () => {
    expect(result.character.values).toEqual({ 'test-pack:stats.edge': 2 });
    expect(result.character.inventory?.[0]?.state).toEqual({ charges: 2 });
    expect(result.report.errors).toEqual([]);
    expect(computeSheet(to, result.character).errors).toEqual([]);
  });

  it('lists each rewritten place in report.homebrew, and each step in report.steps', () => {
    const at = '/homebrew/content/1';
    expect(result.report.homebrew.map((h) => [h.step.op, h.path])).toEqual([
      ['renameContent', `${at}/fields/ammo`],
      ['renameContent', `${at}/prerequisites/0/when`],
      ['renameField', `${at}/fields/boosts`],
      ['renameField', `${at}/prerequisites/0/when`],
      ['renameField', `${at}/effects/0/target`],
      ['renameField', `${at}/prerequisites/0/when`],
      ['renameContentType', `${at}/type`],
      ['renameItemField', `${at}/fields/damage`],
      ['renameItemField', `${at}/effects/0/value`],
      ['mapItemValues', `${at}/fields/kind`],
      ['renameState', `${at}/effects/0/value`],
      ['renameTag', `${at}/tags/0`],
      ['renameTag', `${at}/fields/mark`],
      ['renameAction', `${at}/actions/0/use`],
    ]);
    expect(result.report.steps).toHaveLength(10);
  });
});

describe('matching', () => {
  it("leaves the homebrew's own definitions alone", () => {
    const own = upgrade(
      from,
      to,
      character({
        homebrew: {
          content: [
            // Its own gear.battery: an unqualified reference to it isn't the pack's.
            { id: 'gear.battery', type: 'gear' },
            { id: 'weapons.blaster', type: 'weapon', fields: { ammo: 'gear.battery' } },
          ],
        },
        inventory: [],
        values: {},
      }),
    );
    if (!own.ok) throw new Error(JSON.stringify(own.errors));
    expect(own.character.homebrew?.content?.[1]).toEqual({
      id: 'weapons.blaster',
      type: 'test-pack:arm',
      fields: { ammo: 'gear.battery' },
    });
  });

  it('a character without homebrew has an empty report.homebrew', () => {
    const plain = upgrade(from, to, character({ homebrew: undefined, inventory: [] }));
    expect(plain.ok && plain.report.homebrew).toEqual([]);
  });
});

describe('setHomebrew', () => {
  it('replaces the homebrew; later changes see the new one', () => {
    const result = applyChanges(from, character(), [
      {
        type: 'setHomebrew',
        homebrew: { content: [...homebrew().content, { id: 'gear.lamp', type: 'gear' }] },
      },
      { type: 'addItem', entry: { id: 'l', item: 'homebrew:gear.lamp' } },
    ] as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.character.homebrew?.content).toHaveLength(3);
    expect(result.character.inventory?.map((e) => e.id)).toEqual(['b', 'c', 'l']);
  });

  it('is rejected while the file still uses removed homebrew', () => {
    const result = applyChanges(from, character(), [
      { type: 'setHomebrew', homebrew: { content: [homebrew().content[1]] } },
    ] as never);
    expect(result).toEqual({
      ok: false,
      errors: [{ code: 'unknown-id', path: '/changes/0', data: { id: 'homebrew:gear.cell' } }],
    });
  });

  it('removes the section with null once nothing uses it', () => {
    const result = applyChanges(from, character(), [
      { type: 'removeItem', entry: 'b' },
      { type: 'removeItem', entry: 'c' },
      { type: 'setHomebrew', homebrew: null },
    ] as never);
    expect(result.ok && 'homebrew' in result.character).toBe(false);
  });

  it('reports a homebrew that does not load with paths into the change', () => {
    const result = applyChanges(from, character(), [
      { type: 'set', field: 'test-pack:stats.might', value: 2 },
      {
        type: 'setHomebrew',
        homebrew: { content: [...homebrew().content, { id: 'gear.ray', type: 'raygun' }] },
      },
    ] as never);
    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: 'homebrew-error',
          path: '/changes/1/homebrew',
          data: { cause: 'unknown-reference' },
        },
      ],
    });
  });

  it('a batch starting with setHomebrew repairs a homebrew that no longer loads', () => {
    const broken = character({
      homebrew: { content: [...homebrew().content, { id: 'gear.ray', type: 'raygun' }] },
    });
    expect(applyChanges(from, broken, []).ok).toBe(false);
    expect(
      applyChanges(from, broken, [{ type: 'setHomebrew', homebrew: homebrew() }] as never).ok,
    ).toBe(true);
  });
});

describe('checkRelease reports interface changes', () => {
  it("lists them after the shape changes; the script needn't cover them", () => {
    const result = checkRelease(v1, v2);
    expect(result.changes).toEqual([
      { kind: 'content-removed', id: 'test-pack:gear.battery' },
      { kind: 'field-removed', id: 'test-pack:stats.bonus' },
      { kind: 'field-removed', id: 'test-pack:stats.power' },
      { kind: 'state-removed', id: 'test-pack:weapon/shots' },
      { kind: 'content-type-removed', id: 'test-pack:weapon' },
      { kind: 'tag-removed', id: 'test-pack:energy' },
      { kind: 'tag-removed', id: 'test-pack:heavy' },
      { kind: 'action-removed', id: 'test-pack:strike' },
    ]);
    expect(result.errors).toEqual([]);
  });

  it('item fields: removed, retyped, or an enum losing values', () => {
    const next = structuredClone(v1) as PackRelease & { rules: Record<string, never> };
    next.manifest.version = '1.1.0';
    const weapon = (
      next.rules as never as { contentTypes: { weapon: { fields: Record<string, unknown> } } }
    ).contentTypes.weapon;
    delete weapon.fields['damage'];
    weapon.fields['boosts'] = { type: 'id', of: 'gear', optional: true };
    weapon.fields['kind'] = { type: 'enum', values: ['melee'], default: 'melee' };
    const result = checkRelease(v1, next);
    expect(result.changes).toEqual([
      { kind: 'item-field-removed', id: 'test-pack:weapon/boosts' },
      { kind: 'item-field-removed', id: 'test-pack:weapon/damage' },
      { kind: 'item-field-values-removed', id: 'test-pack:weapon/kind' },
    ]);
    // A major bump, but no upgrade script.
    expect(result.errors.map((e) => e.code)).toEqual(['version-bump-too-small']);
    next.manifest.version = '2.0.0';
    expect(checkRelease(v1, next)).toMatchObject({ ok: true, errors: [] });
  });
});

const standard = (version: string, steps?: unknown[]): PackRelease =>
  ({
    manifest: manifest(version),
    rules: {
      contentTypes: {
        gear: { carried: true, state: { marked: { type: 'boolean', default: false } } },
      },
      ...(version === '2.0.0' ? { standardCopies: [{ type: 'gear' }] } : {}),
    },
    content: [{ id: 'gear.lantern', type: 'gear' }],
    ...(steps ? { upgrades: [{ pack: 'test-pack', from: '1.0.0', to: '2.0.0', steps }] } : {}),
  }) as never;
const lantern = (extra: object[] = []) =>
  ({
    specVersion: '0.1.0',
    id: 'c',
    packs: [{ id: 'test-pack', version: '1.0.0' }],
    inventory: [
      { id: 'g-lantern', item: 'test-pack:gear.lantern', state: { marked: true } },
      { id: 'g-lantern-2', item: 'test-pack:gear.lantern' },
      ...extra,
    ],
  }) as CharacterDoc;

describe('adoptStandard', () => {
  it('renames the first entry of the item to its standard copy ID, keeping its state', () => {
    const result = upgrade(
      load(standard('1.0.0')),
      load(standard('2.0.0', [{ op: 'adoptStandard', item: 'gear.lantern' }])),
      lantern(),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.character.inventory).toEqual([
      { id: 'test-pack-gear-lantern', item: 'test-pack:gear.lantern', state: { marked: true } },
      { id: 'g-lantern-2', item: 'test-pack:gear.lantern' },
    ]);
    expect(result.report.steps.map((s) => s.step.op)).toEqual(['adoptStandard']);
    expect(computeSheet(load(standard('2.0.0')), result.character).standardCopies).toEqual([
      { entry: 'test-pack-gear-lantern', item: 'test-pack:gear.lantern', saved: true },
    ]);
  });

  it('does nothing when an entry already has the ID', () => {
    const taken = lantern([{ id: 'test-pack-gear-lantern', item: 'test-pack:gear.lantern' }]);
    const result = upgrade(
      load(standard('1.0.0')),
      load(standard('2.0.0', [{ op: 'adoptStandard', item: 'gear.lantern' }])),
      taken,
    );
    expect(result.ok && result.report.steps).toEqual([]);
  });
});

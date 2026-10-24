import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateRepo } from './index.ts';

const testPacks = fileURLToPath(new URL('../../packages/spec/tests/packs', import.meta.url));

/** The suite's core and add-on packs as a repo, with `edit` applied to the add-on's files. */
function validateAddon(edit: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ocf-validate-addon-'));
  try {
    cpSync(join(testPacks, 'test-core'), join(root, 'packs', 'test', 'core'), { recursive: true });
    cpSync(join(testPacks, 'test-addon'), join(root, 'packs', 'test', 'addon'), {
      recursive: true,
    });
    cpSync(join(testPacks, 'test-addon-two'), join(root, 'packs', 'test', 'addon-two'), {
      recursive: true,
    });
    for (const [file, text] of Object.entries(edit))
      writeFileSync(join(root, 'packs', 'test', 'addon', file), text);
    mkdirSync(join(root, 'characters'));
    const { reporter } = validateRepo(root, {
      packs: join(root, 'packs'),
      characters: join(root, 'characters'),
      exports: join(root, 'exports'),
      pending: new Map(),
    });
    return {
      errors: reporter.errors.map((e) => e.message),
      warnings: reporter.warnings.map((w) => w.message),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('pnpm validate on an add-on pack', () => {
  it('accepts values added to open enums and options added to choices, named in the add-ons', () => {
    const { errors, warnings } = validateAddon();
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('rejects additions to a closed enum, a non-enum and a pack it does not depend on', () => {
    const { errors } = validateAddon({
      'rules/core.yaml': [
        'extendEnums:',
        "  'test-core:types.weapon.fields.reach': [touch]",
        "  'test-core:types.class.fields.level': [one]",
        "  'other:fields.mood': [giddy]",
        "  'test-core:types.weapon.fields.damageType': [sonic]",
        "  'test-core:types.weapon.state.edge': [humming]",
        "  'test-core:fields.stance': [floating]",
      ].join('\n'),
    });
    expect(errors.filter((m) => m.includes('invalid-extension'))).toHaveLength(3);
  });

  it('needs a name for an added state value, and checks content against the merged list', () => {
    const { errors } = validateAddon({
      'i18n/en.yaml': [
        "pack.name: 'Test add-on'",
        "fields.stance.values.floating.name: 'Floating'",
        "classes.alchemist.name: 'Alchemist'",
        "weapons.tuning-fork.name: 'Tuning fork'",
      ].join('\n'),
      'content/weapons/tuning-fork.yaml':
        'id: weapons.tuning-fork\ntype: weapon\nfields: { damageType: cosmic }\n',
    });
    expect(errors).toContain(
      'missing translation key "types.weapon.state.edge.values.humming.name"',
    );
    expect(errors.some((m) => /damageType: expected one of blunt, edged, sonic/.test(m))).toBe(
      true,
    );
  });

  it('rejects choice additions of another kind, to a missing choice, or reusing an option ID', () => {
    const { errors } = validateAddon({
      'rules/core.yaml': [
        'extendChoices:',
        "  'test-core:classes.warden':",
        '    oath: { values: [storm] }',
        '    vow: { items: [oaths.storm] }',
        '    knack: { options: [{ id: tracking }] }',
        "  'test-core:classes.nobody':",
        '    oath: { items: [oaths.storm] }',
        "  'test-addon-two:rules':",
        '    boon: { values: [grace] }',
      ].join('\n'),
    });
    const has = (pattern: RegExp) =>
      expect(
        errors.some((m) => pattern.test(m)),
        errors.join('\n'),
      ).toBe(true);
    has(/warden oath: invalid-extension: the choice doesn't take values/);
    has(/warden vow: invalid-extension: no such choice/);
    has(/warden knack: duplicate option id "tracking"/);
    has(/unknown content "test-core:classes.nobody"/);
    has(/test-addon-two:rules: invalid-extension: test-addon-two is not a dependency/);
  });

  it('needs a name for an added inline option, and lets the rules add options to steps', () => {
    const { errors } = validateAddon({
      'i18n/en.yaml': [
        "pack.name: 'Test add-on'",
        "fields.hexes.name: 'Hexes'",
        "fields.hexPower.name: 'Hex power'",
        "fields.stance.values.floating.name: 'Floating'",
        "types.weapon.state.edge.values.humming.name: 'Humming'",
        "classes.alchemist.name: 'Alchemist'",
        "weapons.tuning-fork.name: 'Tuning fork'",
        "oaths.storm.name: 'Storm oath'",
        "actions.strike.params.mode.values.feint.name: 'Feint'",
        "weapons.club.state.grip.values.none.name: 'Bare'",
      ].join('\n'),
    });
    expect(errors.toSorted()).toEqual([
      'missing translation key "classes.warden.choices.knack.options.hexing.name"',
      'missing translation key "rules.options.meditate.name"',
    ]);
  });

  it("needs names for values added to an action's parameter and an item's own state key", () => {
    const { errors, warnings } = validateAddon({
      'i18n/en.yaml': [
        "pack.name: 'Test add-on'",
        "fields.hexes.name: 'Hexes'",
        "fields.hexPower.name: 'Hex power'",
        "fields.stance.values.floating.name: 'Floating'",
        "types.weapon.fields.damageType.values.sonic.name: 'Sonic'",
        "types.weapon.state.edge.values.humming.name: 'Humming'",
        "classes.alchemist.name: 'Alchemist'",
        "weapons.tuning-fork.name: 'Tuning fork'",
        "oaths.storm.name: 'Storm oath'",
        "classes.warden.choices.knack.options.hexing.name: 'Hexing'",
        "rules.options.meditate.name: 'Meditate'",
        "actions.pick-ward.options.storm.name: 'Storm'",
      ].join('\n'),
    });
    expect(errors.toSorted()).toEqual([
      'missing translation key "actions.strike.params.mode.values.feint.name"',
      'missing translation key "weapons.club.state.grip.values.none.name"',
    ]);
    // A family key's name under the core action's values step belongs to the add-on.
    expect(warnings.filter((w) => w.includes('pick-ward'))).toEqual([]);
  });

  it('rejects additions to a closed parameter or item state key, and open view fields of no open enum', () => {
    const { errors } = validateAddon({
      'rules/core.yaml': [
        'extendEnums:',
        "  'test-core:actions.train.params.mode': [feint]",
        "  'test-core:oaths.iron.state.grip': [none]",
        'actions:',
        '  - id: gauge',
        '    results: [gauged]',
        '    participants:',
        '      target: { fields: { stamina: { type: enum, values: [low], open: true } } }',
        '    steps:',
        '      - { id: result, kind: outcome, result: "\'gauged\'" }',
      ].join('\n'),
    });
    expect(
      errors.filter((m) => m.includes('invalid-extension')),
      errors.join('\n'),
    ).toHaveLength(2);
    expect(errors.some((m) => /"stamina": open follows an open enum field/.test(m))).toBe(true);
  });
});

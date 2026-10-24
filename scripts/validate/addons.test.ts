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
  it('accepts values added to open enums, named in the add-on', () => {
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
});

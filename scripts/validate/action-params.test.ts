import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateRepo } from './index.ts';

const pack = fileURLToPath(
  new URL('../../packages/spec/tests/packs/test-action-params', import.meta.url),
);

/** The suite's action-params pack as a repo, with `edit` applied to its files. */
function validate(edit: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ocf-validate-params-'));
  try {
    const dir = join(root, 'packs', 'test', 'action-params');
    cpSync(pack, dir, { recursive: true });
    for (const [file, text] of Object.entries(edit)) writeFileSync(join(dir, file), text);
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

const added = (errors: string[]) => errors.filter((m) => m.startsWith('invalid-added-param'));

describe('pnpm validate on params effects, computed action tags and a use with available', () => {
  it('accepts the pack', () => {
    expect(validate()).toEqual({ errors: [], warnings: [] });
  });

  it("needs each added parameter's text, and its enum values'", () => {
    const { errors } = validate({
      'content/abilities/hurl-element.yaml': [
        'id: abilities.hurl-element',
        'type: ability',
        'effects:',
        '  - target: { actions: [ability], from: self }',
        '    op: params',
        '    value:',
        '      shape: { type: enum, values: [cone, line], default: cone }',
      ].join('\n'),
    });
    expect(errors.filter((m) => m.includes('abilities.hurl-element.params.shape'))).toHaveLength(3);
  });

  it("rejects from: self on the rules' params effects", () => {
    const { errors } = validate({
      'rules/extra.yaml': [
        'effects:',
        '  - target: { actions: [turn], from: self }',
        '    op: params',
        '    value: { rested: { type: boolean, default: false } }',
      ].join('\n'),
    });
    expect(errors.some((m) => m.includes('from: self'))).toBe(true);
  });

  it('reports the conflicting added parameters loadRuleset reports', () => {
    // Another declaration of psi-boost's `boost`, over a tag actions carry only through formulas.
    const { errors } = validate({
      'content/features/surge-boost.yaml': [
        'id: features.surge-boost',
        'type: feature',
        'effects:',
        '  - target: { actions: [kw.psionic] }',
        '    op: params',
        '    value:',
        '      boost: { type: integer, default: 0 }',
      ].join('\n'),
    });
    expect(added(errors)).toEqual([
      'invalid-added-param: test-action-params:features.surge-boost and test-action-params:features.psi-boost both add the parameter "boost", declared differently.',
    ]);
    // Another ability's `from: self` element, with its own values: never on one run.
    const own = validate({
      'content/abilities/mind-spike.yaml': [
        'id: abilities.mind-spike',
        'type: ability',
        'tags: [kw.psionic]',
        'fields: { usage: maneuver, damage: 2 }',
        'effects:',
        '  - target: { actions: [ability], from: self }',
        '    op: params',
        '    value:',
        '      element: { type: enum, values: [psychic], default: psychic }',
      ].join('\n'),
    });
    expect(added(own.errors)).toEqual([]);
  });
});

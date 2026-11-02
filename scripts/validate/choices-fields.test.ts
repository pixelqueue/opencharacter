import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateRepo } from './index.ts';

const pack = fileURLToPath(
  new URL('../../packages/spec/tests/packs/test-action-params', import.meta.url),
);
const core = readFileSync(join(pack, 'rules', 'core.yaml'), 'utf8');
const i18n = readFileSync(join(pack, 'i18n', 'en.yaml'), 'utf8');

/**
 * The suite's action-params pack as a repo: its features gain a list of integers and a choice,
 * the memory feature adds an unchoose to the turn step, and `edit` is applied to its files.
 */
function validate(edit: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ocf-validate-choices-'));
  try {
    const dir = join(root, 'packs', 'test', 'action-params');
    cpSync(pack, dir, { recursive: true });
    const files: Record<string, string> = {
      'rules/core.yaml': core.replace(
        '      limit: { type: integer, default: 0 }',
        '      limit: { type: integer, default: 0 }\n      array: { type: list, of: integer, default: [0, 1] }',
      ),
      'i18n/en.yaml': [
        i18n,
        "types.feature.fields.array.name: 'Array'",
        "features.memory.name: 'Memory'",
        "features.memory.choices.skill.prompt: 'Choose a skill'",
      ].join('\n'),
      'content/features/memory.yaml': [
        'id: features.memory',
        'type: feature',
        'fields: { array: [2, -1, -1] }',
        'choices:',
        '  - id: skill',
        '    required: false',
        '    from: { values: [lore, magic] }',
        'effects:',
        '  - target: { steps: [turn] }',
        '    op: changes',
        '    value:',
        '      changes: [{ type: unchoose, choice: { owner: self, id: skill } }]',
      ].join('\n'),
      ...edit,
    };
    for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
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

describe('pnpm validate on lists of integers and unchoose by owner', () => {
  it('accepts a list of integers and an unchoose of its own choice', () => {
    expect(validate()).toEqual({ errors: [], warnings: [] });
  });

  it('rejects a member of a list of integers that is not a whole number', () => {
    const { errors } = validate({
      'content/features/appeal.yaml': [
        'id: features.appeal',
        'type: feature',
        'fields: { array: [1, two] }',
      ].join('\n'),
    });
    expect(errors.some((m) => m.includes('expected a list of integers'))).toBe(true);
  });

  it("rejects owner: self on the rules' changes, and a choice self doesn't declare", () => {
    const { errors } = validate({
      'rules/extra.yaml': [
        'effects:',
        '  - target: { steps: [turn] }',
        '    op: changes',
        '    value:',
        '      changes: [{ type: unchoose, choice: { owner: self, id: skill } }]',
      ].join('\n'),
      'content/features/appeal.yaml': [
        'id: features.appeal',
        'type: feature',
        'effects:',
        '  - target: { steps: [turn] }',
        '    op: changes',
        '    value:',
        '      changes:',
        '        - { type: unchoose, choice: { owner: self, id: skill } }',
        '        - { type: unchoose, choice: { owner: features.memory, id: nothing } }',
      ].join('\n'),
    });
    expect(errors.filter((m) => m.includes('owner: self is for content'))).toHaveLength(1);
    expect(errors.filter((m) => m.includes('"features.appeal" declares no choice'))).toHaveLength(
      1,
    );
    expect(errors.filter((m) => m.includes('"features.memory" declares no choice'))).toHaveLength(
      1,
    );
  });
});

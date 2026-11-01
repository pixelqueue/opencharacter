import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateRepo } from './index.ts';

const pack = 'packs/test/reach';

/** A one-pack repo (`test-reach`) from its files, validated with its characters. */
function validate(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'ocf-validate-reach-'));
  try {
    const all: Record<string, string> = {
      [`${pack}/pack.yaml`]: [
        'id: test-reach',
        'version: 0.1.0',
        'specVersion: 0.3.0',
        'license: CC0-1.0',
        'defaultLanguage: en',
      ].join('\n'),
      [`${pack}/i18n/en.yaml`]: '{}',
      ...files,
    };
    for (const [file, text] of Object.entries(all)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), text);
    }
    mkdirSync(join(root, 'characters'), { recursive: true });
    const { reporter } = validateRepo(root, {
      packs: join(root, 'packs'),
      characters: join(root, 'characters'),
      exports: join(root, 'exports'),
      pending: new Map(),
    });
    // Text is beside the point here.
    return reporter.errors
      .filter((e) => !e.file.includes('/i18n/'))
      .map((e) => `${e.file}: ${e.message}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('pnpm validate on content reaching shared definitions', () => {
  it("expands the family keys of a view-field set a content action's role names", () => {
    const errors = validate({
      [`${pack}/rules/core.yaml`]: [
        'families:',
        '  trait: [might, agility]',
        'fields:',
        "  'traits.{trait}.score': { type: integer, input: true, default: 0 }",
        'viewFields:',
        '  creature:',
        "    'traits.{trait}.score': { type: integer, default: 0 }",
        'contentTypes:',
        '  feature: {}',
      ].join('\n'),
      [`${pack}/content/features/poke.yaml`]: [
        'id: features.poke',
        'type: feature',
        'actions:',
        '  - id: poke',
        '    participants: { target: { max: 1, fields: creature } }',
        '    results: [done]',
        '    steps:',
        '      - id: done',
        '        kind: outcome',
        `        result: "'done'"`,
        `        data: { might: "participants.target[0].traits.might.score" }`,
      ].join('\n'),
    });
    expect(errors).toEqual([]);
  });
});

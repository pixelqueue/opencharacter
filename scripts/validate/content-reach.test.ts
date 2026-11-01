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

/** Rules with a `swing` action whose step content adds to, and a `recover` follow-up. */
const swingRules = [
  'tags: [swing]',
  'fields:',
  '  swings: { type: integer, input: true, default: 0 }',
  'contentTypes:',
  '  charm: { carried: true }',
  'actions:',
  '  - id: steady',
  '    results: [steady]',
  `    steps: [{ id: result, kind: outcome, result: "'steady'" }]`,
  '  - id: swing',
  '    steps:',
  '      - id: hit',
  '        kind: changes',
  '        tags: [swing]',
  '        changes: [{ type: adjust, field: swings, by: 1 }]',
  'followUps:',
  '  - { id: recover, action: steady }',
].join('\n');

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

  it("accepts content's added changes offering the rules' follow-up", () => {
    const errors = validate({
      [`${pack}/rules/core.yaml`]: swingRules,
      [`${pack}/content/charms/ember.yaml`]: [
        'id: charms.ember',
        'type: charm',
        'effects:',
        '  - target: { steps: [swing] }',
        '    op: changes',
        '    value: { changes: [{ type: offerFollowUp, followUp: recover }] }',
        '  - target: { steps: [swing] }',
        '    op: changes',
        '    value: { changes: [{ type: offerFollowUp, followUp: nowhere }] }',
      ].join('\n'),
    });
    expect(errors).toEqual([
      `${pack}/content/charms/ember.yaml: charms.ember effect: offers unknown follow-up "nowhere"`,
    ]);
  });

  it("resolves an add-on's offered follow-ups against the action's pack, or the pack it names", () => {
    const addon = 'packs/test/addon';
    const errors = validate({
      [`${pack}/rules/core.yaml`]: swingRules,
      [`${addon}/pack.yaml`]: [
        'id: test-addon',
        'version: 0.1.0',
        'specVersion: 0.3.0',
        'license: CC0-1.0',
        'defaultLanguage: en',
        'dependencies: { test-reach: ^0.1.0 }',
      ].join('\n'),
      [`${addon}/i18n/en.yaml`]: '{}',
      [`${addon}/content/charms/spark.yaml`]: [
        'id: charms.spark',
        'type: charm',
        'effects:',
        '  - target: { steps: [swing] }',
        '    op: changes',
        '    value:',
        '      changes:',
        '        - { type: offerFollowUp, followUp: recover }',
        "        - { type: offerFollowUp, followUp: 'test-reach:recover' }",
        "        - { type: offerFollowUp, followUp: 'test-addon:recover' }",
      ].join('\n'),
    });
    expect(errors).toEqual([
      `${addon}/content/charms/spark.yaml: charms.spark effect: offers unknown follow-up "test-addon:recover"`,
    ]);
  });

  it('accepts saved picks of content a computed grant gives, and only a choice it has', () => {
    const errors = validate({
      [`${pack}/rules/core.yaml`]: [
        'contentTypes:',
        '  class: {}',
        '  domain: {}',
        '  feature: {}',
        '  skill: {}',
      ].join('\n'),
      [`${pack}/content/classes/censor.yaml`]: [
        'id: classes.censor',
        'type: class',
        'choices:',
        '  - { id: domain, from: { type: domain } }',
        'grants:',
        `  - forEach: "picksOf('domain')"`,
        `    item: { formula: "x == 'test-reach:domains.war' ? 'features.sanctified' : 'features.plain'" }`,
      ].join('\n'),
      [`${pack}/content/domains/war.yaml`]: 'id: domains.war\ntype: domain',
      [`${pack}/content/features/sanctified.yaml`]: [
        'id: features.sanctified',
        'type: feature',
        'choices:',
        '  - { id: skill, from: { type: skill } }',
      ].join('\n'),
      [`${pack}/content/features/plain.yaml`]: 'id: features.plain\ntype: feature',
      [`${pack}/content/skills/alertness.yaml`]: 'id: skills.alertness\ntype: skill',
      'characters/veyra.yaml': [
        'specVersion: 0.3.0',
        'id: veyra',
        'packs:',
        '  - { id: test-reach, version: 0.1.0 }',
        'features:',
        '  - id: censor',
        '    item: test-reach:classes.censor',
        '    choices:',
        '      domain: [{ option: test-reach:domains.war }]',
        "      'test-reach:features.sanctified/skill': [{ option: test-reach:skills.alertness }]",
        "      'test-reach:features.plain/skill': [{ option: test-reach:skills.alertness }]",
        "      'test-reach:features.sanctified/nope': [{ option: test-reach:skills.alertness }]",
      ].join('\n'),
    });
    expect(errors).toEqual([
      'characters/veyra.yaml: features[censor].choices.test-reach:features.plain/skill: no such choice here',
      'characters/veyra.yaml: features[censor].choices.test-reach:features.sanctified/nope: no such choice here',
    ]);
  });

  it('accepts saved picks of content a computed grant under a static grant gives', () => {
    const errors = validate({
      [`${pack}/rules/core.yaml`]: [
        'contentTypes:',
        '  class: {}',
        '  domain: {}',
        '  feature: {}',
        '  skill: {}',
      ].join('\n'),
      [`${pack}/content/classes/censor.yaml`]: [
        'id: classes.censor',
        'type: class',
        'choices:',
        '  - { id: domain, from: { type: domain } }',
        'grants:',
        '  - item: features.domains',
      ].join('\n'),
      // The class grants this feature, and the feature grants by formula.
      [`${pack}/content/features/domains.yaml`]: [
        'id: features.domains',
        'type: feature',
        'grants:',
        `  - item: { formula: "'features.sanctified'" }`,
      ].join('\n'),
      [`${pack}/content/domains/war.yaml`]: 'id: domains.war\ntype: domain',
      [`${pack}/content/features/sanctified.yaml`]: [
        'id: features.sanctified',
        'type: feature',
        'choices:',
        '  - { id: skill, from: { type: skill } }',
      ].join('\n'),
      [`${pack}/content/skills/alertness.yaml`]: 'id: skills.alertness\ntype: skill',
      'characters/veyra.yaml': [
        'specVersion: 0.3.0',
        'id: veyra',
        'packs:',
        '  - { id: test-reach, version: 0.1.0 }',
        'features:',
        '  - id: censor',
        '    item: test-reach:classes.censor',
        '    choices:',
        '      domain: [{ option: test-reach:domains.war }]',
        "      'test-reach:features.sanctified/skill': [{ option: test-reach:skills.alertness }]",
        "      'test-reach:features.sanctified/nope': [{ option: test-reach:skills.alertness }]",
      ].join('\n'),
    });
    expect(errors).toEqual([
      'characters/veyra.yaml: features[censor].choices.test-reach:features.sanctified/nope: no such choice here',
    ]);
  });
});

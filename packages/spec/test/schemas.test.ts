import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { fixedSetIds, loadFixedSet, loadSchemas, paths, SCHEMA_BASE } from '../src/node.ts';

function compileAll() {
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats.default(ajv);
  for (const schema of loadSchemas().values()) ajv.addSchema(schema);
  return ajv;
}

function enumAt(file: string, pointer: string[]): unknown[] {
  let node: unknown = loadSchemas().get(file);
  for (const key of pointer) node = (node as Record<string, unknown>)[key];
  return (node as { enum: unknown[] }).enum;
}

/** An incoming-change effect with `then`. */
function ward(scope: string | undefined, changes: object[]) {
  return {
    target: { incoming: { tags: ['damage'] } },
    op: 'add',
    value: '1',
    ...(scope ? { scope } : {}),
    // oxlint-disable-next-line unicorn/no-thenable
    then: changes,
  };
}

describe('schemas', () => {
  it('have $ids under the spec base URI that match their file paths', () => {
    for (const [path, schema] of loadSchemas()) {
      expect(schema.$id).toBe(`${SCHEMA_BASE}${path}`);
    }
  });

  it('all compile in strict mode', () => {
    const ajv = compileAll();
    const failures: string[] = [];
    for (const schema of loadSchemas().values()) {
      try {
        ajv.getSchema(schema.$id);
      } catch (error) {
        failures.push((error as Error).message);
      }
    }
    expect(failures).toEqual([]);
  });
});

/** A version as text that sorts as the version does. */
const versionKey = (id: string) =>
  id
    .split(/[.-]/)
    .map((n) => n.padStart(8, '0'))
    .join('.');

describe('fixed sets match the schemas', () => {
  const cases: [string, string, string[]][] = [
    ['effect-operations', 'effect.schema.json', ['properties', 'op']],
    ['roll-modifiers', 'effect.schema.json', ['$defs', 'rollModifier', 'properties', 'kind']],
    ['dice-modifiers', 'roll-item.schema.json', ['$defs', 'diceModifier', 'properties', 'type']],
    ['change-types', 'change.schema.json', ['properties', 'type']],
    ['stacking-policies', 'rules.schema.json', ['$defs', 'stackingPolicy']],
    ['upgrade-steps', 'upgrade.schema.json', ['$defs', 'step', 'properties', 'op']],
    ['value-types', 'common.schema.json', ['$defs', 'valueType']],
    ['rounding-modes', 'common.schema.json', ['$defs', 'rounding']],
    [
      'display-formats',
      'display.schema.json',
      ['$defs', 'fieldHints', 'properties', 'format', 'anyOf', '0'],
    ],
  ];
  it.each(cases)('%s', (set, file, pointer) => {
    expect(enumAt(file, pointer).toSorted()).toEqual(fixedSetIds(set).toSorted());
  });

  it('spec upgrades match spec-upgrade.schema.json, in version order', () => {
    const validate = compileAll().getSchema(`${SCHEMA_BASE}spec-upgrade.schema.json`);
    const items = loadFixedSet('spec-upgrades').items;
    for (const item of items) expect(validate?.(item), item.id).toBe(true);
    const ids = items.map((item) => versionKey(item.id));
    expect(ids).toEqual(ids.toSorted());
  });

  it('every error and rules-issue code has standard English text', () => {
    const en = parse(readFileSync(join(paths.i18n, 'en.yaml'), 'utf8')) as Record<string, string>;
    for (const code of fixedSetIds('error-codes')) expect(en).toHaveProperty([`errors.${code}`]);
    for (const code of fixedSetIds('rules-issue-codes'))
      expect(en).toHaveProperty([`issues.${code}`]);
  });

  it('every roll summary comparison code has standard English text', () => {
    const en = parse(readFileSync(join(paths.i18n, 'en.yaml'), 'utf8')) as Record<string, string>;
    const codes = enumAt('engine/action-run.schema.json', [
      '$defs',
      'rollTest',
      'properties',
      'compare',
    ]);
    expect(codes.length).toBe(5);
    for (const code of codes) expect(en[`compare.${code}`]).toContain('{value}');
  });

  it('every dice modifier has standard English text', () => {
    const en = parse(readFileSync(join(paths.i18n, 'en.yaml'), 'utf8')) as Record<string, string>;
    for (const id of fixedSetIds('dice-modifiers')) expect(en).toHaveProperty([`dice.${id}`]);
    for (const key of ['dice', 'fate', 'modified', 'plus', 'minus', 'negative', 'repeat'])
      expect(en).toHaveProperty([`dice.${key}`]);
  });
});

const appliedGroup = (kind: string, type: string) => ({
  id: 'g',
  kind,
  members: { type, from: 'applied' },
});

const partEffect = (value: unknown) => ({
  target: { rolls: ['damage'], parts: ['weapon'] },
  op: 'rollModifier',
  value,
});

describe('display, template and change shapes', () => {
  const ajv = compileAll();
  const valid = (ref: string, data: unknown) => {
    const validate = ajv.getSchema(`${SCHEMA_BASE}${ref}`);
    if (!validate) throw new Error(`no schema ${ref}`);
    return validate(data) as boolean;
  };

  it('lets only a content group list applied entries', () => {
    expect(valid('display.schema.json#/$defs/group', appliedGroup('content', 'condition'))).toBe(
      true,
    );
    expect(valid('display.schema.json#/$defs/group', appliedGroup('fields', 'field'))).toBe(false);
  });

  it('takes a visibility on groups, fields and state keys, never with hidden', () => {
    expect(valid('display.schema.json#/$defs/group', { id: 'g', visibility: 'background' })).toBe(
      true,
    );
    expect(valid('display.schema.json#/$defs/group', { id: 'g', visibility: 'minor' })).toBe(false);
    const field = 'display.schema.json#/$defs/fieldHints';
    expect(valid(field, { visibility: 'primary', priority: 0 })).toBe(true);
    expect(valid(field, { visibility: 'background', hidden: false })).toBe(true);
    expect(valid(field, { visibility: 'background', hidden: true })).toBe(false);
    const state = 'display.schema.json#/$defs/stateHints';
    expect(valid(state, { visibility: 'secondary' })).toBe(true);
    expect(valid(state, { visibility: 'secondary', hidden: true })).toBe(false);
  });

  it('takes a field roll list with literal params', () => {
    const field = 'display.schema.json#/$defs/fieldHints';
    const check = { action: 'ability-check', params: { ability: 'int' } };
    expect(valid(field, { rolls: [check, { action: '5e-srd-5.1:saving-throw' }] })).toBe(true);
    expect(valid(field, { rolls: [] })).toBe(false);
    expect(valid(field, { rolls: [{ params: { ability: 'int' } }] })).toBe(false);
    expect(valid(field, { rolls: [{ ...check, params: { ability: { formula: 'x' } } }] })).toBe(
      false,
    );
    expect(valid(field, { rolls: [{ ...check, tags: ['x'] }] })).toBe(false);
  });

  it('takes companions on fields and state keys, never with hidden', () => {
    const field = 'display.schema.json#/$defs/fieldHints';
    const mod = { field: 'abilities.str.mod', as: 'modifier' };
    expect(valid(field, { with: [mod, { field: 'x.max', as: 'max' }] })).toBe(true);
    expect(valid(field, { with: [{ ...mod, as: 'total' }] })).toBe(false);
    expect(valid(field, { with: [] })).toBe(false);
    expect(valid(field, { with: [mod], hidden: true })).toBe(false);
    const state = 'display.schema.json#/$defs/stateHints';
    expect(valid(state, { with: [{ key: 'hitDiceSpent', as: 'detail' }] })).toBe(true);
    expect(valid(state, { with: [{ field: 'hp.max', as: 'max' }] })).toBe(false);
  });

  it('lets only a template give a field null', () => {
    const template = { id: 't', type: 'template', appliesTo: { type: 'armor' } };
    expect(valid('content-item.schema.json', { ...template, fields: { strength: null } })).toBe(
      true,
    );
    expect(
      valid('content-item.schema.json', { id: 'a', type: 'armor', fields: { strength: null } }),
    ).toBe(false);
  });

  it("lets only an applied incoming-change effect's then remove its entry", () => {
    const remove = [{ type: 'removeEffect', entry: 'self' }];
    const set = [{ type: 'setState', entry: 'self', key: 'k', value: '1' }];
    expect(valid('effect.schema.json', ward('applied', remove))).toBe(true);
    expect(valid('effect.schema.json', ward('applied', set))).toBe(true);
    expect(valid('effect.schema.json', ward('holder', set))).toBe(true);
    expect(valid('effect.schema.json', ward('holder', remove))).toBe(false);
    expect(valid('effect.schema.json', ward(undefined, remove))).toBe(false);
    expect(valid('effect.schema.json', ward('applied', [{ ...remove[0], key: 'k' }]))).toBe(false);
    expect(
      valid('effect.schema.json', ward('applied', [{ type: 'setState', entry: 'self' }])),
    ).toBe(false);
  });

  it('takes a formula naming a field as an effect target, for field ops only', () => {
    const target = { formula: "'lore.' + pick.value" };
    expect(valid('effect.schema.json', { target, op: 'add', value: 1 })).toBe(true);
    expect(valid('effect.schema.json', { target, op: 'grant', value: { formula: 'x' } })).toBe(
      true,
    );
    const modifier = { kind: 'advantage' };
    expect(valid('effect.schema.json', { target, op: 'rollModifier', value: modifier })).toBe(
      false,
    );
    expect(valid('effect.schema.json', { target: { formula: 'x', fields: {} }, op: 'add' })).toBe(
      false,
    );
  });

  it("lets advantage and disadvantage on a roll's parts say only of: roll", () => {
    expect(valid('effect.schema.json', partEffect({ kind: 'advantage', of: 'roll' }))).toBe(true);
    expect(valid('effect.schema.json', partEffect({ kind: 'disadvantage', of: 'roll' }))).toBe(
      true,
    );
    expect(valid('effect.schema.json', partEffect({ kind: 'advantage' }))).toBe(false);
    expect(valid('effect.schema.json', partEffect({ kind: 'advantage', of: 'die' }))).toBe(false);
    expect(valid('effect.schema.json', partEffect({ kind: 'reroll', below: 1 }))).toBe(false);
  });

  it('lets unchoose leave out its option, but not choose', () => {
    const path = { entry: 'x', choice: ['form'] };
    expect(valid('change.schema.json', { type: 'unchoose', path })).toBe(true);
    expect(valid('change.schema.json', { type: 'choose', path })).toBe(false);
  });

  it('lets a proposed change compute equipped, a template and picks', () => {
    const proposed = 'change.schema.json#/$defs/proposed';
    expect(valid(proposed, { type: 'equip', entry: 'self', equipped: 'true' })).toBe(true);
    expect(valid(proposed, { type: 'applyTemplate', entry: 'picked', template: "'t'" })).toBe(true);
    expect(
      valid(proposed, {
        type: 'addItem',
        entry: { item: "'x'", choices: { spell: [{ option: { formula: 'x' } }] } },
      }),
    ).toBe(true);
    expect(valid('change.schema.json', { type: 'equip', entry: 'a', equipped: 'true' })).toBe(
      false,
    );
  });
});

describe('field tag and held-change shapes', () => {
  const ajv = compileAll();
  const valid = (ref: string, data: unknown) => {
    const validate = ajv.getSchema(`${SCHEMA_BASE}${ref}`);
    if (!validate) throw new Error(`no schema ${ref}`);
    return validate(data) as boolean;
  };
  const step = (data: unknown) => valid('action.schema.json#/$defs/step', data);

  it('lets a field tag be a formula', () => {
    const field = { type: 'integer', tags: ['dc', { formula: "'attr.' + key" }] };
    expect(valid('field.schema.json', field)).toBe(true);
  });

  it('lets a changes step release held changes, with or without its own, not per participant', () => {
    const release = { steps: ['strike'], where: "!('attack-count' in change.tags)" };
    const changes = [{ type: 'adjust', field: 'x', by: 1 }];
    expect(step({ id: 'a', kind: 'changes', release })).toBe(true);
    expect(step({ id: 'a', kind: 'changes', release, changes })).toBe(true);
    expect(step({ id: 'a', kind: 'changes' })).toBe(false);
    expect(step({ id: 'a', kind: 'changes', release, each: 'target' })).toBe(false);
  });

  it('lets an action step hold, but not a handoff', () => {
    expect(step({ id: 'a', kind: 'action', use: 'strike', hold: true })).toBe(true);
    expect(
      step({ id: 'a', kind: 'action', use: 'save', each: 'target', as: 'participant', hold: true }),
    ).toBe(false);
  });
});

/** A URL of the given length. */
function url(length: number) {
  const base = 'https://example.com/characters/';
  return base + 'a'.repeat(length - base.length);
}

describe('character IDs and extensions', () => {
  const ajv = compileAll();
  const valid = (ref: string, data: unknown) => {
    const validate = ajv.getSchema(`${SCHEMA_BASE}${ref}`);
    if (!validate) throw new Error(`no schema ${ref}`);
    return validate(data) as boolean;
  };
  const character = (extra: object) =>
    valid('character.schema.json', {
      specVersion: '0.1.0',
      id: 'c1',
      packs: [{ id: 'p', version: '0.1.0' }],
      ...extra,
    });
  const ext = (value: unknown) => character({ extensions: { 'com.example.vtt': value } });

  it('takes a URL of up to 2048 characters as a character, link or view ID', () => {
    expect(character({ id: url(2048) })).toBe(true);
    expect(character({ id: url(2049) })).toBe(false);
    expect(character({ links: { 'p:crew': url(2048) } })).toBe(true);
    expect(character({ links: { 'p:crew': url(2049) } })).toBe(false);
    const view = 'engine/compute-sheet.schema.json#/$defs/view';
    expect(valid(view, { id: url(2048) })).toBe(true);
    expect(valid(view, { id: url(2049) })).toBe(false);
  });

  it('lets an object extension carry a $schema URI, and leaves other values as they were', () => {
    expect(ext({ $schema: 'https://example.com/ocf/vtt-extension/1.json', tokenSize: 2 })).toBe(
      true,
    );
    expect(ext({ $schema: 'not a uri' })).toBe(false);
    expect(ext({ $schema: 2 })).toBe(false);
    expect(ext({ tokenSize: 2 })).toBe(true);
    expect(ext('a string')).toBe(true);
    expect(ext([1, 2])).toBe(true);
    expect(ext(null)).toBe(true);
  });
});

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applyChanges,
  buildRelease,
  computeSheet,
  loadRuleset,
  startAction,
} from '../src/index.ts';
import type { CharacterDoc, PackSource } from '../src/index.ts';
import { readPack } from './packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const loaded = loadRuleset([readPack(`${root}packages/spec/tests/packs/test-per-copy`)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const character = (features: NonNullable<CharacterDoc['features']>): CharacterDoc => ({
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'test-per-copy', version: '0.1.0' }],
  features,
});
const custom = 'test-per-copy:stunts.custom';

describe('per-copy item fields', () => {
  it('bound state by the copy’s own value', () => {
    const c = character([{ id: 's', item: custom, fields: { bonus: 1 } }]);
    const over = applyChanges(ruleset, c, [
      { type: 'setState', entry: 's', key: 'uses', value: 2 },
    ]);
    expect(over.ok ? [] : over.errors.map((e) => e.code)).toEqual(['out-of-range']);
    const raised = applyChanges(ruleset, c, [
      { type: 'setField', entry: 's', key: 'bonus', value: 3 },
      { type: 'setState', entry: 's', key: 'uses', value: 2 },
    ]);
    expect(raised.ok).toBe(true);
  });

  it('report a saved value of the wrong type and leave it out', () => {
    const sheet = computeSheet(
      ruleset,
      character([{ id: 's', item: custom, fields: { bonus: 'many' } }]),
    );
    expect(sheet.errors).toMatchObject([
      { code: 'wrong-type', path: '/features/0/fields/bonus', data: { entry: 's' } },
    ]);
    expect(sheet.values['test-per-copy:stunts.bonus']?.value).toBe(2);
    expect(sheet.templated).toEqual([]);
  });

  it('a standard copy with own values is saved', () => {
    const source = {
      manifest: {
        id: 'p',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: [
        {
          standardCopies: [{ type: 'stunt' }],
          contentTypes: { stunt: { fields: { mark: { type: 'string', perCopy: true } } } },
        },
      ],
      content: [{ id: 'stunts.base', type: 'stunt' }],
    } as unknown as PackSource;
    const set = loadRuleset([buildRelease(source)]);
    if (!set.ok) throw new Error(JSON.stringify(set.errors));
    const c: CharacterDoc = {
      specVersion: '0.1.0',
      id: 'c',
      packs: [{ id: 'p', version: '1.0.0' }],
    };
    const one = applyChanges(set.ruleset, c, [
      { type: 'setField', entry: 'p-stunts-base', key: 'mark', value: 'x' },
    ]);
    if (!one.ok) throw new Error(JSON.stringify(one.errors));
    expect(one.character.features).toEqual([
      { id: 'p-stunts-base', item: 'p:stunts.base', fields: { mark: 'x' } },
    ]);
    const back = applyChanges(set.ruleset, one.character, [
      { type: 'setField', entry: 'p-stunts-base', key: 'mark', value: null },
    ]);
    expect(back.ok && back.character.features).toEqual([]);
  });

  it('an action proposes setField on its own copy', () => {
    const source = {
      manifest: {
        id: 'p',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: [
        {
          contentTypes: {
            stunt: {
              fields: { limit: { type: 'enum', values: ['none', 'scene'], perCopy: true } },
              actions: [
                {
                  id: 'shape',
                  steps: [
                    {
                      id: 'set',
                      kind: 'changes',
                      to: 'self',
                      changes: [
                        { type: 'setField', entry: 'self', key: 'limit', value: "'scene'" },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
      content: [{ id: 'stunts.custom', type: 'stunt' }],
    } as unknown as PackSource;
    const set = loadRuleset([buildRelease(source)]);
    if (!set.ok) throw new Error(JSON.stringify(set.errors));
    const c: CharacterDoc = {
      specVersion: '0.1.0',
      id: 'c',
      packs: [{ id: 'p', version: '1.0.0' }],
      features: [{ id: 's', item: 'p:stunts.custom' }],
    };
    const run = startAction(set.ruleset, c, {
      action: { id: 'p:stunts.custom#shape', entry: 's' },
    });
    if (!('status' in run) || run.status !== 'finished') throw new Error(JSON.stringify(run));
    expect(run.proposedChanges.map((p) => p.change)).toEqual([
      { type: 'setField', entry: 's', key: 'limit', value: 'scene' },
    ]);
  });
});

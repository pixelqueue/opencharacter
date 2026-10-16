import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  applyChanges,
  computeSheet,
  continueAction,
  diceFrom,
  listOptions,
  loadRuleset,
  startAction,
  upgrade,
} from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';
import { readPack } from './packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const mothership = readPack(`${root}packs/mothership/1e`);
const loaded = loadRuleset([mothership]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;

const homebrew = {
  defaultLanguage: 'en',
  content: [
    {
      id: 'gear.blaster',
      type: 'weapon',
      fields: { damage: '2d10', magazine: 12, range: 'long', woundType: 'fire' },
    },
    { id: 'skills.xenoarchaeology', type: 'skill', fields: { tier: 'trained' } },
    {
      id: 'skills.ruin-diving',
      type: 'skill',
      fields: { tier: 'expert' },
      prerequisites: [{ id: 'skill', when: "'homebrew:skills.xenoarchaeology' in skills.known" }],
    },
  ],
  i18n: { en: { 'gear.blaster.name': 'Blaster' } },
};

const character = (extra: Record<string, unknown> = {}): CharacterDoc =>
  ({
    specVersion: '0.1.0',
    id: 'okafor',
    packs: [{ id: 'mothership-1e', version: '0.1.0' }],
    values: { 'mothership-1e:stats.combat': 41 },
    features: [
      {
        id: 'class',
        item: 'mothership-1e:classes.marine',
        choices: {
          'bonus-skills': [
            {
              option: 'trained',
              choices: {
                trained: [
                  { option: 'homebrew:skills.xenoarchaeology' },
                  { option: 'mothership-1e:skills.zero-g' },
                ],
              },
            },
          ],
        },
      },
    ],
    inventory: [
      { id: 'inv-1', item: 'homebrew:gear.blaster', equipped: true, state: { shots: 12 } },
    ],
    homebrew,
    ...extra,
  }) as CharacterDoc;

const errorsOf = (result: object) =>
  ((result as { errors?: unknown }).errors ?? []) as {
    code: string;
    path?: string;
    data?: Record<string, unknown>;
  }[];

describe('loading', () => {
  it('a homebrew weapon gets its type, state and actions', () => {
    const sheet = computeSheet(ruleset, character());
    expect(sheet.errors).toEqual([]);
    expect(sheet.actions).toContainEqual(
      expect.objectContaining({ action: 'mothership-1e:shoot', entry: 'inv-1' }),
    );
    const result = startAction(
      ruleset,
      character(),
      { action: { id: 'mothership-1e:shoot', entry: 'inv-1' } },
      diceFrom([20, 7, 8]),
    );
    expect(result).toMatchObject({ status: 'finished', outcome: { data: { damage: 15 } } });
  });

  it('a homebrew skill joins class picks and prerequisites', () => {
    const options = listOptions(ruleset, character(), {
      entry: 'class',
      choice: ['bonus-skills', 'trained', 'trained'],
    });
    expect(errorsOf(options)).toEqual([]);
    const ids = (options as { options: { option: string }[] }).options.map((o) => o.option);
    expect(ids).toContain('homebrew:skills.xenoarchaeology');
    const sheet = computeSheet(ruleset, character());
    const known = sheet.values['mothership-1e:skills.known']?.value as string[];
    expect(known).toContain('homebrew:skills.xenoarchaeology');
  });

  it('applyChanges adds homebrew content; the result keeps the homebrew', () => {
    const result = applyChanges(ruleset, character({ inventory: [] }), [
      { type: 'addItem', entry: { id: 'inv-2', item: 'homebrew:gear.blaster' } },
    ] as never);
    expect(errorsOf(result)).toEqual([]);
    expect(result.ok && result.character.homebrew).toEqual(homebrew);
  });

  it('continueAction loads the homebrew from the paused character', () => {
    const paused = startAction(ruleset, character(), {
      action: { id: 'mothership-1e:shoot', entry: 'inv-1' },
      policy: { dice: 'pause' },
    });
    expect(paused).toMatchObject({ status: 'paused' });
    const next = continueAction(ruleset, paused as never, { faces: [20] });
    expect(errorsOf(next)).toEqual([]);
  });

  it('a character without homebrew computes on the ruleset as given', () => {
    const sheet = computeSheet(ruleset, character({ homebrew: undefined, inventory: [] }));
    expect(sheet.errors).toEqual([]);
  });
});

const broken = (hb: unknown) => character({ homebrew: hb });

describe('errors', () => {
  it('an unknown type is homebrew-error with the load code as cause; nothing is computed', () => {
    const sheet = computeSheet(ruleset, broken({ content: [{ id: 'gear.ray', type: 'raygun' }] }));
    expect(sheet.values).toEqual({});
    expect(sheet.errors).toEqual([
      {
        code: 'homebrew-error',
        path: '/homebrew',
        data: {
          cause: 'unknown-reference',
          detail: { kind: 'content type', id: 'raygun', pack: 'homebrew' },
        },
      },
    ]);
  });

  it('a bad formula points into the character', () => {
    const errors = errorsOf(
      applyChanges(
        ruleset,
        broken({
          content: [
            { id: 'gear.ray', type: 'weapon', effects: [{ target: 'nope', op: 'add', value: 1 }] },
          ],
        }),
        [],
      ),
    );
    expect(errors.map((e) => [e.code, e.data?.['cause']])).toEqual([
      ['homebrew-error', 'unknown-reference'],
    ]);
    const formula = errorsOf(
      listOptions(
        ruleset,
        broken({
          content: [
            {
              id: 'gear.ray',
              type: 'weapon',
              prerequisites: [{ id: 'x', when: 'stats.nope > 1' }],
            },
          ],
        }),
        { choice: ['x'] },
      ),
    );
    expect(formula).toMatchObject([
      { code: 'homebrew-error', path: '/homebrew/content/0', data: { cause: 'formula-error' } },
    ]);
  });

  it('overrides and settings are homebrew-not-allowed', () => {
    const result = startAction(
      ruleset,
      broken({
        rules: { settings: { rounding: 'up' } },
        content: [{ override: 'mothership-1e:skills.geology', fields: { tier: 'master' } }],
      }),
      { action: { id: 'mothership-1e:shoot', entry: 'inv-1' } },
    );
    expect(errorsOf(result)).toEqual([
      {
        code: 'homebrew-error',
        path: '/homebrew/content/0',
        data: { cause: 'homebrew-not-allowed', detail: { property: 'override' } },
      },
      {
        code: 'homebrew-error',
        path: '/homebrew/rules/settings',
        data: { cause: 'homebrew-not-allowed', detail: { property: 'settings' } },
      },
    ]);
  });

  it('a homebrew over maxHomebrewItems is refused before loading', () => {
    const content = Array.from({ length: 501 }, (_x, i) => ({ id: `gear.g${i}`, type: 'weapon' }));
    expect(computeSheet(ruleset, broken({ content })).errors).toEqual([
      {
        code: 'homebrew-error',
        path: '/homebrew',
        data: { cause: 'safety-limit-exceeded', detail: { limit: 'maxHomebrewItems' } },
      },
    ]);
  });

  it('a homebrew over maxHomebrewFormulas is refused', () => {
    const constraints = Array.from({ length: 400 }, (_, i) => ({ id: `c${i}`, check: 'true' }));
    const content = Array.from({ length: 100 }, (_, i) => ({
      id: `gear.g${i}`,
      type: 'weapon',
      prerequisites: Array.from({ length: 20 }, (_y, j) => ({ id: `p${j}`, when: 'true' })),
    }));
    expect(computeSheet(ruleset, broken({ rules: { constraints }, content })).errors).toEqual([
      {
        code: 'homebrew-error',
        path: '/homebrew',
        data: { cause: 'safety-limit-exceeded', detail: { limit: 'maxHomebrewFormulas' } },
      },
    ]);
  });
});

describe('upgrade', () => {
  it('reports homebrew that no longer loads on the new ruleset, and still upgrades', () => {
    const next = structuredClone(mothership) as PackRelease;
    next.manifest = { ...next.manifest, version: '1.1.0' };
    const rules = { ...next.rules, contentTypes: { ...next.rules.contentTypes } };
    delete rules.contentTypes['weapon'];
    // The type's actions go with it.
    rules.actions = (rules.actions ?? []).filter((a) => a.id !== 'shoot' && a.id !== 'attack');
    if (rules.display) {
      const display = { ...rules.display };
      display.groups = (display.groups ?? []).filter((g) => g.id !== 'weapons');
      if (display.types) {
        display.types = { ...display.types };
        delete display.types['weapon'];
      }
      rules.display = display;
    }
    next.rules = rules;
    const to = loadRuleset([next]);
    if (!to.ok) throw new Error(JSON.stringify(to.errors));
    const result = upgrade(ruleset, to.ruleset, character());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.character.packs).toEqual([{ id: 'mothership-1e', version: '1.1.0' }]);
    expect(result.report.errors[0]).toMatchObject({
      code: 'homebrew-error',
      data: { cause: 'unknown-reference', detail: { id: 'weapon' } },
    });
  });

  it('refuses a character whose homebrew does not load on the old ruleset', () => {
    const result = upgrade(
      ruleset,
      ruleset,
      character({ homebrew: { content: [{ id: 'gear.ray', type: 'raygun' }] } as never }),
    );
    expect(result).toMatchObject({ ok: false, errors: [{ code: 'homebrew-error' }] });
  });
});

const read = (name: string) =>
  parse(readFileSync(`${root}examples/characters/${name}.yaml`, 'utf8')) as CharacterDoc;

describe('the example characters with homebrew', () => {
  it('Reyes (Mothership) computes cleanly with the blaster and both custom skills', () => {
    const sheet = computeSheet(ruleset, read('mothership-reyes'));
    expect(sheet.errors).toEqual([]);
    expect(sheet.values['mothership-1e:skills.known']?.value).toContain(
      'homebrew:skills.xenoarchaeology',
    );
  });

  it("Ash (FitD) gets the homebrew ability's stress box", () => {
    const blades = loadRuleset([readPack(`${root}packs/fitd/scoundrel`)]);
    if (!blades.ok) throw new Error(JSON.stringify(blades.errors));
    const sheet = computeSheet(blades.ruleset, read('fitd-ash'));
    expect(sheet.errors).toEqual([]);
    expect(sheet.values['fitd-scoundrel:stress.max']?.value).toBe(10);
  });
});

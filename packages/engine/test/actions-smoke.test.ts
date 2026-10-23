import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { applyChanges, continueAction, diceFrom, loadRuleset, startAction } from '../src/index.ts';
import { readPack } from './packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const loaded = loadRuleset([readPack(`${root}packs/5e/srd-5.1`)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;
const tamsin = parse(readFileSync(`${root}examples/characters/5e-tamsin.yaml`, 'utf8'));
const attack = { id: '5e-srd-5.1:weapon-attack', entry: 'inv-1' };

describe('weapon attack (Tamsin, longsword +1, Bless, Dueling)', () => {
  it('hits a known AC and proposes slashing damage for the target', () => {
    // attack: d20 15, Bless d4 2; damage: d8 6
    const result = startAction(
      ruleset,
      tamsin,
      { action: attack, params: { targetAc: 15 } },
      diceFrom([15, 2, 6]),
    );
    expect(result).toMatchObject({
      status: 'finished',
      outcome: { result: 'hit', data: { critical: false } },
    });
    if (!('status' in result) || result.status !== 'finished') return;
    // 15 + Str 4 + prof 2 + template 1 + Bless 2 = 24
    expect(result.log[0]).toMatchObject({ step: 'attack', total: 24 });
    // 6 + Str 4 + template 1 + Dueling 2 = 13 slashing
    expect(result.proposedChanges).toEqual([
      {
        to: 'target',
        step: 'deal',
        change: {
          type: 'adjust',
          field: '5e-srd-5.1:hp.current',
          by: -13,
          tags: [
            'damage',
            'attack',
            'weapon',
            'melee',
            'magical',
            'plain-material',
            'wielder.neutral',
            'damage.slashing',
          ],
        },
      },
    ]);
  });

  it('pauses to ask whether it hit when the target AC is unknown, then continues', () => {
    const dice = diceFrom([12, 3, 5]);
    const paused = startAction(ruleset, tamsin, { action: attack }, dice);
    expect(paused).toMatchObject({
      status: 'paused',
      needs: {
        kind: 'choice',
        step: 'hit/confirm',
        action: '5e-srd-5.1:weapon-attack',
        options: ['hit', 'miss'],
      },
    });
    if (!('status' in paused) || paused.status !== 'paused') return;
    const done = continueAction(ruleset, paused, { option: 'hit' }, undefined, dice);
    expect(done).toMatchObject({ status: 'finished', outcome: { result: 'hit' } });
  });

  it('doubles damage dice on a critical (19 with Improved Critical)', () => {
    // attack d20 19, Bless 1; damage 2d8 (doubled): 3, 4
    const result = startAction(
      ruleset,
      tamsin,
      { action: attack, params: { targetAc: 30 } },
      diceFrom([19, 1, 3, 4]),
    );
    if (!('status' in result) || result.status !== 'finished')
      throw new Error(JSON.stringify(result));
    expect(result.outcome).toMatchObject({ result: 'hit', data: { critical: true } });
    expect(result.proposedChanges[0]?.change).toMatchObject({
      type: 'adjust',
      by: -(3 + 4 + 4 + 1 + 2),
    });
  });
});

describe('loadRuleset and compiled formulas', () => {
  it('refuses a release whose compiled tree does not match its formula text', () => {
    const pack = readPack(`${root}packs/5e/srd-5.1`);
    const tampered = {
      ...pack,
      formulas: { '1 + 2': { text: '1 + 2', tree: { type: 'int', value: 4 } } },
    };
    const result = loadRuleset([tampered]);
    expect(result.ok ? [] : result.errors.map((e) => e.code)).toEqual(['formula-error']);
  });
});

describe('monsters with innate spells', () => {
  const lists = ['innateOncePerDay', 'innateTwicePerDay', 'innateThricePerDay'];
  const spellsOf = (qid: string) =>
    lists.flatMap((name) => (ruleset.content[qid]?.fields?.[name] as string[] | undefined) ?? []);
  const monsters = Object.values(ruleset.content)
    .filter((item) => item.type === '5e-srd-5.1:monster' && spellsOf(item.qid).length > 0)
    .map((item) => item.qid);

  it('are some', () => expect(monsters.length).toBeGreaterThan(10));

  it.each(monsters)('%s is created with a copy per innate spell', (qid) => {
    const blank = {
      specVersion: '0.1.0',
      id: 'monster',
      packs: [{ id: '5e-srd-5.1', version: '0.2.1' }],
      creating: true,
    };
    const result = startAction(
      ruleset,
      blank,
      { action: { id: '5e-srd-5.1:create-monster' }, params: { monster: qid } },
      diceFrom(Array(200).fill(1)),
    );
    if (!('status' in result) || result.status !== 'finished') throw new Error('not finished');
    const applied = applyChanges(
      ruleset,
      blank,
      result.proposedChanges.map((p) => p.change),
    );
    expect(applied.ok ? [] : applied.errors).toEqual([]);
    if (!applied.ok) return;
    const copies = (applied.character.features ?? []).filter(
      (e) => e.item === '5e-srd-5.1:monster-actions.innate-spell',
    );
    expect(copies.map((c) => c.choices?.spell?.[0]?.option)).toEqual(spellsOf(qid));
  });
});

describe('shapechangers', () => {
  const shapechangers = Object.values(ruleset.content).filter(
    (item) => item.type === '5e-srd-5.1:monster' && item.fields?.startingForm !== undefined,
  );

  it('are the vampire and the five lycanthropes', () => {
    expect(shapechangers).toHaveLength(6);
  });

  it.each(shapechangers.map((m) => [m.qid, m.fields?.startingForm]))(
    '%s is created in its true form, %s',
    (qid, form) => {
      const blank = {
        specVersion: '0.1.0',
        id: 'monster',
        packs: [{ id: '5e-srd-5.1', version: '0.2.1' }],
        creating: true,
      };
      const result = startAction(
        ruleset,
        blank,
        { action: { id: '5e-srd-5.1:create-monster' }, params: { monster: qid } },
        diceFrom(Array(200).fill(1)),
      );
      if (!('status' in result) || result.status !== 'finished') throw new Error('not finished');
      const applied = applyChanges(
        ruleset,
        blank,
        result.proposedChanges.map((p) => p.change),
      );
      expect(applied.ok ? [] : applied.errors).toEqual([]);
      if (!applied.ok) return;
      const monster = applied.character.features?.find((e) => e.id === 'monster');
      expect(monster?.choices?.form).toEqual([{ option: form }]);
    },
  );
});

import type { Source } from '@opencharacter/spec';
import type { Compare, DiceModifier } from './ast.ts';
import { fail } from './errors.ts';
import { LIMITS } from './limits.ts';
import type { DiceTerm, DiceValue } from './values.ts';

/**
 * Supplies one die face for a die with `sides` sides: 1 to sides, 0 to sides - 1 when `zero`,
 * or -1 to 1 for a Fate die (`F`).
 */
export type FaceSource = (sides: number | 'F', zero: boolean) => number;

export interface RolledFace {
  value: number;
  kept: boolean;
  rerolled?: boolean;
  exploded?: boolean;
  success?: boolean;
  failure?: boolean;
  /** Where this die came from, when it differs from its roll item's source (pool dice). */
  source?: Source;
  set?: true;
}

export interface RolledTerm extends DiceTerm {
  faces: RolledFace[];
  /** The term's value before its sign. */
  value: number;
}

export interface RollResult {
  total: number;
  terms: RolledTerm[];
  flat: number;
}

export function facesFrom(faces: readonly number[]): FaceSource {
  let next = 0;
  return () => {
    const face = faces[next++];
    if (face === undefined)
      return fail('invalid-face', 'not enough dice faces were supplied', { needed: next });
    return face;
  };
}

/** Rolls a dice value: packages/spec/docs/formulas.md, "Rolling dice values". */
export function rollDice(dice: DiceValue, source: FaceSource): RollResult {
  const terms = dice.terms.map((term) => rollTerm(term, source));
  const total = terms.reduce((sum, term) => sum + term.sign * term.value, dice.flat);
  return { total, terms, flat: dice.flat };
}

function matches(value: number, compare: Compare, target: number): boolean {
  switch (compare) {
    case '=':
      return value === target;
    case '<':
      return value < target;
    case '<=':
      return value <= target;
    case '>':
      return value > target;
    case '>=':
      return value >= target;
  }
}

function rollTerm(term: DiceTerm, source: FaceSource): RolledTerm {
  const find = (type: DiceModifier['type']) => term.modifiers.find((m) => m.type === type);
  const lowest = term.sides === 'F' ? -1 : term.zero ? 0 : 1;
  const highest = term.sides === 'F' ? 1 : term.zero ? term.sides - 1 : term.sides;
  const draw = (): number => {
    const face = source(term.sides, term.zero === true);
    const ok = Number.isInteger(face) && face >= lowest && face <= highest;
    if (!ok)
      fail('invalid-face', `face ${face} is not on a d${term.sides}${term.zero ? 'z' : ''}`, {
        face,
        sides: term.sides,
      });
    return face;
  };
  const test = (m: DiceModifier | undefined, face: number) =>
    m !== undefined && matches(face, m.compare ?? '=', m.target ?? highest);

  // 1. Initial dice. 2. Rerolls and explosions, die by die. Faces are listed in the order they
  // were rolled, which is also the order they are supplied in.
  const faces: RolledFace[] = [];
  const live: RolledFace[] = [];
  for (let i = 0; i < term.count; i++) {
    const die: RolledFace = { value: draw(), kept: true };
    faces.push(die);
    live.push(die);
  }
  const reroll = find('reroll');
  const rerollOnce = find('rerollOnce');
  const explode = find('explode');
  const compound = find('explodeCompound');
  // A reroll with a `count` rerolls at most that many of the matching initial dice, lowest faces
  // first (earliest first among equal faces).
  const limited = (m: DiceModifier | undefined): Set<number> | undefined => {
    if (m?.count === undefined) return undefined;
    const ranked = live
      .map((die, index) => ({ value: die.value, index }))
      .filter((d) => test(m, d.value))
      .toSorted((a, b) => a.value - b.value || a.index - b.index);
    return new Set(ranked.slice(0, m.count).map((d) => d.index));
  };
  const rerollOnly = limited(reroll);
  const rerollOnceOnly = limited(rerollOnce);
  let rerolls = 0;
  let explosions = 0;
  for (let i = 0; i < live.length; i++) {
    let die = live[i] as RolledFace;
    let usedOnce = false;
    for (;;) {
      const always = test(reroll, die.value) && (rerollOnly === undefined || rerollOnly.has(i));
      const once =
        test(rerollOnce, die.value) && (rerollOnceOnly === undefined || rerollOnceOnly.has(i));
      if (!always && (usedOnce || !once)) break;
      if (!always) usedOnce = true;
      if (++rerolls > LIMITS.maxRerolls)
        fail('safety-limit-exceeded', 'too many rerolls', { limit: 'maxRerolls' });
      die.kept = false;
      die.rerolled = true;
      const replacement: RolledFace = {
        value: draw(),
        kept: true,
        ...(die.exploded ? { exploded: true } : {}),
      };
      faces.push(replacement);
      live[i] = replacement;
      die = replacement;
    }
    if (compound) {
      let last = die.value;
      while (test(compound, last)) {
        if (++explosions > LIMITS.maxExplosions)
          fail('safety-limit-exceeded', 'too many explosions', { limit: 'maxExplosions' });
        last = draw();
        die.value += last;
      }
    } else if (test(explode, die.value)) {
      if (++explosions > LIMITS.maxExplosions)
        fail('safety-limit-exceeded', 'too many explosions', { limit: 'maxExplosions' });
      const extra: RolledFace = { value: draw(), kept: true, exploded: true };
      faces.push(extra);
      live.push(extra);
    }
  }

  // 3. Clamp.
  const minimum = find('minimum');
  const maximum = find('maximum');
  for (const die of live) {
    if (minimum?.target !== undefined && die.value < minimum.target) die.value = minimum.target;
    if (maximum?.target !== undefined && die.value > maximum.target) die.value = maximum.target;
  }

  // 4. Keep or drop. Ties go to the die rolled first.
  const keepDrop = term.modifiers.find((m) =>
    ['keepHighest', 'keepLowest', 'dropHighest', 'dropLowest'].includes(m.type),
  );
  if (keepDrop) {
    const n = Math.min(keepDrop.count ?? 1, live.length);
    const highFirst = keepDrop.type === 'keepHighest' || keepDrop.type === 'dropHighest';
    const ranked = live
      .map((die, index) => ({ die, index }))
      .toSorted(
        (a, b) =>
          (highFirst ? b.die.value - a.die.value : a.die.value - b.die.value) || a.index - b.index,
      );
    const chosen = new Set(ranked.slice(0, n).map((r) => r.die));
    const keep = keepDrop.type.startsWith('keep');
    for (const die of live) die.kept = keep ? chosen.has(die) : !chosen.has(die);
  }

  // 5. Value.
  const kept = live.filter((die) => die.kept);
  const successes = find('countSuccesses');
  const failures = find('countFailures');
  let value: number;
  if (successes) {
    value = 0;
    for (const die of kept) {
      if (test(successes, die.value)) {
        die.success = true;
        value++;
      }
      if (test(failures, die.value)) {
        die.failure = true;
        value--;
      }
    }
  } else {
    value = kept.reduce((sum, die) => sum + die.value, 0);
  }
  return { ...term, faces, value };
}

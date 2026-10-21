// Keep and drop modifiers that can't change the roll are left out of the words.

import type { RollItem } from '@opencharacter/spec';

type Modifier = NonNullable<RollItem['modifiers']>[number];
type Spec = (key: string, args?: Readonly<Record<string, unknown>>) => string | undefined;
export type DiceLike = Pick<RollItem, 'count' | 'sides' | 'modifiers' | 'sign'> & {
  kind?: RollItem['kind'];
};

const COMPARE: Record<string, string> = { '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge' };

function faces(m: Modifier, sides: number | 'F' | undefined, spec: Spec): string {
  // Without a comparison, an explosion is on the highest face.
  const target = m.target ?? (typeof sides === 'number' ? sides : 1);
  const code = m.compare ? COMPARE[m.compare] : undefined;
  return (code && spec(`compare.${code}`, { value: target })) || String(target);
}

function modifier(m: Modifier, sides: number | 'F' | undefined, spec: Spec): string {
  const args = {
    count: m.count ?? 1,
    target: m.target ?? 0,
    faces: faces(m, sides, spec),
  };
  return spec(`dice.${m.type}`, args) ?? m.type;
}

/** Keeping all dice or dropping none (a FitD pool of one die); after an explosion every keep counts. */
function idle(m: Modifier, d: DiceLike): boolean {
  if (m.type === 'dropHighest' || m.type === 'dropLowest') return (m.count ?? 1) <= 0;
  if (m.type !== 'keepHighest' && m.type !== 'keepLowest') return false;
  if (d.modifiers?.some((o) => o.type === 'explode' || o.type === 'explodeCompound')) return false;
  return (m.count ?? 1) >= (d.count ?? 1);
}

function item(d: DiceLike, spec: Spec): string {
  const count = d.count ?? 1;
  let text =
    (d.sides === 'F'
      ? spec('dice.fate', { count })
      : spec('dice.dice', { count, sides: d.sides ?? 0 })) ?? `${count}d${d.sides}`;
  for (const m of d.modifiers ?? []) {
    if (idle(m, d)) continue;
    text = spec('dice.modified', { dice: text, modifier: modifier(m, d.sides, spec) }) ?? text;
  }
  return text;
}

/** A roll made more than once (`needs.repeat`): how many whole rolls, and which total is kept. */
export interface Repeat {
  times: number;
  keep: 'high' | 'low';
}

export function diceText(items: readonly DiceLike[], spec: Spec, repeat?: Repeat): string {
  let out: string | undefined;
  for (const d of items) {
    if (d.kind === 'flat' || d.count === undefined) continue;
    const text = item(d, spec);
    const negative = d.sign === -1;
    out =
      out === undefined
        ? negative
          ? (spec('dice.negative', { dice: text }) ?? `-${text}`)
          : text
        : (spec(negative ? 'dice.minus' : 'dice.plus', { first: out, second: text }) ??
          `${out} ${negative ? '-' : '+'} ${text}`);
  }
  if (out === undefined) return '';
  if (!repeat) return out;
  return (
    spec('dice.repeat', { dice: out, times: repeat.times, keep: repeat.keep }) ??
    `${out}, ${repeat.times} times, keep ${repeat.keep === 'high' ? 'highest' : 'lowest'}`
  );
}

// Keep and drop modifiers that can't change the roll are left out of the words.

import type { RollItem } from '@opencharacter/spec';

type Modifier = NonNullable<RollItem['modifiers']>[number];
type Spec = (key: string, args?: Readonly<Record<string, unknown>>) => string | undefined;
export type DiceLike = Pick<RollItem, 'count' | 'sides' | 'modifiers' | 'sign' | 'value'> & {
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

/**
 * A roll made more than once (`needs.repeat`): how many rolls, and which total is kept; with
 * `items`, only those items (indices in the roll's items) are rolled again.
 */
export interface Repeat {
  times: number;
  keep: 'high' | 'low';
  items?: readonly number[];
}

function repeated(dice: string, repeat: Repeat, spec: Spec): string {
  return (
    spec('dice.repeat', { dice, times: repeat.times, keep: repeat.keep }) ??
    `${dice}, ${repeat.times} times, keep ${repeat.keep === 'high' ? 'highest' : 'lowest'}`
  );
}

/**
 * The dice items joined in order. With `number` (the whole roll), the flat items' sum follows,
 * written by `number`: "2d10 + 25". Items a repeat rolls again are worded together where the
 * first of them is, in `dice.grouped` when anything else is rolled or added.
 */
export function diceText(
  items: readonly DiceLike[],
  spec: Spec,
  repeat?: Repeat,
  number?: (n: number) => string,
): string {
  let out: string | undefined;
  const join = (text: string, negative: boolean) =>
    out === undefined
      ? negative
        ? (spec('dice.negative', { dice: text }) ?? `-${text}`)
        : text
      : (spec(negative ? 'dice.minus' : 'dice.plus', { first: out, second: text }) ??
        `${out} ${negative ? '-' : '+'} ${text}`);
  const again = new Set(repeat?.items ?? []);
  const isDice = (d: DiceLike) => d.kind !== 'flat' && d.count !== undefined;
  let group: string | undefined;
  if (repeat && again.size > 0) {
    group = diceText(
      items.filter((d, i) => again.has(i) && isDice(d)),
      spec,
      { times: repeat.times, keep: repeat.keep },
    );
    const others = items.some(
      (d, i) => !again.has(i) && (isDice(d) || (number !== undefined && d.kind === 'flat')),
    );
    if (others) group = spec('dice.grouped', { dice: group }) ?? `(${group})`;
  }
  let flat = 0;
  for (const [i, d] of items.entries()) {
    if (again.has(i)) {
      if (group !== undefined) out = join(group, false);
      group = undefined;
      continue;
    }
    if (!isDice(d)) {
      flat += d.kind === 'flat' ? (d.value ?? 0) : 0;
      continue;
    }
    out = join(item(d, spec), d.sign === -1);
  }
  if (number && (flat !== 0 || (out === undefined && items.some((d) => d.kind === 'flat')))) {
    out = out === undefined ? number(flat) : join(number(Math.abs(flat)), flat < 0);
  }
  if (out === undefined) return '';
  if (!repeat || again.size > 0) return out;
  return repeated(out, repeat, spec);
}

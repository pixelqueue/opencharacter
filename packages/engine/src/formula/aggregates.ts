import type { Node } from './ast.ts';
import { fail } from './errors.ts';
import { children } from './parser.ts';

// Aggregates: macros evaluating their arguments once per copy, pick, grant, field or list element.

export type Over = 'copies' | 'picks' | 'grants' | 'fields' | 'list';

const OVER: Readonly<Record<string, Over>> = {
  countCopies: 'copies',
  sumCopies: 'copies',
  maxCopies: 'copies',
  minCopies: 'copies',
  countPicks: 'picks',
  countGrants: 'grants',
  countFields: 'fields',
  sumFields: 'fields',
  maxFields: 'fields',
  minFields: 'fields',
  countList: 'list',
  sumList: 'list',
  maxList: 'list',
  minList: 'list',
  filterList: 'list',
  mapList: 'list',
  sortList: 'list',
};

export const AGGREGATE_ROOT: Readonly<Record<Over, string>> = {
  copies: 'copy',
  picks: 'pick',
  grants: 'grant',
  fields: 'f',
  list: 'x',
};

export function aggregateOver(fn: string): Over | undefined {
  return Object.hasOwn(OVER, fn) ? OVER[fn] : undefined;
}

export function readsCharacter(over: Over): boolean {
  return over !== 'list';
}

export type Reduce = 'count' | 'sum' | 'max' | 'min' | 'filter' | 'map' | 'sort';

export function reduceOf(fn: string): Reduce {
  if (fn === 'filterList') return 'filter';
  if (fn === 'mapList') return 'map';
  if (fn === 'sortList') return 'sort';
  return fn.startsWith('count')
    ? 'count'
    : fn.startsWith('sum')
      ? 'sum'
      : fn.startsWith('max')
        ? 'max'
        : 'min';
}

export interface AggregateArgs {
  /** The list argument (list functions only). */
  list?: Node;
  /** The value to reduce (all but the count functions). */
  value?: Node;
  cond?: Node;
}

/**
 * Splits an aggregate's arguments: `count*(cond)`, `sum*|max*|min*(value, cond?)`, each with
 * the list in front for the list functions; `filterList(list, cond)`, `mapList(list, value)` and
 * `sortList(list, key?)`, the key being `value`. Fails with `wrong-arity`.
 */
export function aggregateArgs(fn: string, over: Over, args: Node[]): AggregateArgs {
  const reduce = reduceOf(fn);
  if (reduce === 'filter' || reduce === 'map' || reduce === 'sort') {
    const [min, max] = reduce === 'sort' ? [1, 2] : [2, 2];
    if (args.length < min || args.length > max)
      fail('wrong-arity', `${fn}() takes ${min === max ? min : `${min} or ${max}`} arguments`);
    const [list, second] = args as [Node, Node | undefined];
    return {
      list,
      ...(second ? (reduce === 'filter' ? { cond: second } : { value: second }) : {}),
    };
  }
  const lead = over === 'list' ? 1 : 0;
  const count = reduce === 'count';
  const min = lead + 1;
  const max = lead + (count ? 1 : 2);
  if (args.length < min || args.length > max) {
    fail(
      'wrong-arity',
      `${fn}() takes ${min === max ? min : `${min} or ${max}`} argument${max === 1 ? '' : 's'}`,
    );
  }
  const rest = args.slice(lead);
  return {
    ...(lead ? { list: args[0] as Node } : {}),
    ...(count ? { cond: rest[0] as Node } : { value: rest[0] as Node }),
    ...(!count && rest[1] ? { cond: rest[1] } : {}),
  };
}

/** Why `cond` isn't a static filter (reading only `f.id`, `f.type`, `f.tags`), or undefined. */
export function staticFilterProblem(fn: string, cond: Node): string | undefined {
  let problem: string | undefined;
  const visit = (n: Node) => {
    if (problem) return;
    if (n.type === 'name') {
      const [root, key] = n.path;
      if (root !== 'f' || key === undefined || key === 'value') {
        problem = `${fn}() condition reads "${n.path.join('.')}"; it may read only f.id, f.type and f.tags`;
        return;
      }
    }
    for (const child of children(n)) visit(child);
  };
  visit(cond);
  return problem;
}

/** A field as the field functions' static filter sees it: `f` without `value`. */
export interface FieldView {
  id: string;
  type: string;
  tags: readonly string[];
}

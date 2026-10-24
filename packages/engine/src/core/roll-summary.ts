import * as f from '../formula/index.ts';
import type { BandSet, Formula } from './pack-types.ts';
import { Failure } from './sheet.ts';
import { diceText, outputData } from './views.ts';

export type CompareCode = 'lt' | 'le' | 'gt' | 'ge' | 'eq';

export interface RollTest {
  of: string;
  compare: CompareCode;
  value: number;
}

export interface SummaryBand {
  band: string;
  success?: true;
  when: string;
  tests?: RollTest[];
}

export interface RollSummary {
  bandSet?: string;
  value?: string;
  bands?: SummaryBand[];
  flags: Record<string, unknown>;
}

const signed = (node: f.Node, n: number): f.Node =>
  n < 0 ? { type: 'unary', op: '-', operand: node } : node;

export function literalTree(value: f.Value): f.Node {
  switch (value.kind) {
    case 'int':
      return signed({ type: 'int', value: Math.abs(value.value) }, value.value);
    case 'decimal':
      return signed({ type: 'decimal', value: Math.abs(value.value) }, value.value);
    case 'string':
      return { type: 'string', value: value.value };
    case 'bool':
      return { type: 'bool', value: value.value };
    case 'null':
      return { type: 'null' };
    case 'list':
      return { type: 'list', items: value.value.map(literalTree) };
    case 'dice': {
      const tree = f.parse(diceText(value.value));
      if (tree.ok) return tree.value;
      throw new Failure(tree.error);
    }
    case 'object':
      throw new Failure({
        code: 'type-mismatch',
        message: 'a map passed on in a change has no literal; read a member',
      });
  }
}

function treeOf(formula: Formula): f.Node | undefined {
  if (typeof formula === 'boolean') return { type: 'bool', value: formula };
  if (typeof formula === 'number')
    return literalTree(
      Number.isInteger(formula)
        ? { kind: 'int', value: formula }
        : { kind: 'decimal', value: formula },
    );
  const tree = f.parse(formula);
  return tree.ok ? tree.value : undefined;
}

function readsRoll(node: f.Node): boolean {
  if (node.type === 'name') return node.path[0] === 'roll';
  return f.children(node).some(readsRoll);
}

/**
 * A formula with each maximal subexpression that doesn't read `roll` evaluated and replaced by
 * its value as a literal, and literal guards folded as evaluation would: `false && x` is `false`,
 * `true || x` is `true`, `true && x`, `false || x`, `x && true` and `x || false` are `x`,
 * `c ? a : b` with a literal `c` is the taken branch and `!` of a literal is its negation. A
 * subexpression that fails to evaluate, or gives a map, is left as written.
 */
export function resolveRoll(tree: f.Node, evaluate: (node: f.Node) => f.Value): f.Node {
  const visit = (n: f.Node): f.Node => {
    if (!readsRoll(n)) {
      try {
        return literalTree(evaluate(n));
      } catch {
        // The summary never fails the action: the subexpression stays as written.
        return n;
      }
    }
    switch (n.type) {
      case 'binary': {
        const left = visit(n.left);
        if ((n.op === '&&' || n.op === '||') && left.type === 'bool') {
          if (left.value === (n.op === '||')) return left;
          return visit(n.right);
        }
        const right = visit(n.right);
        if (
          (n.op === '&&' || n.op === '||') &&
          right.type === 'bool' &&
          right.value === (n.op === '&&')
        )
          return left;
        return { ...n, left, right };
      }
      case 'conditional': {
        const test = visit(n.test);
        if (test.type === 'bool') return visit(test.value ? n.then : n.else);
        // oxlint-disable-next-line unicorn/no-thenable
        return { ...n, test, then: visit(n.then), else: visit(n.else) };
      }
      case 'unary': {
        const operand = visit(n.operand);
        if (n.op === '!' && operand.type === 'bool') return { type: 'bool', value: !operand.value };
        return { ...n, operand };
      }
      case 'list':
        return { ...n, items: n.items.map(visit) };
      case 'call':
        return { ...n, args: n.args.map(visit) };
      case 'member':
        return { ...n, object: visit(n.object) };
      case 'index':
        return { ...n, object: visit(n.object), index: visit(n.index) };
      case 'dice':
        return typeof n.count === 'number' ? n : { ...n, count: visit(n.count) };
      default:
        return n;
    }
  };
  return visit(tree);
}

const CODES: Partial<Record<f.BinaryOp, CompareCode>> = {
  '<': 'lt',
  '<=': 'le',
  '>': 'gt',
  '>=': 'ge',
  '==': 'eq',
};
const MIRROR: Record<CompareCode, CompareCode> = {
  lt: 'gt',
  le: 'ge',
  gt: 'lt',
  ge: 'le',
  eq: 'eq',
};
const ROLL_PATHS = new Set(['total', 'value', 'unbounded']);

/** A roll path a test may compare (`roll.total`, `roll.value`, `roll.unbounded`, `roll.kept[n]`). */
function rollPath(node: f.Node): string | undefined {
  if (node.type === 'name' && node.path.length === 2 && node.path[0] === 'roll')
    return ROLL_PATHS.has(node.path[1] as string) ? f.print(node) : undefined;
  if (
    node.type === 'index' &&
    node.index.type === 'int' &&
    node.object.type === 'name' &&
    node.object.path.length === 2 &&
    node.object.path[0] === 'roll' &&
    node.object.path[1] === 'kept'
  )
    return f.print(node);
  return undefined;
}

function numberOf(node: f.Node): number | undefined {
  if (node.type === 'int' || node.type === 'decimal') return node.value;
  if (node.type === 'unary' && node.op === '-') {
    const inner = numberOf(node.operand);
    return inner === undefined ? undefined : -inner;
  }
  return undefined;
}

/**
 * A resolved condition's structured tests: `[]` for `true`; a conjunction of plain comparisons
 * of a roll path with a number, in order, the roll path on the left; otherwise none.
 */
export function rollTests(tree: f.Node): RollTest[] | undefined {
  if (tree.type === 'bool') return tree.value ? [] : undefined;
  const conjuncts: f.Node[] = [];
  const flatten = (n: f.Node) => {
    if (n.type === 'binary' && n.op === '&&') {
      flatten(n.left);
      flatten(n.right);
    } else conjuncts.push(n);
  };
  flatten(tree);
  const tests: RollTest[] = [];
  for (const c of conjuncts) {
    if (c.type !== 'binary') return undefined;
    const code = CODES[c.op];
    if (!code) return undefined;
    const leftPath = rollPath(c.left);
    const rightPath = rollPath(c.right);
    if (leftPath !== undefined) {
      const value = numberOf(c.right);
      if (value === undefined) return undefined;
      tests.push({ of: leftPath, compare: code, value });
    } else if (rightPath !== undefined) {
      const value = numberOf(c.left);
      if (value === undefined) return undefined;
      tests.push({ of: rightPath, compare: MIRROR[code], value });
    } else return undefined;
  }
  return tests;
}

/**
 * The summary of a roll step: its band set (qualified ID and set) summarized with `evaluate`
 * (the step's band context without `roll`), and the running action's flags as data.
 */
export function rollSummary(
  bandSetId: string | undefined,
  set: BandSet | undefined,
  flags: Record<string, unknown>,
  evaluate: (node: f.Node) => f.Value,
): RollSummary {
  const out: Omit<RollSummary, 'flags'> = {};
  if (bandSetId !== undefined && set) {
    out.bandSet = bandSetId;
    if (set.value !== undefined) {
      const tree = treeOf(set.value);
      out.value = tree ? f.print(resolveRoll(tree, evaluate)) : String(set.value);
    }
    const bands: SummaryBand[] = [];
    for (const band of set.bands) {
      const tree = treeOf(band.when);
      const success = band.success ? { success: true as const } : {};
      if (!tree) {
        bands.push({ band: band.id, ...success, when: String(band.when) });
        continue;
      }
      const resolved = resolveRoll(tree, evaluate);
      // A band that can't hold is left out; one that always holds once reached is the last.
      if (resolved.type === 'bool' && !resolved.value) continue;
      const tests = rollTests(resolved);
      bands.push({
        band: band.id,
        ...success,
        when: f.print(resolved),
        ...(tests === undefined ? {} : { tests }),
      });
      if (resolved.type === 'bool') break;
    }
    out.bands = bands;
  }
  const data: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(flags))
    if (value !== undefined) data[name] = outputData(f.fromData(value));
  return { ...out, flags: data };
}

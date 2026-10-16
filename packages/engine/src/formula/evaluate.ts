import {
  AGGREGATE_ROOT,
  aggregateArgs,
  aggregateOver,
  type FieldView,
  type Over,
  readsCharacter,
  reduceOf,
  staticFilterProblem,
} from './aggregates.ts';
import type { Node } from './ast.ts';
import { fail } from './errors.ts';
import { LIMITS } from './limits.ts';
import { rollDice } from './roll.ts';
import {
  bool,
  type DiceTerm,
  type DiceValue,
  decimal,
  fromData,
  int,
  isNumber,
  roundDecimal,
  str,
  type Value,
  wrapValue,
} from './values.ts';

export interface CharacterQueries {
  /** Deprecated: `countCopies(copy.type == type && copy.equipped)`. */
  countEquipped(type: string): number;
  /** Deprecated: `countCopies(has(copy.state.<key>) && copy.state.<key>)`. */
  countState(key: string): number;
  /** Deprecated: `sumCopies(copy.state.<key>, copy.type == type)`. */
  sumState(type: string, key: string): number;
  /** Every copy as the `copy` root sees it: inventory first, then features, each in file order. */
  copies(): readonly unknown[];
  /** Every field in ruleset order, as the static filter sees it; the same array on every call. */
  fields(): readonly FieldView[];
  fieldValue(id: string): Value;
  /** Whether a listed choice draws from the content type; bound only in display hints. */
  hasChoice?(type: string): boolean;
}

export interface EvalContext {
  /** The value of a visible field, or undefined when no field has this ID. */
  field(id: string): Value | undefined;
  roots: Readonly<Record<string, unknown>>;
  character?: CharacterQueries;
  /** Inside an aggregate's argument, where no aggregate is bound again. */
  inAggregate?: boolean;
  /** An ID literal's qualified content or field ID, or undefined; unbound: the ID as written. */
  id?(text: string): string | undefined;
  /** A family's values, by the name the formula's pack sees; unbound: none. */
  family?(name: string): readonly string[] | undefined;
  /** A family field's value, from the pack that added `key` to the family when another did. */
  familyField?(name: string, key: string, id: string): Value | undefined;
}

export function evaluateTree(node: Node, ctx: EvalContext): Value {
  switch (node.type) {
    case 'int':
      return int(node.value);
    case 'decimal':
      return decimal(node.value);
    case 'string':
      return str(node.value);
    case 'ref': {
      if (!ctx.id) return str(node.id);
      const id = ctx.id(node.id);
      if (id === undefined) return fail('unknown-name', `no content or field @${node.id}`);
      return str(id);
    }
    case 'bool':
      return bool(node.value);
    case 'null':
      return { kind: 'null' };
    case 'list':
      return { kind: 'list', value: node.items.map((item) => evaluateTree(item, ctx)) };
    case 'name':
      return resolveName(node.path, ctx);
    case 'member':
      return member(evaluateTree(node.object, ctx), node.name);
    case 'index': {
      const list = evaluateTree(node.object, ctx);
      const index = evaluateTree(node.index, ctx);
      if (list.kind !== 'list') return fail('type-mismatch', 'only lists can be indexed');
      if (index.kind !== 'int') return fail('type-mismatch', 'list index must be an int');
      const item = list.value[index.value];
      if (index.value < 0 || item === undefined)
        return fail('index-out-of-range', `index ${index.value} is out of range`);
      return item;
    }
    case 'call':
      return call(node.fn, node.args, ctx);
    case 'unary': {
      const operand = evaluateTree(node.operand, ctx);
      if (node.op === '!') {
        if (operand.kind !== 'bool') return fail('type-mismatch', '! needs a bool');
        return bool(!operand.value);
      }
      if (operand.kind === 'int') return int(-operand.value);
      if (operand.kind === 'decimal') return decimal(-operand.value);
      if (operand.kind === 'dice') return dice(negate(operand.value));
      return fail('type-mismatch', 'unary - needs a number or dice');
    }
    case 'binary':
      return binary(node, ctx);
    case 'conditional': {
      const test = evaluateTree(node.test, ctx);
      if (test.kind !== 'bool') return fail('type-mismatch', 'a condition must be a bool');
      return evaluateTree(test.value ? node.then : node.else, ctx);
    }
    case 'dice': {
      let count: number;
      if (typeof node.count === 'number') {
        count = node.count;
      } else {
        const value = evaluateTree(node.count, ctx);
        if (value.kind !== 'int') return fail('type-mismatch', 'a dice count must be an int');
        count = value.value;
      }
      if (count < 0) return fail('type-mismatch', 'a dice count cannot be negative');
      if (count > LIMITS.maxDicePerItem) {
        return fail('safety-limit-exceeded', 'too many dice', { limit: 'maxDicePerItem' });
      }
      return dice({
        terms: [
          {
            sign: 1,
            count,
            sides: node.sides,
            ...(node.zero ? { zero: true as const } : {}),
            modifiers: node.modifiers,
          },
        ],
        flat: 0,
      });
    }
  }
}

const dice = (value: DiceValue): Value => ({ kind: 'dice', value });

function negate(value: DiceValue): DiceValue {
  return {
    terms: value.terms.map((term): DiceTerm => ({ ...term, sign: term.sign === 1 ? -1 : 1 })),
    flat: value.flat === 0 ? 0 : -value.flat,
  };
}

function resolveName(path: string[], ctx: EvalContext): Value {
  const [root, ...rest] = path as [string, ...string[]];
  if (Object.hasOwn(ctx.roots, root)) {
    let value = fromData(ctx.roots[root]);
    for (const segment of rest) value = member(value, segment);
    return value;
  }
  const field = ctx.field(path.join('.'));
  if (field !== undefined) return field;
  return fail('unknown-name', `"${path.join('.')}" is not a bound root or a visible field`, {
    name: path.join('.'),
  });
}

function member(value: Value, name: string): Value {
  if (value.kind !== 'object')
    return fail('type-mismatch', `cannot select "${name}" from a ${value.kind}`);
  if (!Object.hasOwn(value.value, name)) return fail('no-such-key', `no "${name}"`, { key: name });
  return fromData(value.value[name]);
}

function present(node: Node, ctx: EvalContext): boolean {
  if (node.type === 'name') {
    const [root, ...rest] = node.path as [string, ...string[]];
    if (Object.hasOwn(ctx.roots, root)) {
      let data: unknown = ctx.roots[root];
      for (const segment of rest) {
        if (
          data === null ||
          typeof data !== 'object' ||
          Array.isArray(data) ||
          !Object.hasOwn(data, segment)
        ) {
          return false;
        }
        data = (data as Record<string, unknown>)[segment];
      }
      return data !== undefined;
    }
    return ctx.field(node.path.join('.')) !== undefined;
  }
  if (node.type === 'member') {
    const object = evaluateTree(node.object, ctx);
    return object.kind === 'object' && Object.hasOwn(object.value, node.name);
  }
  return fail('type-mismatch', 'has() takes a name or a member path');
}

export function valuesEqual(a: Value, b: Value): boolean {
  if (a.kind === 'dice' || b.kind === 'dice')
    return fail('type-mismatch', 'dice cannot be compared');
  if (isNumber(a) && isNumber(b)) return a.value === b.value;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'null':
      return true;
    case 'list': {
      const other = (b as typeof a).value;
      return (
        a.value.length === other.length &&
        a.value.every((item, i) => valuesEqual(item, other[i] as Value))
      );
    }
    case 'object':
      return JSON.stringify(a.value) === JSON.stringify((b as typeof a).value);
    default:
      return a.value === (b as typeof a).value;
  }
}

function binary(node: Extract<Node, { type: 'binary' }>, ctx: EvalContext): Value {
  if (node.op === '&&' || node.op === '||') {
    const left = evaluateTree(node.left, ctx);
    if (left.kind !== 'bool') return fail('type-mismatch', `${node.op} needs bools`);
    if (node.op === '&&' ? !left.value : left.value) return left;
    const right = evaluateTree(node.right, ctx);
    if (right.kind !== 'bool') return fail('type-mismatch', `${node.op} needs bools`);
    return right;
  }
  const left = evaluateTree(node.left, ctx);
  const right = evaluateTree(node.right, ctx);
  switch (node.op) {
    case '==':
      return bool(valuesEqual(left, right));
    case '!=':
      return bool(!valuesEqual(left, right));
    case 'in':
      if (right.kind !== 'list') return fail('type-mismatch', 'in needs a list on the right');
      return bool(right.value.some((item) => valuesEqual(left, item)));
    case '<':
    case '<=':
    case '>':
    case '>=': {
      let order: number;
      if (isNumber(left) && isNumber(right)) order = left.value - right.value;
      else if (left.kind === 'string' && right.kind === 'string')
        order = compareCodePoints(left.value, right.value);
      else return fail('type-mismatch', `${node.op} needs two numbers or two strings`);
      return bool(
        node.op === '<'
          ? order < 0
          : node.op === '<='
            ? order <= 0
            : node.op === '>'
              ? order > 0
              : order >= 0,
      );
    }
    case '+':
    case '-':
      return addOrSubtract(node.op, left, right);
    case '*':
      if (left.kind === 'int' && right.kind === 'int') return int(left.value * right.value);
      if (left.kind === 'dice' && right.kind === 'int') return scaleDice(left.value, right.value);
      if (left.kind === 'int' && right.kind === 'dice') return scaleDice(right.value, left.value);
      if (isNumber(left) && isNumber(right)) return decimal(left.value * right.value);
      return fail('type-mismatch', '* needs numbers');
    case '/':
      if (!isNumber(left) || !isNumber(right)) return fail('type-mismatch', '/ needs numbers');
      if (right.value === 0) return fail('division-by-zero', 'division by zero');
      return decimal(left.value / right.value);
    case '%':
      if (left.kind !== 'int' || right.kind !== 'int') return fail('type-mismatch', '% needs ints');
      if (right.value === 0) return fail('division-by-zero', 'modulo by zero');
      return int(left.value % right.value);
  }
}

function compareCodePoints(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = (x[i] as string).codePointAt(0)! - (y[i] as string).codePointAt(0)!;
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

function asDice(value: Value): DiceValue | undefined {
  if (value.kind === 'dice') return value.value;
  return value.kind === 'int' ? { terms: [], flat: value.value } : undefined;
}

function addOrSubtract(op: '+' | '-', left: Value, right: Value): Value {
  const sign = op === '+' ? 1 : -1;
  if (left.kind === 'int' && right.kind === 'int') return int(left.value + sign * right.value);
  if (isNumber(left) && isNumber(right)) return decimal(left.value + sign * right.value);
  if (left.kind === 'dice' || right.kind === 'dice') {
    const a = asDice(left);
    const b = asDice(right);
    if (!a || !b) return fail('type-mismatch', `dice can only be combined with dice or ints`);
    const bb = sign === 1 ? b : negate(b);
    return dice({
      terms: [...a.terms, ...bb.terms],
      flat: (int(a.flat + bb.flat) as { value: number }).value,
    });
  }
  if (op === '+' && left.kind === 'string' && right.kind === 'string')
    return str(left.value + right.value);
  if (op === '+' && left.kind === 'list' && right.kind === 'list')
    return { kind: 'list', value: [...left.value, ...right.value] };
  return fail('type-mismatch', `${op} cannot combine ${left.kind} and ${right.kind}`);
}

function arity(fn: string, args: Node[], min: number, max = min): void {
  if (args.length < min || args.length > max) {
    fail(
      'wrong-arity',
      `${fn}() takes ${min === max ? min : `${min} to ${max}`} argument${max === 1 ? '' : 's'}`,
    );
  }
}

function numberArg(fn: string, value: Value): { kind: 'int' | 'decimal'; value: number } {
  if (!isNumber(value)) return fail('type-mismatch', `${fn}() needs numbers`);
  return value;
}

function stringArg(fn: string, value: Value): string {
  if (value.kind !== 'string') return fail('type-mismatch', `${fn}() needs strings`);
  return value.value;
}

function call(fn: string, args: Node[], ctx: EvalContext): Value {
  if (fn === 'has') {
    arity(fn, args, 1);
    return bool(present(args[0] as Node, ctx));
  }
  const over = aggregateOver(fn);
  if (over) return aggregate(fn, over, args, ctx);
  const values = () => args.map((arg) => evaluateTree(arg, ctx));
  switch (fn) {
    case 'min':
    case 'max': {
      if (args.length < 1) fail('wrong-arity', `${fn}() takes one or more arguments`);
      const numbers = values().map((v) => numberArg(fn, v));
      const result =
        fn === 'min'
          ? Math.min(...numbers.map((n) => n.value))
          : Math.max(...numbers.map((n) => n.value));
      return numbers.every((n) => n.kind === 'int') ? int(result) : decimal(result);
    }
    case 'floor':
    case 'ceil':
    case 'round':
    case 'trunc': {
      arity(fn, args, 1);
      const x = numberArg(fn, values()[0] as Value).value;
      const rounded =
        fn === 'floor'
          ? Math.floor(x)
          : fn === 'ceil'
            ? Math.ceil(x)
            : fn === 'trunc'
              ? Math.trunc(x)
              : Math.sign(x) * Math.round(Math.abs(x));
      return int(rounded);
    }
    case 'abs': {
      arity(fn, args, 1);
      const x = numberArg(fn, values()[0] as Value);
      return x.kind === 'int' ? int(Math.abs(x.value)) : decimal(Math.abs(x.value));
    }
    case 'size': {
      arity(fn, args, 1);
      const x = values()[0] as Value;
      if (x.kind === 'list') return int(x.value.length);
      if (x.kind === 'string') return int([...x.value].length);
      return fail('type-mismatch', 'size() needs a list or a string');
    }
    case 'count': {
      arity(fn, args, 2);
      const [list, item] = values() as [Value, Value];
      if (list.kind !== 'list') return fail('type-mismatch', 'count() needs a list');
      return int(list.value.filter((entry) => valuesEqual(entry, item)).length);
    }
    case 'countEquipped':
    case 'countState':
    case 'sumState': {
      if (!ctx.character)
        return fail('unknown-function', `${fn}() needs a character and is not bound here`, {
          function: fn,
        });
      if (fn === 'sumState') {
        arity(fn, args, 2);
        const [type, key] = values() as [Value, Value];
        return int(ctx.character.sumState(stringArg(fn, type), stringArg(fn, key)));
      }
      arity(fn, args, 1);
      const arg = stringArg(fn, values()[0] as Value);
      return int(
        fn === 'countEquipped' ? ctx.character.countEquipped(arg) : ctx.character.countState(arg),
      );
    }
    case 'string': {
      arity(fn, args, 1);
      const x = values()[0] as Value;
      if (x.kind === 'string') return x;
      if (x.kind === 'int' || x.kind === 'bool') return str(String(x.value));
      return fail('type-mismatch', 'string() needs an int, a string or a bool');
    }
    case 'hasChoice': {
      const hasChoice = ctx.character?.hasChoice;
      if (!hasChoice)
        return fail('unknown-function', 'hasChoice() is bound only in display hints', {
          function: fn,
        });
      arity(fn, args, 1);
      return bool(hasChoice(stringArg(fn, values()[0] as Value)));
    }
    case 'indexOf': {
      arity(fn, args, 2);
      const [list, item] = values() as [Value, Value];
      if (list.kind !== 'list') return fail('type-mismatch', 'indexOf() needs a list');
      return int(list.value.findIndex((entry) => valuesEqual(entry, item)));
    }
    case 'keysOf': {
      arity(fn, args, 1);
      const [name] = args;
      if (name?.type !== 'string') return fail('type-mismatch', 'keysOf() takes a family name');
      const keys = ctx.family?.(name.value);
      if (!keys) return fail('unknown-name', `no family named "${name.value}"`);
      // A family of whole numbers (spell ranks) gives ints.
      return {
        kind: 'list',
        value: keys.every((k) => /^\d+$/.test(k))
          ? keys.map((k) => int(Number(k)))
          : keys.map((k) => str(k)),
      };
    }
    case 'fieldOf': {
      const [pattern, ...keyArgs] = args as [Node, ...Node[]];
      const family = familyPattern(pattern as Node);
      if (!family)
        return fail('type-mismatch', 'fieldOf() takes a pattern with {family} placeholders');
      arity(fn, args, family.names.length + 1);
      let id = family.text;
      let origin: { name: string; key: string } | undefined;
      for (const [i, name] of family.names.entries()) {
        const keys = ctx.family?.(name);
        if (!keys) return fail('unknown-name', `no family named "${name}"`);
        const key = evaluateTree(keyArgs[i] as Node, ctx);
        if (key.kind !== 'string' && key.kind !== 'int')
          return fail('type-mismatch', 'fieldOf() needs a string or int key');
        if (!keys.includes(String(key.value)))
          return fail('no-such-key', `"${key.value}" is not a value of the family ${name}`);
        id = id.replace(`{${name}}`, String(key.value));
        origin ??= { name, key: String(key.value) };
      }
      const value =
        ctx.familyField && origin ? ctx.familyField(origin.name, origin.key, id) : ctx.field(id);
      if (value === undefined) return fail('unknown-name', `no field ${id}`);
      return value;
    }
    case 'countOf': {
      arity(fn, args, 1);
      return int(diceArg(fn, values()[0] as Value).terms[0]?.count ?? 0);
    }
    case 'maxOf':
    case 'minOf': {
      arity(fn, args, 1);
      return int(extreme(diceArg(fn, values()[0] as Value), fn === 'maxOf'));
    }
    case 'dieOf': {
      arity(fn, args, 1, 2);
      const [value, countValue] = values() as [Value, Value | undefined];
      const first = diceArg(fn, value).terms[0];
      let count = 1;
      if (countValue !== undefined) {
        if (countValue.kind !== 'int') return fail('type-mismatch', 'dieOf() needs an int count');
        count = countValue.value;
      }
      if (count < 0) return fail('type-mismatch', 'a dice count cannot be negative');
      if (count > LIMITS.maxDicePerItem)
        return fail('safety-limit-exceeded', 'too many dice', { limit: 'maxDicePerItem' });
      if (!first) return dice({ terms: [], flat: 0 });
      return dice({
        terms: [
          {
            sign: 1,
            count,
            sides: first.sides,
            ...(first.zero ? { zero: true as const } : {}),
            modifiers: [],
          },
        ],
        flat: 0,
      });
    }
    default:
      return fail('unknown-function', `unknown function ${fn}()`, { function: fn });
  }
}

function diceArg(fn: string, value: Value): DiceValue {
  if (value.kind === 'dice') return value.value;
  if (value.kind === 'int') return { terms: [], flat: value.value };
  return fail('type-mismatch', `${fn}() needs dice`);
}

/** Modifiers that request more faces; `maxOf` and `minOf` ignore them. */
const REROLLS_AND_EXPLOSIONS = new Set(['reroll', 'rerollOnce', 'explode', 'explodeCompound']);

/**
 * Every die shows its highest face (lowest for `minOf`; reversed for a negative term), with no
 * rerolls or explosions; the other modifiers then apply as when rolling.
 */
function extreme(value: DiceValue, highest: boolean): number {
  let total = value.flat;
  for (const term of value.terms) {
    const high = highest === (term.sign === 1);
    const face =
      term.sides === 'F'
        ? high
          ? 1
          : -1
        : high
          ? term.sides - (term.zero ? 1 : 0)
          : term.zero
            ? 0
            : 1;
    const plain = {
      ...term,
      modifiers: term.modifiers.filter((m) => !REROLLS_AND_EXPLOSIONS.has(m.type)),
    };
    total += rollDice({ terms: [plain], flat: 0 }, () => face).total;
  }
  return total;
}

function rootData(value: Value): unknown {
  return value.kind === 'object' ? value.value : wrapValue(value);
}

const kept = new WeakMap<readonly FieldView[], WeakMap<Node, readonly FieldView[]>>();

/** Evaluated once per field with `f` bound to its view, so the result is fixed per ruleset. */
export function keptFields(
  fn: string,
  cond: Node | undefined,
  fields: readonly FieldView[],
): readonly FieldView[] {
  if (!cond) return fields;
  const problem = staticFilterProblem(fn, cond);
  if (problem) return fail('type-mismatch', problem);
  let byCond = kept.get(fields);
  if (!byCond) kept.set(fields, (byCond = new WeakMap()));
  const known = byCond.get(cond);
  if (known) return known;
  const out = fields.filter((view) => {
    const holds = evaluateTree(cond, {
      field: () => undefined,
      roots: { f: { id: view.id, type: view.type, tags: [...view.tags] } },
      inAggregate: true,
    });
    if (holds.kind !== 'bool') return fail('type-mismatch', `${fn}() needs a bool condition`);
    return holds.value;
  });
  byCond.set(cond, out);
  return out;
}

/** `cond` is evaluated first, `value` only where it holds; `f.value` is computed on first read. */
function aggregate(fn: string, over: Over, args: Node[], ctx: EvalContext): Value {
  if (ctx.inAggregate || (readsCharacter(over) && !ctx.character)) {
    const why = ctx.inAggregate ? 'inside another aggregate' : 'without a character';
    return fail('unknown-function', `${fn}() is not bound ${why}`, { function: fn });
  }
  const parts = aggregateArgs(fn, over, args);
  const inner: EvalContext = { ...ctx, inAggregate: true };
  const character = ctx.character as CharacterQueries;
  let elements: unknown[];
  let cond = parts.cond;
  if (over === 'copies') elements = [...character.copies()];
  else if (over === 'fields') {
    elements = keptFields(fn, cond, character.fields()).map((view) => fieldRoot(view, character));
    cond = undefined;
  } else {
    // The list is evaluated once, outside the per-element context, so it may itself be an
    // aggregate: `sortList(filterList(l, x > 0))`.
    const list = evaluateTree(parts.list as Node, ctx);
    if (list.kind !== 'list') return fail('type-mismatch', `${fn}() needs a list`);
    // Null elements (an `each` step's skipped participants) are skipped.
    const elementsKept = list.value.filter((v) => v.kind !== 'null');
    const reduce = reduceOf(fn);
    if (reduce === 'filter' || reduce === 'map' || reduce === 'sort')
      return listFunction(fn, reduce, elementsKept, parts, inner, ctx);
    elements = elementsKept.map(rootData);
  }
  const root = AGGREGATE_ROOT[over];
  const reduce = reduceOf(fn);
  let count = 0;
  let result: number | undefined;
  let decimalResult = false;
  for (const element of elements) {
    const bound: EvalContext = { ...inner, roots: { ...ctx.roots, [root]: element } };
    if (cond) {
      const holds = evaluateTree(cond, bound);
      if (holds.kind !== 'bool') return fail('type-mismatch', `${fn}() needs a bool condition`);
      if (!holds.value) continue;
    }
    if (reduce === 'count') {
      count += 1;
      continue;
    }
    const value = numberArg(fn, evaluateTree(parts.value as Node, bound));
    if (value.kind === 'decimal') decimalResult = true;
    if (result === undefined) result = value.value;
    // A decimal sum is rounded at each step, as `+` is.
    else if (reduce === 'sum')
      result = decimalResult ? roundDecimal(result + value.value) : result + value.value;
    else if (reduce === 'max') result = Math.max(result, value.value);
    else result = Math.min(result, value.value);
  }
  if (reduce === 'count') return int(count);
  // Nothing kept is the int 0, so the result can be used in arithmetic.
  return decimalResult ? decimal(result ?? 0) : int(result ?? 0);
}

/** In `sortList`, equal keys keep their order; keys are all numbers or all strings. */
function listFunction(
  fn: string,
  reduce: 'filter' | 'map' | 'sort',
  elements: Value[],
  parts: { cond?: Node; value?: Node },
  inner: EvalContext,
  ctx: EvalContext,
): Value {
  const at = (element: Value): EvalContext => ({
    ...inner,
    roots: { ...ctx.roots, x: rootData(element) },
  });
  if (reduce === 'filter') {
    const out: Value[] = [];
    for (const element of elements) {
      const holds = evaluateTree(parts.cond as Node, at(element));
      if (holds.kind !== 'bool') return fail('type-mismatch', `${fn}() needs a bool condition`);
      if (holds.value) out.push(element);
    }
    return { kind: 'list', value: out };
  }
  if (reduce === 'map')
    return {
      kind: 'list',
      value: elements.map((element) => evaluateTree(parts.value as Node, at(element))),
    };
  const keyed = elements.map((element, index) => {
    const key = parts.value ? evaluateTree(parts.value, at(element)) : element;
    if (key.kind !== 'int' && key.kind !== 'decimal' && key.kind !== 'string')
      return fail('type-mismatch', `${fn}() sorts by numbers or strings, not ${key.kind}`);
    return { element, key, index };
  });
  const strings = keyed.filter((k) => k.key.kind === 'string').length;
  if (strings > 0 && strings < keyed.length)
    return fail('type-mismatch', `${fn}() keys mix numbers and strings`);
  const sorted = keyed.toSorted((a, b) => {
    const [x, y] = [a.key.value as number | string, b.key.value as number | string];
    return x < y ? -1 : x > y ? 1 : a.index - b.index;
  });
  return { kind: 'list', value: sorted.map((k) => k.element) };
}

function fieldRoot(view: FieldView, character: CharacterQueries): Record<string, unknown> {
  let value: unknown;
  return {
    id: view.id,
    type: view.type,
    tags: [...view.tags],
    get value() {
      value ??= rootData(character.fieldValue(view.id));
      return value;
    },
  };
}

/** Modifiers are kept; a negative factor is a type mismatch. */
function scaleDice(value: DiceValue, factor: number): Value {
  if (factor < 0)
    return fail('type-mismatch', 'dice can only be multiplied by an int of 0 or more');
  const terms = value.terms.map((t) => ({ ...t, count: t.count * factor }));
  if (terms.some((t) => t.count > LIMITS.maxDicePerItem))
    return fail('safety-limit-exceeded', 'too many dice', { limit: 'maxDicePerItem' });
  return dice({ terms, flat: value.flat * factor });
}

/** A string literal with one or more `{name}`s, each family once; `names` in order. */
export function familyPattern(node: Node): { text: string; names: string[] } | undefined {
  if (node.type !== 'string') return undefined;
  const names = [...node.value.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g)].map((m) => m[1] as string);
  if (names.length === 0 || new Set(names).size !== names.length) return undefined;
  return { text: node.value, names };
}

export function patternIds(
  pattern: { text: string; names: string[] },
  family: (name: string) => readonly string[] | undefined,
): string[] | { unknown: string } {
  let ids = [pattern.text];
  for (const name of pattern.names) {
    const keys = family(name);
    if (!keys) return { unknown: name };
    ids = ids.flatMap((id) => keys.map((k) => id.replace(`{${name}}`, k)));
  }
  return ids;
}

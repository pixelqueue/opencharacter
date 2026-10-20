import { familyPattern, patternIds } from './evaluate.ts';
import {
  AGGREGATE_ROOT,
  aggregateArgs,
  aggregateOver,
  type Over,
  readsCharacter,
  reduceOf,
  staticFilterProblem,
} from './aggregates.ts';
import type { Node } from './ast.ts';
import { fail } from './errors.ts';

/** A formula type. `dyn` is unknown until evaluation. */
export type FType =
  | 'int'
  | 'decimal'
  | 'bool'
  | 'string'
  | 'null'
  | 'dice'
  | 'dyn'
  | { list: FType }
  | ObjectType;

/** A closed object rejects unknown keys (`unknown-name`); an open one reads them as `dyn`. */
export interface ObjectType {
  object: Record<string, FType>;
  open?: boolean;
  /** Members that exist but can't be read here; reading one is `unknown-name`. */
  hidden?: Record<string, FType>;
}

const isObject = (t: FType): t is ObjectType => typeof t === 'object' && 'object' in t;
const isList = (t: FType): t is { list: FType } => typeof t === 'object' && 'list' in t;

export interface CheckContext {
  /** The formula type of a visible field, or undefined when no field has this ID. */
  field(id: string): FType | undefined;
  roots: ReadonlySet<string>;
  /** Types of bound roots; a root without one is `dyn`. */
  rootTypes?: Readonly<Record<string, FType>>;
  /** Whether the copy and field aggregates and the deprecated character functions are bound. */
  character: boolean;
  /** Whether `hasChoice` is bound (display hints' `showWhen`). */
  choices?: boolean;
  /** Whether `picksOf` is bound: the formula has an owner whose choices it can read. */
  picks?: boolean;
  /** Inside an aggregate's argument, where no aggregate is bound again. */
  inAggregate?: boolean;
  /** Whether an ID literal names content or a field the pack sees; unbound, any ID passes. */
  id?(text: string): boolean;
  /** A family's values, by the name the pack sees. Unbound: any family, `dyn`. */
  family?(name: string): readonly string[] | undefined;
  /** The result may be `null`: a `?:` branch that is `null` takes the other branch's type. */
  nullable?: boolean;
}

/** Open; `state` and `fields` are `dyn`, since one call spans many content types. */
export const COPY: ObjectType = {
  object: {
    id: 'string',
    item: 'string',
    type: 'string',
    tags: { list: 'string' },
    equipped: 'bool',
    quantity: 'int',
    templates: { list: 'string' },
    state: 'dyn',
    fields: 'dyn',
  },
  open: true,
};

export const FIELD_ROOT: ObjectType = {
  object: { id: 'string', type: 'string', tags: { list: 'string' }, value: 'dyn' },
};

const FIELD_FILTER_ROOT: ObjectType = {
  object: { id: 'string', type: 'string', tags: { list: 'string' } },
};

export function typeName(type: FType): string {
  if (typeof type === 'string') return type;
  if (isList(type)) return `list<${typeName(type.list)}>`;
  return `{${Object.keys(type.object).join(', ')}${type.open ? ', …' : ''}}`;
}

export function parseTypeName(name: string): FType {
  const match = /^list<(.+)>$/.exec(name);
  return match ? { list: parseTypeName(match[1] as string) } : (name as FType);
}

/** Maps a field's declared type (packages/spec/data/value-types.json) to its formula type. */
export function fieldFormulaType(declared: string): FType {
  switch (declared) {
    case 'integer':
      return 'int';
    case 'decimal':
      return 'decimal';
    case 'boolean':
      return 'bool';
    case 'dice':
      return 'dice';
    case 'set':
      return { list: 'string' };
    default:
      return 'string';
  }
}

const isNum = (t: FType) => t === 'int' || t === 'decimal';
const isDice = (t: FType) => t === 'dice' || t === 'int';
const same = (a: FType, b: FType): boolean => typeName(a) === typeName(b);

export function assignable(actual: FType, expected: FType): boolean {
  if (actual === 'dyn' || expected === 'dyn' || same(actual, expected)) return true;
  if (actual === 'int' && (expected === 'decimal' || expected === 'dice')) return true;
  if (isList(actual) && isList(expected)) return assignable(actual.list, expected.list);
  return false;
}

function unify(a: FType, b: FType): FType | undefined {
  if (a === 'dyn' || b === 'dyn') return 'dyn';
  if (same(a, b)) return a;
  if (isNum(a) && isNum(b)) return 'decimal';
  if ((a === 'dice' && b === 'int') || (a === 'int' && b === 'dice')) return 'dice';
  if (isList(a) && isList(b)) {
    const inner = unify(a.list, b.list);
    return inner ? { list: inner } : undefined;
  }
  if (isObject(a) && isObject(b)) return 'dyn';
  return undefined;
}

const mismatch = (message: string): never => fail('type-mismatch', message);

export function checkTree(node: Node, ctx: CheckContext): FType {
  // Only the formula's result may be null: a `?:` passes that on to its branches.
  if (ctx.nullable && node.type !== 'conditional') ctx = { ...ctx, nullable: false };
  const check = (n: Node) => checkTree(n, ctx);
  switch (node.type) {
    case 'int':
    case 'decimal':
    case 'string':
    case 'null':
      return node.type;
    case 'ref':
      if (ctx.id && !ctx.id(node.id))
        return fail('unknown-name', `no content or field @${node.id}`, { id: node.id });
      return 'string';
    case 'bool':
      return 'bool';
    case 'list': {
      let item: FType | undefined;
      for (const n of node.items) {
        const t = check(n);
        item = item === undefined ? t : unify(item, t);
        if (item === undefined) return mismatch('list items must have one type');
      }
      return { list: item ?? 'dyn' };
    }
    case 'name': {
      const root = node.path[0] as string;
      if (ctx.roots.has(root)) {
        let type: FType = ctx.rootTypes?.[root] ?? 'dyn';
        node.path.slice(1).forEach((segment, i) => {
          type = select(type, segment, node.path.slice(0, i + 2).join('.'));
        });
        return type;
      }
      const field = ctx.field(node.path.join('.'));
      if (field !== undefined) return field;
      return fail(
        'unknown-name',
        `"${node.path.join('.')}" is not a bound root or a visible field`,
        {
          name: node.path.join('.'),
        },
      );
    }
    case 'member':
      return select(check(node.object), node.name, node.name);
    case 'index': {
      const object = check(node.object);
      const index = check(node.index);
      if (index !== 'int' && index !== 'dyn') return mismatch('list index must be an int');
      if (object === 'dyn') return 'dyn';
      if (isList(object)) return object.list;
      return mismatch(`cannot index ${typeName(object)}`);
    }
    case 'call':
      return checkCall(node.fn, node.args, ctx);
    case 'unary': {
      const t = check(node.operand);
      if (node.op === '!') return t === 'bool' || t === 'dyn' ? 'bool' : mismatch('! needs a bool');
      if (isNum(t) || t === 'dice' || t === 'dyn') return t;
      return mismatch('unary - needs a number or dice');
    }
    case 'conditional': {
      const test = checkTree(node.test, { ...ctx, nullable: false });
      if (test !== 'bool' && test !== 'dyn') return mismatch('a condition must be a bool');
      const [then, other] = [check(node.then), check(node.else)];
      if (ctx.nullable && then === 'null') return other;
      if (ctx.nullable && other === 'null') return then;
      const result = unify(then, other);
      return result ?? mismatch('the branches of ?: have incompatible types');
    }
    case 'dice': {
      if (typeof node.count !== 'number') {
        const count = check(node.count);
        if (count !== 'int' && count !== 'dyn') return mismatch('a dice count must be an int');
      }
      return 'dice';
    }
    case 'binary': {
      const l = check(node.left);
      const r = check(node.right);
      const dyn = l === 'dyn' || r === 'dyn';
      switch (node.op) {
        case '&&':
        case '||':
          if ((l === 'bool' || l === 'dyn') && (r === 'bool' || r === 'dyn')) return 'bool';
          return mismatch(`${node.op} needs bools`);
        case '==':
        case '!=':
          if (l === 'dice' || r === 'dice') return mismatch('dice cannot be compared');
          return 'bool';
        case 'in':
          if (r === 'dyn') return 'bool';
          if (!isList(r)) return mismatch('in needs a list on the right');
          if (l === 'dice') return mismatch('dice cannot be compared');
          return 'bool';
        case '<':
        case '<=':
        case '>':
        case '>=':
          if (dyn || (isNum(l) && isNum(r)) || (l === 'string' && r === 'string')) {
            if (l === 'dice' || r === 'dice') return mismatch('dice cannot be compared');
            return 'bool';
          }
          return mismatch(`${node.op} needs two numbers or two strings`);
        case '+':
        case '-': {
          if (l === 'int' && r === 'int') return 'int';
          if (isNum(l) && isNum(r)) return 'decimal';
          if ((l === 'dice' || l === 'int') && (r === 'dice' || r === 'int')) return 'dice';
          if (node.op === '+' && l === 'string' && r === 'string') return 'string';
          if (node.op === '+' && isList(l) && isList(r)) {
            return unify(l, r) ?? mismatch('lists of different types');
          }
          if (dyn) {
            const other = l === 'dyn' ? r : l;
            if (other === 'bool' || other === 'null')
              return mismatch(`${node.op} cannot take ${other}`);
            if (node.op === '-' && (other === 'string' || typeof other === 'object'))
              return mismatch('- needs numbers or dice');
            if (isObject(other)) return mismatch(`${node.op} cannot take an object`);
            return 'dyn';
          }
          return mismatch(`${node.op} cannot combine ${typeName(l)} and ${typeName(r)}`);
        }
        case '*':
          if (l === 'int' && r === 'int') return 'int';
          if (
            (l === 'dice' && (r === 'int' || r === 'dyn')) ||
            (r === 'dice' && (l === 'int' || l === 'dyn'))
          )
            return 'dice';
          if ((isNum(l) || l === 'dyn') && (isNum(r) || r === 'dyn'))
            return dyn ? 'dyn' : 'decimal';
          return mismatch('* needs numbers');
        case '/':
          if ((isNum(l) || l === 'dyn') && (isNum(r) || r === 'dyn')) return 'decimal';
          return mismatch('/ needs numbers');
        case '%':
          if ((l === 'int' || l === 'dyn') && (r === 'int' || r === 'dyn')) return 'int';
          return mismatch('% needs ints');
      }
    }
  }
}

function select(type: FType, key: string, path: string): FType {
  if (type === 'dyn') return 'dyn';
  if (isObject(type)) {
    const member = type.object[key];
    if (member !== undefined) return member;
    if (type.hidden?.[key] !== undefined)
      return fail(
        'unknown-name',
        `"${path}" is a computed value, which only the copy's own actions and follow-ups, and its later computed values, read`,
        { name: path },
      );
    if (type.open) return 'dyn';
    return fail('unknown-name', `"${path}" names nothing: there is no "${key}" here`, {
      name: path,
    });
  }
  return mismatch(`cannot select "${key}" from ${typeName(type)}`);
}

function checkCall(fn: string, args: Node[], ctx: CheckContext): FType {
  const over = aggregateOver(fn);
  if (over) return checkAggregate(fn, over, args, ctx);
  const types = () => args.map((a) => checkTree(a, ctx));
  const arity = (min: number, max = min) => {
    if (args.length < min || args.length > max)
      fail(
        'wrong-arity',
        `${fn}() takes ${min === max ? min : `${min} to ${max}`} argument${max === 1 ? '' : 's'}`,
      );
  };
  const wants = (t: FType, ok: (t: FType) => boolean, what: string) => {
    if (t !== 'dyn' && !ok(t)) mismatch(`${fn}() needs ${what}`);
  };
  switch (fn) {
    case 'has': {
      arity(1);
      const arg = args[0] as Node;
      if (arg.type !== 'name' && arg.type !== 'member')
        return mismatch('has() takes a name or a member path');
      if (
        arg.type === 'name' &&
        !ctx.roots.has(arg.path[0] as string) &&
        ctx.field(arg.path.join('.')) === undefined
      ) {
        return fail(
          'unknown-name',
          `"${arg.path.join('.')}" is not a bound root or a visible field`,
        );
      }
      // On typed roots, the path must name something that can exist (it may be absent).
      if (arg.type === 'name' && ctx.roots.has(arg.path[0] as string)) checkTree(arg, ctx);
      if (arg.type === 'member') checkTree(arg.object, ctx);
      return 'bool';
    }
    case 'min':
    case 'max': {
      if (args.length < 1) fail('wrong-arity', `${fn}() takes one or more arguments`);
      const ts = types();
      for (const t of ts) wants(t, isNum, 'numbers');
      if (ts.every((t) => t === 'int')) return 'int';
      return ts.some((t) => t === 'dyn') ? 'dyn' : 'decimal';
    }
    case 'floor':
    case 'ceil':
    case 'round':
    case 'trunc':
      arity(1);
      wants(types()[0] as FType, isNum, 'a number');
      return 'int';
    case 'abs': {
      arity(1);
      const t = types()[0] as FType;
      wants(t, isNum, 'a number');
      return t;
    }
    case 'size':
      arity(1);
      wants(types()[0] as FType, (t) => t === 'string' || isList(t), 'a list or a string');
      return 'int';
    case 'count':
      arity(2);
      wants(types()[0] as FType, (t) => isList(t), 'a list');
      return 'int';
    case 'countEquipped':
    case 'countState':
    case 'sumState':
      if (!ctx.character)
        return fail('unknown-function', `${fn}() needs a character and is not bound here`);
      arity(fn === 'sumState' ? 2 : 1);
      for (const t of types()) wants(t, (x) => x === 'string', 'strings');
      return 'int';
    case 'string':
      arity(1);
      wants(
        types()[0] as FType,
        (t) => t === 'int' || t === 'string' || t === 'bool',
        'an int, a string or a bool',
      );
      return 'string';
    case 'hasChoice':
      if (!ctx.choices)
        return fail('unknown-function', 'hasChoice() is bound only in display hints');
      arity(1);
      wants(types()[0] as FType, (t) => t === 'string', 'a string');
      return 'bool';
    case 'picksOf': {
      if (!ctx.picks)
        return fail('unknown-function', 'picksOf() is bound only where the formula has an owner');
      arity(1);
      if (args[0]?.type !== 'string')
        return mismatch('picksOf() takes a choice ID, a string literal');
      return { list: 'dyn' };
    }
    case 'indexOf':
      arity(2);
      wants(types()[0] as FType, (t) => isList(t), 'a list');
      return 'int';
    case 'keysOf': {
      arity(1);
      const [name] = args;
      if (name?.type !== 'string')
        return mismatch('keysOf() takes a family name, a string literal');
      const keys = ctx.family?.(name.value);
      if (ctx.family && !keys)
        return fail('unknown-name', `no family named "${name.value}"`, { id: name.value });
      if (!keys) return 'dyn';
      return { list: keys.every((k) => /^\d+$/.test(k)) ? 'int' : 'string' };
    }
    case 'fieldOf': {
      const [pattern, ...keyArgs] = args as [Node, ...Node[]];
      const family = pattern && familyPattern(pattern);
      if (!family)
        return mismatch('fieldOf() takes a string literal pattern with {family} placeholders');
      arity(family.names.length + 1);
      for (const key of keyArgs)
        wants(checkTree(key, ctx), (t) => t === 'string' || t === 'int', 'a string or int key');
      if (!ctx.family) return 'dyn';
      const ids = patternIds(family, (name) => ctx.family?.(name));
      if (!Array.isArray(ids))
        return fail('unknown-name', `no family named "${ids.unknown}"`, { id: ids.unknown });
      let type: FType | undefined;
      for (const id of ids) {
        const t = ctx.field(id);
        if (t === undefined) return fail('unknown-name', `no field ${id}`, { id });
        if (type !== undefined && typeName(t) !== typeName(type))
          return mismatch(`fieldOf() fields have different types (${id})`);
        type = t;
      }
      return type ?? 'dyn';
    }
    case 'countOf':
      arity(1);
      wants(types()[0] as FType, isDice, 'dice');
      return 'int';
    case 'maxOf':
    case 'minOf':
      arity(1);
      wants(types()[0] as FType, isDice, 'dice');
      return 'int';
    case 'dieOf': {
      arity(1, 2);
      const [value, count] = types() as [FType, FType | undefined];
      wants(value, isDice, 'dice');
      if (count !== undefined) wants(count, (t) => t === 'int', 'an int count');
      return 'dice';
    }
    default:
      return fail('unknown-function', `unknown function ${fn}()`, { function: fn });
  }
}

function checkAggregate(fn: string, over: Over, args: Node[], ctx: CheckContext): FType {
  if (ctx.inAggregate || (readsCharacter(over) && !ctx.character)) {
    const why = ctx.inAggregate ? 'inside another aggregate' : 'without a character';
    return fail('unknown-function', `${fn}() is not bound ${why}`, { function: fn });
  }
  const parts = aggregateArgs(fn, over, args);
  const inner: CheckContext = { ...ctx, inAggregate: true };
  let rootType: FType = over === 'copies' ? COPY : FIELD_ROOT;
  if (parts.list) {
    // Evaluated once, outside the per-element context, so it may be an aggregate.
    const list = checkTree(parts.list, ctx);
    if (list !== 'dyn' && !isList(list)) return mismatch(`${fn}() needs a list`);
    rootType = list === 'dyn' ? 'dyn' : list.list;
  }
  const root = AGGREGATE_ROOT[over];
  const bound: CheckContext = {
    ...inner,
    roots: new Set([...ctx.roots, root]),
    rootTypes: { ...ctx.rootTypes, [root]: rootType },
  };
  if (parts.cond) {
    let t: FType;
    if (over === 'fields') {
      const problem = staticFilterProblem(fn, parts.cond);
      if (problem) return mismatch(problem);
      t = checkTree(parts.cond, {
        field: () => undefined,
        roots: new Set(['f']),
        rootTypes: { f: FIELD_FILTER_ROOT },
        character: false,
        inAggregate: true,
      });
    } else t = checkTree(parts.cond, bound);
    if (t !== 'bool' && t !== 'dyn') mismatch(`${fn}() needs a bool condition`);
  }
  const reduce = reduceOf(fn);
  if (reduce === 'count') return 'int';
  if (reduce === 'filter') return { list: rootType };
  if (reduce === 'map') return { list: checkTree(parts.value as Node, bound) };
  if (reduce === 'sort') {
    if (parts.value) {
      const key = checkTree(parts.value, bound);
      if (key !== 'dyn' && !isNum(key) && key !== 'string')
        mismatch(`${fn}() sorts by numbers or strings`);
    } else if (rootType !== 'dyn' && !isNum(rootType) && rootType !== 'string')
      mismatch(`${fn}() sorts numbers or strings; give a key`);
    return { list: rootType };
  }
  const value = checkTree(parts.value as Node, bound);
  if (value !== 'dyn' && !isNum(value)) mismatch(`${fn}() needs a number to reduce`);
  return value;
}

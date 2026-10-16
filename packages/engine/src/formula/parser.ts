import { type BinaryOp, MODIFIER_ORDER, type Node } from './ast.ts';
import { fail } from './errors.ts';
import { type Token, tokenize } from './lexer.ts';
import { LIMITS } from './limits.ts';

const RELATIONS = new Set(['<', '<=', '>', '>=', '==', '!=']);

/** Parses formula text into a tree. Throws FormulaFailure (`formula-syntax`, `safety-limit-exceeded`). */
export function parseTree(text: string): Node {
  const tokens = tokenize(text);
  let pos = 0;
  let depth = 0;

  const peek = (): Token => tokens[pos] as Token;
  const next = (): Token => tokens[pos++] as Token;
  const isOp = (value: string, token = peek()) => token.kind === 'op' && token.value === value;
  const expectOp = (value: string): void => {
    const token = next();
    if (!(token.kind === 'op' && token.value === value)) {
      fail('formula-syntax', `expected "${value}"`, { offset: token.offset, expected: value });
    }
  };

  const enter = () => {
    // A recursion guard; the precise limit is checked on the finished tree.
    if (++depth > LIMITS.maxFormulaDepth * 4) {
      fail('safety-limit-exceeded', 'formula is nested too deeply', { limit: 'maxFormulaDepth' });
    }
  };

  function expr(): Node {
    enter();
    const test = or();
    let node = test;
    if (isOp('?')) {
      next();
      const then = or();
      expectOp(':');
      // `then` is tree data, not a function, so the object is not a thenable.
      // oxlint-disable-next-line unicorn/no-thenable
      node = { type: 'conditional', test, then, else: expr() };
    }
    depth--;
    return node;
  }

  function binaryLevel(operand: () => Node, accepts: (token: Token) => BinaryOp | undefined): Node {
    let left = operand();
    for (;;) {
      const op = accepts(peek());
      if (!op) return left;
      next();
      left = { type: 'binary', op, left, right: operand() };
    }
  }

  const or = (): Node => binaryLevel(and, (t) => (isOp('||', t) ? '||' : undefined));
  const and = (): Node => binaryLevel(relation, (t) => (isOp('&&', t) ? '&&' : undefined));
  const relation = (): Node =>
    binaryLevel(addition, (t) => {
      if (t.kind === 'keyword' && t.value === 'in') return 'in';
      return t.kind === 'op' && RELATIONS.has(t.value) ? (t.value as BinaryOp) : undefined;
    });
  const addition = (): Node =>
    binaryLevel(multiplication, (t) =>
      t.kind === 'op' && (t.value === '+' || t.value === '-') ? t.value : undefined,
    );
  const multiplication = (): Node =>
    binaryLevel(unary, (t) =>
      t.kind === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')
        ? t.value
        : undefined,
    );

  function unary(): Node {
    const token = peek();
    if (token.kind === 'op' && (token.value === '!' || token.value === '-')) {
      next();
      enter();
      const operand = unary();
      depth--;
      return { type: 'unary', op: token.value, operand };
    }
    return postfix();
  }

  function postfix(): Node {
    let node = primary();
    for (;;) {
      if (isOp('.')) {
        next();
        const name = next();
        if (name.kind !== 'ident') {
          return fail('formula-syntax', 'expected a name after "."', {
            offset: name.offset,
            expected: 'identifier',
          });
        }
        if (isOp('(')) {
          fail('formula-syntax', 'method calls are not part of the formula language', {
            offset: name.offset,
          });
        }
        node =
          node.type === 'name'
            ? { type: 'name', path: [...node.path, name.value] }
            : { type: 'member', object: node, name: name.value };
      } else if (isOp('[')) {
        next();
        const index = expr();
        expectOp(']');
        node = { type: 'index', object: node, index };
      } else {
        return node;
      }
    }
  }

  function list(close: string): Node[] {
    const items: Node[] = [];
    if (isOp(close)) {
      next();
      return items;
    }
    for (;;) {
      items.push(expr());
      if (isOp(',')) {
        next();
        if (isOp(close)) unexpected(peek());
        continue;
      }
      expectOp(close);
      return items;
    }
  }

  function primary(): Node {
    const token = next();
    switch (token.kind) {
      case 'int':
        return { type: 'int', value: token.value };
      case 'decimal':
        return { type: 'decimal', value: token.value };
      case 'string':
        return { type: 'string', value: token.value };
      case 'ref':
        return { type: 'ref', id: token.value };
      case 'keyword':
        if (token.value === 'true' || token.value === 'false')
          return { type: 'bool', value: token.value === 'true' };
        if (token.value === 'null') return { type: 'null' };
        return unexpected(token);
      case 'dice':
        return {
          type: 'dice',
          count: token.count,
          sides: token.sides,
          ...(token.zero ? { zero: true as const } : {}),
          modifiers: ordered(token.modifiers),
        };
      case 'ident':
        if (isOp('(')) {
          next();
          return { type: 'call', fn: token.value, args: list(')') };
        }
        return { type: 'name', path: [token.value] };
      case 'op':
        if (token.value === '(') {
          const inner = expr();
          expectOp(')');
          const suffix = peek();
          if (suffix.kind === 'diceSuffix') {
            next();
            const count = inner.type === 'int' ? inner.value : inner;
            return {
              type: 'dice',
              count,
              sides: suffix.sides,
              ...(suffix.zero ? { zero: true as const } : {}),
              modifiers: ordered(suffix.modifiers),
            };
          }
          return inner;
        }
        if (token.value === '[') return { type: 'list', items: list(']') };
        return unexpected(token);
      default:
        return unexpected(token);
    }
  }

  const tree = expr();
  if (peek().kind !== 'eof') unexpected(peek());
  if (treeDepth(tree) > LIMITS.maxFormulaDepth) {
    fail('safety-limit-exceeded', 'formula is nested too deeply', { limit: 'maxFormulaDepth' });
  }
  return tree;
}

function unexpected(token: Token): never {
  return fail(
    'formula-syntax',
    token.kind === 'eof' ? 'unexpected end of formula' : 'unexpected token',
    {
      offset: token.offset,
      expected: 'expression',
    },
  );
}

function ordered<T extends { type: (typeof MODIFIER_ORDER)[number] }>(modifiers: T[]): T[] {
  return modifiers.toSorted(
    (a, b) => MODIFIER_ORDER.indexOf(a.type) - MODIFIER_ORDER.indexOf(b.type),
  );
}

export function treeDepth(node: Node): number {
  return 1 + Math.max(0, ...children(node).map(treeDepth));
}

export function children(node: Node): Node[] {
  switch (node.type) {
    case 'list':
      return node.items;
    case 'member':
      return [node.object];
    case 'index':
      return [node.object, node.index];
    case 'call':
      return node.args;
    case 'unary':
      return [node.operand];
    case 'binary':
      return [node.left, node.right];
    case 'conditional':
      return [node.test, node.then, node.else];
    case 'dice':
      return typeof node.count === 'number' ? [] : [node.count];
    default:
      return [];
  }
}

import {
  binaryPrecedence,
  type DiceModifier,
  type Node,
  nodePrecedence,
  PRECEDENCE,
} from './ast.ts';

/** Prints a tree as canonical formula text (packages/spec/docs/formulas.md, "The tree"). */
export function printTree(node: Node): string {
  switch (node.type) {
    case 'int':
      return String(node.value);
    case 'decimal':
      return printDecimal(node.value);
    case 'string':
      return printString(node.value);
    case 'ref':
      return `@${node.id}`;
    case 'bool':
      return node.value ? 'true' : 'false';
    case 'null':
      return 'null';
    case 'list':
      return `[${node.items.map(printTree).join(', ')}]`;
    case 'name':
      return node.path.join('.');
    case 'member':
      return `${wrap(node.object, PRECEDENCE.postfix)}.${node.name}`;
    case 'index':
      return `${wrap(node.object, PRECEDENCE.postfix)}[${printTree(node.index)}]`;
    case 'call':
      return `${node.fn}(${node.args.map(printTree).join(', ')})`;
    case 'unary':
      return `${node.op}${wrap(node.operand, PRECEDENCE.unary)}`;
    case 'binary': {
      const level = binaryPrecedence(node.op);
      // Left-associative: the right operand at the same level needs parentheses.
      return `${wrap(node.left, level)} ${node.op} ${wrap(node.right, level + 1)}`;
    }
    case 'conditional':
      // Grammar: Or ? Or : Expr. Test and then-branch can't be conditionals without parentheses.
      return `${wrap(node.test, PRECEDENCE.or)} ? ${wrap(node.then, PRECEDENCE.or)} : ${printTree(node.else)}`;
    case 'dice': {
      const count =
        typeof node.count === 'number' ? String(node.count) : `(${printTree(node.count)})`;
      return `${count}d${node.sides}${node.zero ? 'z' : ''}${node.modifiers.map(printModifier).join('')}`;
    }
  }
}

function wrap(node: Node, minimum: number): string {
  const text = printTree(node);
  return nodePrecedence(node) < minimum ? `(${text})` : text;
}

/** The shortest round-trip digits of a decimal, written out without an exponent, with a `.`. */
export function printDecimal(value: number): string {
  let text = String(value);
  const match = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(text);
  if (match) {
    const digits = (match[1] ?? '') + (match[2] ?? '');
    const exponent = Number(match[3]);
    if (exponent >= 0) {
      const whole = digits.padEnd(exponent + 1, '0');
      const fraction = digits.slice(exponent + 1);
      text = fraction ? `${whole.slice(0, exponent + 1)}.${fraction}` : whole;
    } else {
      text = `0.${'0'.repeat(-exponent - 1)}${digits}`;
    }
  }
  return text.includes('.') ? text : `${text}.0`;
}

function printString(value: string): string {
  let out = "'";
  for (const ch of value) {
    if (ch === '\\') out += '\\\\';
    else if (ch === "'") out += "\\'";
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch < ' ' || ch === '\u007f')
      out += `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return `${out}'`;
}

const SPELLING: Record<DiceModifier['type'], string> = {
  keepHighest: 'kh',
  keepLowest: 'kl',
  dropHighest: 'dh',
  dropLowest: 'dl',
  explode: '!',
  explodeCompound: '!!',
  reroll: 'r',
  rerollOnce: 'ro',
  countSuccesses: 'cs',
  countFailures: 'cf',
  minimum: 'min',
  maximum: 'max',
};

function printModifier(modifier: DiceModifier): string {
  const spelling = SPELLING[modifier.type];
  // A reroll's `count` (from a `reroll` roll modifier) has no text form.
  if (modifier.count !== undefined && modifier.type !== 'reroll' && modifier.type !== 'rerollOnce')
    return `${spelling}${modifier.count}`;
  if (modifier.target === undefined) return spelling;
  const compare =
    modifier.compare === undefined || modifier.compare === '=' ? '' : modifier.compare;
  return `${spelling}${compare}${modifier.target}`;
}

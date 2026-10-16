// The formula tree: plain JSON, defined by packages/spec/docs/formulas.md ("The tree") and
// packages/spec/schemas/formula.schema.json#/$defs/tree.

export type DiceModifierType =
  | 'reroll'
  | 'rerollOnce'
  | 'explode'
  | 'explodeCompound'
  | 'minimum'
  | 'maximum'
  | 'keepHighest'
  | 'keepLowest'
  | 'dropHighest'
  | 'dropLowest'
  | 'countSuccesses'
  | 'countFailures';

export type Compare = '=' | '<' | '<=' | '>' | '>=';

export interface DiceModifier {
  type: DiceModifierType;
  count?: number;
  compare?: Compare;
  target?: number;
}

/** Modifiers in the order they are applied (and stored, and printed). */
export const MODIFIER_ORDER: readonly DiceModifierType[] = [
  'reroll',
  'rerollOnce',
  'explode',
  'explodeCompound',
  'minimum',
  'maximum',
  'keepHighest',
  'keepLowest',
  'dropHighest',
  'dropLowest',
  'countSuccesses',
  'countFailures',
];

export const KEEP_DROP: ReadonlySet<DiceModifierType> = new Set([
  'keepHighest',
  'keepLowest',
  'dropHighest',
  'dropLowest',
]);

export type BinaryOp =
  | '||'
  | '&&'
  | '<'
  | '<='
  | '>'
  | '>='
  | '=='
  | '!='
  | 'in'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%';

export type Node =
  | { type: 'int'; value: number }
  | { type: 'decimal'; value: number }
  | { type: 'string'; value: string }
  | { type: 'ref'; id: string }
  | { type: 'bool'; value: boolean }
  | { type: 'null' }
  | { type: 'list'; items: Node[] }
  | { type: 'name'; path: string[] }
  | { type: 'member'; object: Node; name: string }
  | { type: 'index'; object: Node; index: Node }
  | { type: 'call'; fn: string; args: Node[] }
  | { type: 'unary'; op: '-' | '!'; operand: Node }
  | { type: 'binary'; op: BinaryOp; left: Node; right: Node }
  | { type: 'conditional'; test: Node; then: Node; else: Node }
  | {
      type: 'dice';
      count: number | Node;
      sides: number | 'F';
      /** Zero-based die (`d100z`): faces 0 to sides - 1. Present only when true. */
      zero?: true;
      modifiers: DiceModifier[];
    };

export type NodeOf<T extends Node['type']> = Extract<Node, { type: T }>;

/** Precedence levels, lowest first. */
export const PRECEDENCE = {
  conditional: 1,
  or: 2,
  and: 3,
  relation: 4,
  addition: 5,
  multiplication: 6,
  unary: 7,
  postfix: 8,
  primary: 9,
} as const;

export function binaryPrecedence(op: BinaryOp): number {
  switch (op) {
    case '||':
      return PRECEDENCE.or;
    case '&&':
      return PRECEDENCE.and;
    case '+':
    case '-':
      return PRECEDENCE.addition;
    case '*':
    case '/':
    case '%':
      return PRECEDENCE.multiplication;
    default:
      return PRECEDENCE.relation;
  }
}

export function nodePrecedence(node: Node): number {
  switch (node.type) {
    case 'conditional':
      return PRECEDENCE.conditional;
    case 'binary':
      return binaryPrecedence(node.op);
    case 'unary':
      return PRECEDENCE.unary;
    case 'member':
    case 'index':
      return PRECEDENCE.postfix;
    default:
      return PRECEDENCE.primary;
  }
}

import { type Compare, type DiceModifier, type DiceModifierType, KEEP_DROP } from './ast.ts';
import { fail } from './errors.ts';
import { LIMITS, MAX_INT } from './limits.ts';
import { DECIMAL_PLACES, roundDecimal } from './values.ts';

export type Token =
  | { kind: 'ident'; value: string; offset: number }
  | { kind: 'keyword'; value: 'true' | 'false' | 'null' | 'in'; offset: number }
  | { kind: 'int'; value: number; offset: number }
  /** `places`: the digits written after the point. */
  | { kind: 'decimal'; value: number; places: number; offset: number }
  | { kind: 'string'; value: string; offset: number }
  | { kind: 'ref'; value: string; offset: number }
  | {
      kind: 'dice';
      count: number;
      sides: number | 'F';
      zero: boolean;
      modifiers: DiceModifier[];
      offset: number;
    }
  | {
      kind: 'diceSuffix';
      sides: number | 'F';
      zero: boolean;
      modifiers: DiceModifier[];
      offset: number;
    }
  | { kind: 'op'; value: string; offset: number }
  | { kind: 'eof'; offset: number };

const KEYWORDS = new Set(['true', 'false', 'null', 'in']);
export const RESERVED = new Set([
  'as',
  'break',
  'const',
  'continue',
  'else',
  'for',
  'function',
  'if',
  'import',
  'let',
  'loop',
  'package',
  'namespace',
  'return',
  'var',
  'void',
  'while',
]);
const OPERATORS = [
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '!',
  '?',
  ':',
  '(',
  ')',
  '[',
  ']',
  ',',
  '.',
];

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';
const isIdentStart = (c: string | undefined) => c !== undefined && /[A-Za-z_]/.test(c);
const isIdentChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_]/.test(c);

function syntax(message: string, offset: number, expected?: string): never {
  return fail('formula-syntax', message, expected ? { offset, expected } : { offset });
}

export function tokenize(text: string): Token[] {
  if (text.length > LIMITS.maxFormulaLength) {
    fail('safety-limit-exceeded', 'formula is too long', { limit: 'maxFormulaLength' });
  }
  const tokens: Token[] = [];
  let i = 0;

  const readInt = (): number => {
    const start = i;
    while (isDigit(text[i])) i++;
    const digits = text.slice(start, i);
    if (digits.length === 0) syntax('expected a number', start, 'integer');
    if (digits.length > 1 && digits[0] === '0') syntax('numbers cannot have leading zeros', start);
    const value = Number(digits);
    if (value > MAX_INT) syntax('integer is too large', start);
    return value;
  };

  const readDiceSuffix = (): { sides: number | 'F'; zero: boolean; modifiers: DiceModifier[] } => {
    i++;
    let sides: number | 'F';
    const digits = text[i] !== '%' && text[i] !== 'F';
    if (text[i] === '%') {
      sides = 100;
      i++;
    } else if (text[i] === 'F') {
      sides = 'F';
      i++;
    } else {
      const at = i;
      sides = readInt();
      if (sides < 1) syntax('dice need at least one side', at);
    }
    // `z`: a zero-based die, faces 0 to sides - 1 (1d100z reads 00–99).
    let zero = false;
    if (text[i] === 'z' && digits) {
      zero = true;
      i++;
    }
    const modifiers: DiceModifier[] = [];
    const seen = new Set<DiceModifierType>();
    const add = (modifier: DiceModifier, at: number) => {
      if (seen.has(modifier.type)) syntax(`dice modifier ${modifier.type} appears twice`, at);
      if (KEEP_DROP.has(modifier.type) && [...seen].some((t) => KEEP_DROP.has(t))) {
        syntax('only one keep or drop modifier is allowed', at);
      }
      if ((modifier.type === 'explode' || modifier.type === 'explodeCompound') && sides === 'F') {
        syntax('Fate dice cannot explode', at);
      }
      seen.add(modifier.type);
      modifiers.push(modifier);
    };
    const readCompare = (optional: boolean): { compare: Compare; target: number } | undefined => {
      let compare: Compare = '=';
      for (const op of ['<=', '>=', '<', '>', '='] as const) {
        if (text.startsWith(op, i)) {
          compare = op;
          i += op.length;
          return { compare, target: readInt() };
        }
      }
      if (isDigit(text[i])) return { compare, target: readInt() };
      if (optional) return undefined;
      return syntax('expected a comparison or a number', i, 'comparison');
    };
    for (;;) {
      const at = i;
      const keep = (['kh', 'kl', 'dh', 'dl'] as const).find((p) => text.startsWith(p, i));
      if (keep) {
        i += 2;
        const type = (
          { kh: 'keepHighest', kl: 'keepLowest', dh: 'dropHighest', dl: 'dropLowest' } as const
        )[keep];
        add({ type, count: isDigit(text[i]) ? readInt() : 1 }, at);
      } else if (text.startsWith('!!', i)) {
        i += 2;
        add({ type: 'explodeCompound', ...readCompare(true) }, at);
      } else if (text[i] === '!') {
        i += 1;
        add({ type: 'explode', ...readCompare(true) }, at);
      } else if (text.startsWith('ro', i)) {
        i += 2;
        add({ type: 'rerollOnce', ...readCompare(false) }, at);
      } else if (text.startsWith('min', i) || text.startsWith('max', i)) {
        const type = text.startsWith('min', i) ? 'minimum' : 'maximum';
        i += 3;
        add({ type, target: readInt() }, at);
      } else if (text[i] === 'r') {
        i += 1;
        add({ type: 'reroll', ...readCompare(false) }, at);
      } else if (text.startsWith('cs', i) || text.startsWith('cf', i)) {
        const type = text.startsWith('cs', i) ? 'countSuccesses' : 'countFailures';
        i += 2;
        add({ type, ...readCompare(false) }, at);
      } else {
        break;
      }
    }
    if (isIdentChar(text[i])) syntax('unknown dice modifier', i, 'dice modifier');
    return { sides, zero, modifiers };
  };

  const diceFollows = () =>
    text[i] === 'd' && (isDigit(text[i + 1]) || text[i + 1] === '%' || text[i + 1] === 'F');

  while (i < text.length) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    const start = i;
    if (isDigit(c)) {
      let j = i;
      while (isDigit(text[j])) j++;
      if (text[j] === '.' && isDigit(text[j + 1])) {
        i = j + 1;
        while (isDigit(text[i])) i++;
        const value = Number(text.slice(start, i));
        if (!Number.isFinite(value)) syntax('decimal is too large', start);
        const places = i - j - 1;
        tokens.push({ kind: 'decimal', value: roundDecimal(value), places, offset: start });
        continue;
      }
      const count = readInt();
      if (diceFollows()) {
        if (count > LIMITS.maxDicePerItem) {
          fail('safety-limit-exceeded', 'too many dice', {
            limit: 'maxDicePerItem',
            offset: start,
          });
        }
        tokens.push({ kind: 'dice', count, ...readDiceSuffix(), offset: start });
      } else {
        if (isIdentStart(text[i])) syntax('unexpected character after a number', i);
        tokens.push({ kind: 'int', value: count, offset: start });
      }
      continue;
    }
    if (isIdentStart(c)) {
      while (isIdentChar(text[i])) i++;
      const word = text.slice(start, i);
      if (RESERVED.has(word)) syntax(`"${word}" is a reserved word`, start);
      if (KEYWORDS.has(word)) {
        tokens.push({
          kind: 'keyword',
          value: word as 'true' | 'false' | 'null' | 'in',
          offset: start,
        });
      } else {
        tokens.push({ kind: 'ident', value: word, offset: start });
      }
      continue;
    }
    if (c === '@') {
      i++;
      const at = i;
      while (/[A-Za-z0-9_.:-]/.test(text[i] ?? '')) i++;
      while (i > at && /[.:-]/.test(text[i - 1] as string)) i--;
      const id = text.slice(at, i);
      if (!/^([a-z0-9]+([.-][a-z0-9]+)*:)?[A-Za-z0-9_]+([.-][A-Za-z0-9_]+)*$/.test(id))
        syntax('expected an ID after @', at, 'ID');
      tokens.push({ kind: 'ref', value: id, offset: start });
      continue;
    }
    if (c === "'" || c === '"') {
      i++;
      let value = '';
      for (;;) {
        const ch = text[i];
        if (ch === undefined) syntax('unterminated string', start);
        if (ch === c) {
          i++;
          break;
        }
        if (ch === '\\') {
          const esc = text[i + 1];
          const simple: Record<string, string> = {
            '\\': '\\',
            "'": "'",
            '"': '"',
            n: '\n',
            r: '\r',
            t: '\t',
          };
          if (esc !== undefined && esc in simple) {
            value += simple[esc];
            i += 2;
          } else if (esc === 'u' && /^[0-9A-Fa-f]{4}$/.test(text.slice(i + 2, i + 6))) {
            value += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 6), 16));
            i += 6;
          } else {
            syntax('invalid escape in string', i);
          }
          continue;
        }
        value += ch;
        i++;
      }
      tokens.push({ kind: 'string', value, offset: start });
      continue;
    }
    const op = OPERATORS.find((o) => text.startsWith(o, i));
    if (!op) syntax(`unexpected character "${c}"`, i);
    i += op.length;
    tokens.push({ kind: 'op', value: op, offset: start });
    if (op === ')' && diceFollows()) {
      const at = i;
      tokens.push({ kind: 'diceSuffix', ...readDiceSuffix(), offset: at });
    }
  }
  tokens.push({ kind: 'eof', offset: text.length });
  return tokens;
}

/** Decimal literals with more than six places, which are rounded when parsed. */
export function longDecimals(text: string): string[] {
  let tokens: Token[];
  try {
    tokens = tokenize(text);
  } catch {
    return [];
  }
  return tokens.flatMap((t) =>
    t.kind === 'decimal' && t.places > DECIMAL_PLACES
      ? [text.slice(t.offset, t.offset + text.slice(t.offset).search(/[^0-9.]|$/))]
      : [],
  );
}

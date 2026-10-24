import { formula } from '@opencharacter/engine';
import type { ValueDecl } from './api.ts';

export type Control = 'select' | 'checkbox' | 'formula' | 'text' | 'list';

export function controlFor(decl: ValueDecl): Control {
  switch (decl.type) {
    case 'enum':
      return 'select';
    case 'boolean':
      return 'checkbox';
    case 'integer':
    case 'decimal':
    case 'dice':
      return 'formula';
    case 'set':
    case 'list':
      return 'list';
    default:
      return 'text';
  }
}

/** The value to save for what was typed: numbers stay numbers, empty means "remove". */
export function toValue(decl: ValueDecl, input: string | boolean): unknown {
  if (typeof input === 'boolean') return input;
  const text = input.trim();
  if (text === '') return null;
  if (decl.type === 'set' || decl.type === 'list')
    return text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  if ((decl.type === 'integer' || decl.type === 'decimal') && /^-?\d+(\.\d+)?$/.test(text))
    return Number(text);
  return text;
}

export function toInput(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

export interface FormulaCheck {
  ok: boolean;
  canonical?: string;
  error?: string;
}

/** Parses a formula with the reference parser (syntax only; the validator type-checks on save). */
export function checkFormula(text: string): FormulaCheck {
  if (text.trim() === '' || /^-?\d+(\.\d+)?$/.test(text.trim())) return { ok: true };
  const tree = formula.parse(text);
  if (!tree.ok) {
    const offset = tree.error.data?.offset;
    return {
      ok: false,
      error: `${tree.error.message}${typeof offset === 'number' ? ` (at ${offset})` : ''}`,
    };
  }
  const canonical = formula.print(tree.value);
  return canonical === text.trim() ? { ok: true } : { ok: true, canonical };
}

export function isContentItem(path: string): boolean {
  return /^packs\/[^/]+\/[^/]+\/content\/.+\.yaml$/.test(path);
}

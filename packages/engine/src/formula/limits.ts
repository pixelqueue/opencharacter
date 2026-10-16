import safetyLimits from '@opencharacter/spec/data/safety-limits.json' with { type: 'json' };

const values = new Map(safetyLimits.items.map((item) => [item.id, item.value]));

function limit(id: string): number {
  const value = values.get(id);
  if (value === undefined) throw new Error(`unknown safety limit ${id}`);
  return value;
}

/** Safety limits from the spec (packs are untrusted). */
export const LIMITS = {
  maxFormulaLength: limit('maxFormulaLength'),
  maxFormulaDepth: limit('maxFormulaDepth'),
  maxDicePerItem: limit('maxDicePerItem'),
  maxExplosions: limit('maxExplosions'),
  maxRerolls: limit('maxRerolls'),
  maxHomebrewItems: limit('maxHomebrewItems'),
  maxHomebrewFormulas: limit('maxHomebrewFormulas'),
} as const;

export const MAX_INT = Number.MAX_SAFE_INTEGER;

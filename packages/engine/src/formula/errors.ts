/** Error codes from packages/spec/data/error-codes.json (kind `formula`). */
export type FormulaErrorCode =
  | 'formula-syntax'
  | 'unknown-name'
  | 'unknown-function'
  | 'wrong-arity'
  | 'type-mismatch'
  | 'division-by-zero'
  | 'overflow'
  | 'no-such-key'
  | 'index-out-of-range'
  | 'invalid-face'
  | 'circular-formula'
  | 'safety-limit-exceeded';

export interface FormulaError {
  code: FormulaErrorCode;
  message: string;
  data?: Record<string, unknown>;
}

/** Thrown inside the formula module and caught at its public boundary. */
export class FormulaFailure extends Error {
  constructor(readonly error: FormulaError) {
    super(error.message);
  }
}

export function fail(
  code: FormulaErrorCode,
  message: string,
  data?: Record<string, unknown>,
): never {
  throw new FormulaFailure(data ? { code, message, data } : { code, message });
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: FormulaError };

export function capture<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    if (error instanceof FormulaFailure) return { ok: false, error: error.error };
    throw error;
  }
}

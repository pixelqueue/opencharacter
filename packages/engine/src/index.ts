import { SPEC_VERSION } from '@opencharacter/spec';

export { SPEC_VERSION };

/** Every type generated from the spec's JSON Schemas: `spec.ComputeSheetOutput`, `spec.Change`, … */
export type * as spec from '@opencharacter/spec';

/** The spec versions this engine implements: the spec it ships with, as major.minor. */
export const IMPLEMENTS_SPEC: readonly string[] = [SPEC_VERSION.split('.').slice(0, 2).join('.')];

export * as formula from './formula/index.ts';

export * as check from './check/index.ts';

export * from './core/index.ts';

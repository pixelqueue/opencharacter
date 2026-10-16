export { SPEC_VERSION } from '@opencharacter/spec';

/** Every type generated from the spec's JSON Schemas: `spec.ComputeSheetOutput`, `spec.Change`, … */
export type * as spec from '@opencharacter/spec';

/** The spec versions this engine implements. */
export const IMPLEMENTS_SPEC = ['0.1'] as const;

export * as formula from './formula/index.ts';

export * as check from './check/index.ts';

export * from './core/index.ts';

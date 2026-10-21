import { describe, expect, it } from 'vitest';
import { IMPLEMENTS_SPEC, SPEC_VERSION } from '../src/index.ts';

describe('IMPLEMENTS_SPEC', () => {
  it('names the major.minor of the spec the engine ships with', () => {
    expect(IMPLEMENTS_SPEC).toEqual([SPEC_VERSION.split('.').slice(0, 2).join('.')]);
  });
});

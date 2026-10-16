import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { format, TYPES_FILE } from './write.ts';

describe('generated types', () => {
  it('packages/spec/src/types.ts matches the schemas (run `pnpm types`)', () => {
    expect(readFileSync(TYPES_FILE, 'utf8')).toBe(format());
  });
});

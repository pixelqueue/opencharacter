import { describe, expect, it } from 'vitest';
import { evaluate, parse } from '../src/formula/index.ts';

describe("fieldOf's and fieldId's no-such-key", () => {
  it('gives the key and the family its standard text names', () => {
    for (const fn of ['fieldOf', 'fieldId']) {
      const tree = parse(`${fn}('skills.{skill}', 'x')`);
      if (!tree.ok) throw new Error('parse');
      const result = evaluate(tree.value, {
        field: () => undefined,
        roots: {},
        family: (name) => (name === 'skill' ? ['athletics'] : undefined),
      });
      expect(result.ok ? undefined : result.error).toMatchObject({
        code: 'no-such-key',
        data: { key: 'x', family: 'skill' },
      });
    }
  });
});

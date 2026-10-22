import { describe, expect, it } from 'vitest';
import { loadRuleset } from '../src/index.ts';

function load(entry?: string, use = 'swing') {
  return loadRuleset([
    {
      manifest: {
        id: 'test-pack',
        version: '1.0.0',
        specVersion: '0.1.0',
        license: 'CC0-1.0',
        defaultLanguage: 'en',
      },
      rules: {
        contentTypes: { tool: { carried: true, actions: [{ use: 'swing' }] } },
        actions: [
          { id: 'swing', steps: [{ id: 'result', kind: 'outcome', result: "'done'" }] },
          {
            id: 'go',
            steps: [{ id: 'run', kind: 'action', use, ...(entry ? { entry } : {}) }],
          },
        ],
      },
      content: [],
    } as never,
  ]);
}

describe('an action step entry', () => {
  it('is a string formula', () => {
    expect(load("'tool-1'").ok).toBe(true);
    expect(load('1 + 1').ok).toBe(false);
  });

  it("may name the copy's own action by a local ID no rules action has", () => {
    expect(load("'tool-1'", 'twirl').ok).toBe(true);
    expect(load(undefined, 'twirl').ok).toBe(false);
  });
});

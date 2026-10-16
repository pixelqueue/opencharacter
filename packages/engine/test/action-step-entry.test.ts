import { describe, expect, it } from 'vitest';
import { loadRuleset } from '../src/index.ts';

function load(entry: string) {
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
            steps: [{ id: 'run', kind: 'action', use: 'swing', entry }],
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
});

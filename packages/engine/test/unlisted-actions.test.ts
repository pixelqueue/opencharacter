import { describe, expect, it } from 'vitest';
import { type CharacterDoc, computeSheet, loadRuleset, startAction } from '../src/index.ts';

const loaded = loadRuleset([
  {
    manifest: {
      id: 'test-pack',
      version: '1.0.0',
      specVersion: '0.2.0',
      license: 'CC0-1.0',
      defaultLanguage: 'en',
    },
    rules: {
      contentTypes: {
        tool: {
          carried: true,
          state: { broken: { type: 'boolean', default: false } },
          actions: [
            {
              id: 'mend',
              listed: false,
              available: 'self.broken',
              steps: [{ id: 'done', kind: 'outcome', result: "'mended'" }],
            },
          ],
        },
      },
      actions: [
        { id: 'helper', listed: false, steps: [{ id: 'done', kind: 'outcome', result: "'ok'" }] },
        {
          id: 'repair',
          steps: [
            { id: 'help', kind: 'action', use: 'helper' },
            { id: 'mend', kind: 'action', entry: "'tool-1'", use: 'mend' },
            { id: 'done', kind: 'outcome', data: { mend: 'steps.mend.result' } },
          ],
        },
      ],
    },
    content: [{ id: 'tools.hammer', type: 'tool' }],
  } as never,
]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { ruleset } = loaded;

const character = (broken: boolean): CharacterDoc => ({
  specVersion: '0.2.0',
  id: 'test',
  packs: [{ id: 'test-pack', version: '1.0.0' }],
  inventory: [{ id: 'tool-1', item: 'test-pack:tools.hammer', state: { broken } }],
});

describe('listed: false', () => {
  it('leaves the action out of computeSheet', () => {
    expect(computeSheet(ruleset, character(true)).actions).toEqual([
      { action: 'test-pack:repair' },
    ]);
  });

  it('is still run by an action step while available', () => {
    expect(
      startAction(ruleset, character(true), { action: { id: 'test-pack:repair' } }),
    ).toMatchObject({ status: 'finished', outcome: { data: { mend: 'mended' } } });
    expect(
      startAction(ruleset, character(false), { action: { id: 'test-pack:repair' } }),
    ).toMatchObject({ ok: false, errors: [{ code: 'unknown-action' }] });
  });

  it('is still run by startAction', () => {
    expect(
      startAction(ruleset, character(false), { action: { id: 'test-pack:helper' } }),
    ).toMatchObject({ status: 'finished', outcome: { result: 'ok' } });
  });
});

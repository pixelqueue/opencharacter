import { SPEC_VERSION } from '@opencharacter/spec';
import semver from 'semver';
import { describe, expect, it } from 'vitest';
import { loadRuleset, upgrade } from '../src/index.ts';
import type { CharacterDoc, PackRelease } from '../src/index.ts';
import { applySpecStep, upgradeSpec } from '../src/core/spec-upgrade.ts';

const character = (extra: object = {}): CharacterDoc =>
  ({
    specVersion: '0.1.0',
    id: 'test',
    packs: [{ id: 'test-pack', version: '1.0.0' }],
    features: [
      { id: 'a', item: 'test-pack:a', state: { qty: 2 } },
      { id: 'b', item: 'test-pack:b' },
    ],
    ...extra,
  }) as never;

describe('spec upgrade steps', () => {
  it('moves a value at every member a * matches', () => {
    const doc = character();
    expect(
      applySpecStep(doc, { op: 'move', from: '/features/*/state/qty', to: '/features/*/count' }),
    ).toBe(true);
    expect(doc.features).toEqual([
      { id: 'a', item: 'test-pack:a', state: {}, count: 2 },
      { id: 'b', item: 'test-pack:b' },
    ]);
  });

  it('removes array members and object keys', () => {
    const doc = character({ extensions: { x: 1, y: 2 } });
    expect(applySpecStep(doc, { op: 'remove', path: '/extensions/*' })).toBe(true);
    expect(applySpecStep(doc, { op: 'remove', path: '/features/*' })).toBe(true);
    expect(doc.extensions).toEqual({});
    expect(doc.features).toEqual([]);
    expect(applySpecStep(doc, { op: 'remove', path: '/applied' })).toBe(false);
  });

  it('adds a value only where there is none', () => {
    const doc = character();
    expect(applySpecStep(doc, { op: 'add', path: '/features/*/quantity', value: 1 })).toBe(true);
    expect(doc.features?.map((e) => e.quantity)).toEqual([1, 1]);
    expect(applySpecStep(doc, { op: 'add', path: '/features/*/quantity', value: 5 })).toBe(false);
    expect(applySpecStep(doc, { op: 'add', path: '/missing/key', value: 5 })).toBe(false);
  });

  it('runs the upgrades after the character and not after the engine, in order', () => {
    const later = semver.inc(SPEC_VERSION, 'minor') as string;
    const result = upgradeSpec(character({ specVersion: '0.0.1' }), [
      { id: SPEC_VERSION, steps: [{ op: 'add', path: '/creating', value: false }] },
      { id: '0.0.1', steps: [{ op: 'remove', path: '/features' }] },
      { id: later, steps: [{ op: 'remove', path: '/packs' }] },
      { id: '0.0.2', steps: [{ op: 'move', from: '/creating', to: '/finished' }] },
    ]);
    expect(result.steps.map((s) => [s.version, s.step.op])).toEqual([[SPEC_VERSION, 'add']]);
    expect(result.character).toMatchObject({ specVersion: SPEC_VERSION, creating: false });
    expect(result.character.features).toHaveLength(2);
    expect(result.character.packs).toHaveLength(1);
  });

  it('never changes its input', () => {
    const doc = character();
    upgradeSpec(doc, [{ id: SPEC_VERSION, steps: [{ op: 'remove', path: '/features' }] }]);
    expect(doc.specVersion).toBe('0.1.0');
    expect(doc.features).toHaveLength(2);
  });

  it("leaves a character at the engine's version out of the report", () => {
    const loaded = loadRuleset([
      {
        manifest: {
          id: 'test-pack',
          version: '1.0.0',
          specVersion: '0.1.0',
          license: 'CC0-1.0',
          defaultLanguage: 'en',
        },
        rules: {},
        content: [],
      } as PackRelease,
    ]);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const result = upgrade(
      loaded.ruleset,
      loaded.ruleset,
      character({ specVersion: SPEC_VERSION, features: [] }),
    );
    expect(result.ok && result.report.spec).toBeUndefined();
  });
});

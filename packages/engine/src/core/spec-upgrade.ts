import { SPEC_VERSION, type SpecUpgrade, type SpecUpgradeStep } from '@opencharacter/spec';
import specUpgrades from '@opencharacter/spec/data/spec-upgrades.json' with { type: 'json' };
import semver from 'semver';
import type { CharacterDoc } from './pack-types.ts';

/** The spec's upgrades of the character file (packages/spec/data/spec-upgrades.json). */
export const SPEC_UPGRADES: readonly SpecUpgrade[] = specUpgrades.items as SpecUpgrade[];

type Container = Record<string, unknown> | unknown[];

const isContainer = (v: unknown): v is Container => typeof v === 'object' && v !== null;

const segments = (path: string) =>
  path
    .split('/')
    .slice(1)
    .map((s) => s.replaceAll('~1', '/').replaceAll('~0', '~'));

const has = (node: Container, key: string) =>
  Array.isArray(node) ? /^\d+$/.test(key) && Number(key) < node.length : Object.hasOwn(node, key);

const members = (node: Container) =>
  Array.isArray(node) ? node.map((_, i) => String(i)) : Object.keys(node);

interface Match {
  parent: Container;
  key: string;
  /** The members the path's `*` segments matched, in order. */
  stars: string[];
}

/** Every place a path names: its parent container and key, existing or not. */
function places(root: unknown, path: string): Match[] {
  const segs = segments(path);
  const last = segs.pop() as string;
  let at: { node: unknown; stars: string[] }[] = [{ node: root, stars: [] }];
  for (const seg of segs) {
    at = at.flatMap(({ node, stars }) => {
      if (!isContainer(node)) return [];
      if (seg === '*')
        return members(node).map((k) => ({
          node: (node as Record<string, unknown>)[k],
          stars: [...stars, k],
        }));
      return has(node, seg) ? [{ node: (node as Record<string, unknown>)[seg], stars }] : [];
    });
  }
  return at.flatMap(({ node, stars }) => {
    if (!isContainer(node)) return [];
    if (last === '*')
      return members(node).map((key) => ({ parent: node, key, stars: [...stars, key] }));
    return [{ parent: node, key: last, stars }];
  });
}

function remove(matches: Match[]): void {
  // Array members go last first, so the indexes still hold.
  for (const { parent, key } of matches.toReversed()) {
    if (Array.isArray(parent)) parent.splice(Number(key), 1);
    else delete parent[key];
  }
}

function write(root: Container, segs: string[], value: unknown): void {
  let node: Container = root;
  for (const seg of segs.slice(0, -1)) {
    const next = (node as Record<string, unknown>)[seg];
    if (isContainer(next)) node = next;
    else node = (node as Record<string, unknown>)[seg] = {};
  }
  (node as Record<string, unknown>)[segs.at(-1) as string] = value;
}

/** Runs one spec upgrade step on a character file, in place. Returns whether it changed it. */
export function applySpecStep(doc: CharacterDoc, step: SpecUpgradeStep): boolean {
  const root = doc as unknown as Container;
  if (step.op === 'add') {
    const missing = places(root, step.path as string).filter((m) => !has(m.parent, m.key));
    for (const { parent, key } of missing)
      (parent as Record<string, unknown>)[key] = structuredClone(step.value);
    return missing.length > 0;
  }
  const found = places(root, (step.op === 'move' ? step.from : step.path) as string).filter((m) =>
    has(m.parent, m.key),
  );
  if (step.op === 'move') {
    const values = found.map((m) => (m.parent as Record<string, unknown>)[m.key]);
    remove(found);
    found.forEach((m, i) => {
      let star = 0;
      const to = segments(step.to as string).map((s) => (s === '*' ? (m.stars[star++] ?? s) : s));
      write(root, to, values[i]);
    });
  } else remove(found);
  return found.length > 0;
}

export interface SpecUpgradeResult {
  character: CharacterDoc;
  /** Each step that changed the character, with its upgrade's version. */
  steps: { version: string; step: SpecUpgradeStep }[];
}

/**
 * Moves a character written against an earlier spec to the engine's: runs each spec upgrade
 * after its `specVersion` and not after the engine's, in version order, on a copy, then writes
 * the engine's version.
 */
export function upgradeSpec(
  character: CharacterDoc,
  upgrades: readonly SpecUpgrade[] = SPEC_UPGRADES,
): SpecUpgradeResult {
  const next = structuredClone(character);
  const steps: SpecUpgradeResult['steps'] = [];
  const due = upgrades
    .filter((u) => semver.gt(u.id, character.specVersion) && semver.lte(u.id, SPEC_VERSION))
    .toSorted((a, b) => semver.compare(a.id, b.id));
  for (const upgrade of due)
    for (const step of upgrade.steps)
      if (applySpecStep(next, step)) steps.push({ version: upgrade.id, step });
  next.specVersion = SPEC_VERSION;
  return { character: next, steps };
}

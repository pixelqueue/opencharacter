import type { CharacterDoc, ChoiceTree, Pick } from './pack-types.ts';
import type { ChoicePath } from './sheet.ts';

/**
 * The choice tree holding the picks of the choice at `path` (the path minus its last segment,
 * walked through picked options). Returns undefined when an option on the way is not picked.
 */
export function treeFor(
  character: CharacterDoc,
  path: ChoicePath,
  create: boolean,
): ChoiceTree | undefined {
  let tree: ChoiceTree | undefined;
  if (path.entry !== undefined) {
    const entry = [...(character.features ?? []), ...(character.inventory ?? [])].find(
      (e) => e.id === path.entry,
    );
    if (!entry) return undefined;
    if (!entry.choices && create) entry.choices = {};
    tree = entry.choices ?? (create ? {} : undefined);
  } else {
    if (!character.choices && create) character.choices = {};
    tree = character.choices ?? (create ? {} : undefined);
  }
  const segments = path.choice;
  for (let i = 0; i + 1 < segments.length; i += 2) {
    if (!tree) return undefined;
    const picks: Pick[] = tree[String(segments[i])] ?? [];
    const pick = picks.find((p) => p.option === segments[i + 1]);
    if (!pick) return undefined;
    if (!pick.choices && create) pick.choices = {};
    tree = pick.choices ?? (create ? {} : undefined);
  }
  return tree;
}

export function samePath(a: ChoicePath, b: ChoicePath): boolean {
  return (
    a.entry === b.entry &&
    a.choice.length === b.choice.length &&
    a.choice.every((s, i) => s === b.choice[i])
  );
}

/** The instance IDs saved picks name as their copies (`entry`), at any depth, as written. */
export function pickLinks(character: CharacterDoc): Set<string> {
  const out = new Set<string>();
  const walk = (tree: ChoiceTree | undefined): void => {
    for (const picks of Object.values(tree ?? {}))
      for (const pick of picks ?? []) {
        if (pick.entry !== undefined) out.add(pick.entry);
        walk(pick.choices);
      }
  };
  walk(character.choices);
  for (const entry of [...(character.features ?? []), ...(character.inventory ?? [])])
    walk(entry.choices);
  return out;
}

/**
 * Removes the copies in `held` (picks' copies before a change) whose links the change removed,
 * then those whose links went with them (picks of a removed copy), until none is left.
 */
export function dropUnpicked(character: CharacterDoc, held: Iterable<string>): void {
  const ids = new Set(held);
  for (;;) {
    const linked = pickLinks(character);
    const has = (id: string) => ids.has(id) && !linked.has(id);
    const entries = [...(character.features ?? []), ...(character.inventory ?? [])];
    if (!entries.some((e) => has(e.id))) return;
    if (character.features) character.features = character.features.filter((e) => !has(e.id));
    if (character.inventory) character.inventory = character.inventory.filter((e) => !has(e.id));
  }
}

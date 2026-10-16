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

import type { ActionNeed, CharacterFile, Ruleset } from '@opencharacter/spec';
import type { CopyRef, RollTarget, Text } from './text.ts';

export interface NeedText {
  /** The choice's or step's prompt, the roll's or handed-off action's name; else the action's. */
  title: string;
  options: { id: string; label: string }[];
  fields: { id: string; label: string }[];
  /** "2d100, keep lowest": the dice to throw. */
  dice?: string;
  /** "2d10 + 25": the whole roll, flat items included. */
  roll?: string;
  /** A random draw: `options` or `fields` are what the die picks among, face 1 first. */
  draw?: true;
  targets?: RollTarget[];
}

/**
 * Copies by instance ID, named by state (`nameFrom`) when saved. Every item also gets its derived
 * standard-copy ID (the qualified ID with `:` and `.` as `-`), which the file's own entries override.
 */
function copies(ruleset: Ruleset, character: CharacterFile | undefined): Record<string, CopyRef> {
  const out: Record<string, CopyRef> = {};
  for (const item of Object.keys(ruleset.content)) out[item.replaceAll(/[:.]/g, '-')] = { item };
  for (const entry of [...(character?.inventory ?? []), ...(character?.features ?? [])]) {
    const item = ruleset.content[entry.item] as { type?: string; nameFrom?: string } | undefined;
    const types = ruleset.contentTypes as Record<string, { nameFrom?: string }> | undefined;
    const key = item?.nameFrom ?? (item?.type ? types?.[item.type]?.nameFrom : undefined);
    const name = key === undefined ? undefined : entry.state?.[key];
    out[entry.id] = typeof name === 'string' && name.trim() ? { ...entry, name } : entry;
  }
  return out;
}

/** Pass the paused result's character for a choice step over copies (its options are instance IDs). */
export function describeNeed(
  ruleset: Ruleset,
  text: Text,
  needs: ActionNeed,
  options: { character?: CharacterFile } = {},
): NeedText {
  const out: NeedText = { title: text.action(needs.action), options: [], fields: [] };
  switch (needs.kind) {
    case 'choice': {
      out.title = needs.choice ? text.choicePrompt(needs.choice) : text.stepPrompt(needs);
      const context = {
        action: needs.action,
        ...(needs.choice ? { choice: needs.choice } : {}),
        copies: copies(ruleset, options.character),
        isContent: (id: string) => id in ruleset.content || id.includes(':'),
      };
      out.options = (needs.options ?? []).map((id) => ({ id, label: text.option(id, context) }));
      break;
    }
    case 'allocate':
      out.title = text.stepPrompt(needs);
      out.fields = (needs.allocate?.fields ?? []).map((f) => ({
        id: f.id,
        label: text.field(f.id),
      }));
      break;
    case 'dice':
      if (needs.draw) {
        const among = needs.draw.among;
        const context = {
          action: needs.action,
          ...(needs.choice ? { choice: needs.choice } : {}),
          copies: copies(ruleset, options.character),
          isContent: (id: string) => id in ruleset.content || id.includes(':'),
        };
        out.title = needs.choice ? text.choicePrompt(needs.choice) : text.stepPrompt(needs);
        out.draw = true;
        if (among.every((id) => id in ruleset.fields))
          out.fields = among.map((id) => ({ id, label: text.field(id) }));
        else out.options = among.map((id) => ({ id, label: text.option(id, context) }));
        out.dice = text.dice(needs.dice ?? []);
        break;
      }
      out.title = text.stepName(needs);
      {
        const items = needs.items?.some((i) => i.kind === 'dice')
          ? needs.items
          : (needs.dice ?? []);
        out.dice = text.dice(items, needs.repeat);
        out.roll = text.roll(items, needs.repeat);
      }
      if (needs.summary?.bandSet) out.targets = text.rollTargets(needs.summary);
      break;
    case 'handoff':
      if (needs.run) out.title = text.action(needs.run.action);
      break;
  }
  return out;
}

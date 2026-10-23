import type { FieldDef, Formula } from './pack-types.ts';
import { isContentOnly } from './load.ts';
import { resolveId, type Ruleset } from './ruleset.ts';
import { Failure, type Sheet } from './sheet.ts';
import { fieldSetMatches, fieldViews, hasComputedTags } from './views.ts';

export interface ShownGroup {
  id: string;
  shown: boolean;
  /** A fields group's members, in ruleset order. */
  fields?: string[];
}

export interface Display {
  /** Whether each field is shown, by qualified field ID. */
  fields: Record<string, boolean>;
  groups: ShownGroup[];
}

/** Members a query reading only `item` gives the fields with written tags only, per ruleset. */
const staticMembers = new WeakMap<Ruleset, Map<string, ReadonlySet<string>>>();

function holds(sheet: Sheet, formula: Formula | undefined, pack: string): boolean {
  if (formula === undefined) return true;
  try {
    const value = sheet.evaluateHint(formula, pack, {});
    return value.kind !== 'bool' || value.value;
  } catch (error) {
    if (!(error instanceof Failure)) throw error;
    return true;
  }
}

function matches(sheet: Sheet, where: Formula, pack: string, qid: string): boolean {
  const def = sheet.ruleset.fields[qid] as FieldDef;
  try {
    const value = sheet.evaluateHint(where, pack, {
      item: { id: qid, type: def.type, tags: sheet.sheetTags(qid) },
    });
    return value.kind === 'bool' && value.value;
  } catch (error) {
    if (!(error instanceof Failure)) throw error;
    return false;
  }
}

function members(sheet: Sheet, where: Formula | undefined, pack: string): string[] {
  const { ruleset } = sheet;
  const ids = Object.keys(ruleset.fields);
  if (where === undefined) return ids;
  if (!isContentOnly(where)) return ids.filter((qid) => matches(sheet, where, pack, qid));
  let cache = staticMembers.get(ruleset);
  if (!cache) staticMembers.set(ruleset, (cache = new Map()));
  const key = JSON.stringify([pack, where]);
  let found = cache.get(key);
  if (!found) {
    const id = (text: string) => resolveId(ruleset, text, pack);
    found = new Set(
      fieldViews(ruleset)
        .filter((view) => !hasComputedTags(ruleset.fields[view.id] as FieldDef))
        .filter((view) => fieldSetMatches(where, view, {}, id))
        .map((view) => view.id),
    );
    cache.set(key, found);
  }
  const known = found;
  return ids.filter((qid) =>
    hasComputedTags(ruleset.fields[qid] as FieldDef)
      ? matches(sheet, where, pack, qid)
      : known.has(qid),
  );
}

/**
 * Display visibility (packages/spec/docs/display-hints.md, "Shown"): each group's `showWhen`,
 * a fields group's members, and whether each field is shown. A condition that fails counts as
 * true; a `where` that fails matches nothing.
 */
export function display(sheet: Sheet): Display {
  const { groups: defs, fields: hints } = sheet.ruleset.rules.display;
  const groupOf = new Map<string, ShownGroup>();
  const memberOf = new Map<string, Set<string>>();
  const join = (qid: string, group: string) => {
    const set = memberOf.get(qid);
    if (set) set.add(group);
    else memberOf.set(qid, new Set([group]));
  };
  const groups = defs.map((def) => {
    const group: ShownGroup = { id: def.id, shown: holds(sheet, def.showWhen, def.pack) };
    if ((def.kind ?? 'fields') === 'fields') {
      group.fields = [];
      groupOf.set(def.id, group);
      if (def.members?.type === 'field')
        for (const qid of members(sheet, def.members.where, def.pack)) join(qid, def.id);
    }
    return group;
  });
  for (const [qid, hint] of Object.entries(hints))
    for (const id of hint.groups ?? []) if (groupOf.has(id)) join(qid, id);
  const fields: Record<string, boolean> = {};
  for (const qid of Object.keys(sheet.ruleset.fields)) {
    const own = memberOf.get(qid);
    for (const id of own ?? []) groupOf.get(id)?.fields?.push(qid);
    const hint = hints[qid];
    fields[qid] =
      hint?.hidden !== true &&
      holds(sheet, hint?.showWhen, hint?.pack ?? '') &&
      (own === undefined || [...own].some((id) => groupOf.get(id)?.shown));
  }
  return { fields, groups };
}

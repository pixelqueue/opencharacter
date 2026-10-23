import type { Entry, FieldDef, Formula, TypeHints } from './pack-types.ts';
import { isContentOnly } from './load.ts';
import { resolveId, resolveType, type FromPack, type Ruleset } from './ruleset.ts';
import { type Activation, Failure, type ListedAction, ownsEntry, type Sheet } from './sheet.ts';
import {
  appliedView,
  fieldSetMatches,
  fieldViews,
  hasComputedTags,
  itemView,
  stateDecls,
} from './views.ts';

export interface ContentMember {
  /** Its index in `activations`; for an applied entry, absent when it isn't listed there. */
  activation?: number;
  /** A `from: applied` member's entry. */
  entry?: string;
  section?: number | string;
  /** An applied entry with no activation: its state keys not shown, as on an activation. */
  hiddenState?: string[];
}

export interface ShownGroup {
  id: string;
  shown: boolean;
  /** A fields group's members, in ruleset order. */
  fields?: string[];
  /** An actions group's members: indices in `actions`, in its order. */
  actions?: number[];
  /** A content group's members, in section and sort order. */
  items?: ContentMember[];
}

export interface Display {
  /** Whether each field is shown, by qualified field ID. */
  fields: Record<string, boolean>;
  groups: ShownGroup[];
  /** Per entry of `activations`, its state keys not shown (undefined when none). */
  hiddenState: (string[] | undefined)[];
}

/** Members a query reading only `item` gives the fields with written tags only, per ruleset. */
const staticMembers = new WeakMap<Ruleset, Map<string, ReadonlySet<string>>>();

function holds(
  sheet: Sheet,
  formula: Formula | undefined,
  pack: string,
  roots: Record<string, unknown> = {},
): boolean {
  if (formula === undefined) return true;
  try {
    const value = sheet.evaluateHint(formula, pack, roots);
    return value.kind !== 'bool' || value.value;
  } catch (error) {
    if (!(error instanceof Failure)) throw error;
    return true;
  }
}

/** A failure gives undefined. */
function hintValue(
  sheet: Sheet,
  formula: Formula,
  pack: string,
  roots: Record<string, unknown>,
): number | string | boolean | undefined {
  try {
    const v = sheet.evaluateHint(formula, pack, roots);
    return v.kind === 'int' || v.kind === 'decimal' || v.kind === 'string' || v.kind === 'bool'
      ? v.value
      : undefined;
  } catch (error) {
    if (!(error instanceof Failure)) throw error;
    return undefined;
  }
}

function test(sheet: Sheet, where: Formula, pack: string, roots: Record<string, unknown>) {
  return hintValue(sheet, where, pack, roots) === true;
}

function matches(sheet: Sheet, where: Formula, pack: string, qid: string): boolean {
  const def = sheet.ruleset.fields[qid] as FieldDef;
  return test(sheet, where, pack, {
    item: { id: qid, type: def.type, tags: sheet.sheetTags(qid) },
  });
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

const typeHints = new WeakMap<Ruleset, Map<string, TypeHints & FromPack>>();

/** The hints of a content type, by its qualified ID. */
function hintsOf(ruleset: Ruleset, type: string): (TypeHints & FromPack) | undefined {
  let byType = typeHints.get(ruleset);
  if (!byType) {
    byType = new Map();
    for (const [name, hints] of Object.entries(ruleset.rules.display.types))
      byType.set(resolveType(ruleset, name, hints.pack) ?? name, hints);
    typeHints.set(ruleset, byType);
  }
  return byType.get(type);
}

/** The declared state keys not shown: a `hidden` hint, or a `showWhen` that doesn't hold. */
function hiddenState(
  sheet: Sheet,
  type: string,
  decls: Record<string, unknown>,
  roots: Record<string, unknown>,
): string[] | undefined {
  const hints = hintsOf(sheet.ruleset, type);
  if (!hints?.state) return undefined;
  const hidden = Object.keys(decls).filter((key) => {
    const hint = hints.state?.[key];
    return hint?.hidden === true || !holds(sheet, hint?.showWhen, hints.pack, roots);
  });
  return hidden.length > 0 ? hidden : undefined;
}

interface Candidate {
  member: ContentMember;
  roots: Record<string, unknown>;
  order: number;
  sort?: number | string;
}

const rank = (k: number | string | undefined) =>
  typeof k === 'number' ? 0 : typeof k === 'string' ? 1 : 2;

/** Numbers ascending, then strings in code-point order, then none. */
function compareKeys(a: number | string | undefined, b: number | string | undefined): number {
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return 0;
}

function contentMembers(
  sheet: Sheet,
  def: Ruleset['rules']['display']['groups'][number],
  listed: readonly Activation[],
): ContentMember[] {
  const query = def.members;
  if (!query) return [];
  const { ruleset } = sheet;
  const candidates: Candidate[] = [];
  if (query.from === 'applied') {
    const active = new Map<string, number>();
    listed.forEach((a, i) => {
      if (a.kind === 'applied' && a.applied !== undefined) active.set(a.applied, i);
    });
    for (const entry of sheet.character.applied ?? []) {
      const item = ruleset.content[entry.source];
      if (item?.type !== query.type) continue;
      const at = active.get(entry.id);
      const a = at === undefined ? undefined : listed[at];
      const roots = a
        ? { item: a.roots.item, self: a.roots.self }
        : {
            item: itemView(ruleset, item, [], (n, p) => sheet.inputValue(`${p}:${n}`)),
            self: appliedView(ruleset, entry),
          };
      const member: ContentMember = { entry: entry.id };
      if (at !== undefined) member.activation = at;
      else {
        const hidden = hiddenState(sheet, item.type, stateDecls(ruleset, item, []), roots);
        if (hidden) member.hiddenState = hidden;
      }
      candidates.push({ member, roots, order: candidates.length });
    }
  } else
    listed.forEach((a, i) => {
      if (a.scope !== 'holder' || a.kind === 'template' || a.item?.type !== query.type) return;
      const roots = { item: a.roots.item, self: a.roots.self };
      candidates.push({ member: { activation: i }, roots, order: i });
    });
  const kept = candidates.filter(
    (c) => query.where === undefined || test(sheet, query.where, def.pack, c.roots),
  );
  for (const c of kept) {
    if (def.sectionBy !== undefined) {
      const key = hintValue(sheet, def.sectionBy, def.pack, c.roots);
      if (typeof key === 'string' || Number.isInteger(key))
        c.member.section = key as number | string;
    }
    if (def.sortBy !== undefined) {
      const key = hintValue(sheet, def.sortBy, def.pack, c.roots);
      if (typeof key === 'string' || typeof key === 'number') c.sort = key;
    }
  }
  return kept
    .toSorted(
      (a, b) =>
        compareKeys(a.member.section, b.member.section) ||
        compareKeys(a.sort, b.sort) ||
        a.order - b.order,
    )
    .map((c) => c.member);
}

function actionMembers(
  sheet: Sheet,
  where: Formula | undefined,
  pack: string,
  actions: readonly { listed: ListedAction; tags: readonly string[] }[],
): number[] {
  const out: number[] = [];
  actions.forEach(({ listed, tags }, i) => {
    const item = {
      id: listed.action,
      tags: [...tags],
      ...(listed.entry === undefined ? {} : { entry: listed.entry }),
      ...(listed.source === undefined ? {} : { source: listed.source }),
    };
    if (where === undefined || test(sheet, where, pack, { item })) out.push(i);
  });
  return out;
}

/**
 * Display visibility (packages/spec/docs/display-hints.md, "Shown"): each group's `showWhen`,
 * its members (fields, actions or content, sorted), whether each field is shown, and the state
 * keys of the listed activations not shown. A condition that fails counts as true; a `where`
 * that fails matches nothing. Without `actions`, only fields groups' members and the fields.
 */
export function display(
  sheet: Sheet,
  actions?: readonly { listed: ListedAction; tags: readonly string[] }[],
): Display {
  const { groups: defs, fields: hints } = sheet.ruleset.rules.display;
  const listed = sheet.listedActivations();
  const groupOf = new Map<string, ShownGroup>();
  const memberOf = new Map<string, Set<string>>();
  const join = (qid: string, group: string) => {
    const set = memberOf.get(qid);
    if (set) set.add(group);
    else memberOf.set(qid, new Set([group]));
  };
  const groups = defs.map((def) => {
    const group: ShownGroup = { id: def.id, shown: holds(sheet, def.showWhen, def.pack) };
    const kind = def.kind ?? 'fields';
    if (kind === 'fields') {
      group.fields = [];
      groupOf.set(def.id, group);
      if (def.members?.type === 'field')
        for (const qid of members(sheet, def.members.where, def.pack)) join(qid, def.id);
    } else if (actions) {
      if (kind === 'actions')
        group.actions = actionMembers(sheet, def.members?.where, def.pack, actions);
      else group.items = contentMembers(sheet, def, listed);
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
  const hidden = listed.map((a) => {
    if (!actions || !a.item || a.kind === 'template') return undefined;
    const templates = ownsEntry(a) && a.entry ? sheet.templateItems(a.entry as Entry, a.item) : [];
    return hiddenState(sheet, a.item.type, stateDecls(sheet.ruleset, a.item, templates), {
      item: a.roots.item,
      self: a.roots.self,
    });
  });
  return { fields, groups, hiddenState: hidden };
}

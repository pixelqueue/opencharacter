import * as f from '../formula/index.ts';
import type {
  CharacterDoc,
  ComputedDecl,
  Entry,
  FieldDef,
  Literal,
  TagOrFormula,
  ValueDecl,
} from './pack-types.ts';
import { appliesQueries } from './pack-types.ts';
import { type LoadedItem, localPart, queryKey, resolveId, type Ruleset } from './ruleset.ts';

/** undefined when the name isn't visible from the pack. */
export type FieldLookup = (name: string, pack: string) => f.Value | undefined;

/** A value of a declared type, or a reason it doesn't fit. */
export function typedValue(
  decl: { type: string; values?: string[] },
  raw: unknown,
): f.Value | string {
  switch (decl.type) {
    case 'integer':
      return Number.isInteger(raw) ? { kind: 'int', value: raw as number } : 'a whole number';
    case 'decimal':
      return typeof raw === 'number' ? { kind: 'decimal', value: f.roundDecimal(raw) } : 'a number';
    case 'boolean':
      return typeof raw === 'boolean' ? { kind: 'bool', value: raw } : 'true or false';
    case 'string':
    case 'id':
      return typeof raw === 'string' ? { kind: 'string', value: raw } : 'a string';
    case 'enum':
      return typeof raw === 'string' && decl.values?.includes(raw)
        ? { kind: 'string', value: raw }
        : `one of ${decl.values?.join(', ')}`;
    case 'set':
      return Array.isArray(raw)
        ? {
            kind: 'list',
            value: [...new Set(raw.map(String))]
              .toSorted()
              .map((v) => ({ kind: 'string', value: v }) as f.Value),
          }
        : 'a list';
    case 'dice': {
      if (typeof raw !== 'string' && typeof raw !== 'number') return 'dice';
      const tree =
        typeof raw === 'number'
          ? { ok: true as const, value: { type: 'int', value: raw } as f.Node }
          : f.parseCached(raw);
      if (!tree.ok) return 'dice';
      const value = f.evaluate(tree.value, { field: () => undefined, roots: {} });
      if (!value.ok) return 'dice';
      return value.value.kind === 'int'
        ? { kind: 'dice', value: { terms: [], flat: value.value.value } }
        : value.value;
    }
    default:
      return 'a known type';
  }
}

export function emptyValue(def: FieldDef): f.Value {
  if (def.default !== undefined) {
    const value = typedValue(def, def.default);
    if (typeof value !== 'string') return value;
  }
  switch (def.type) {
    case 'set':
      return { kind: 'list', value: [] };
    case 'integer':
      return { kind: 'int', value: 0 };
    case 'decimal':
      return { kind: 'decimal', value: 0 };
    case 'boolean':
      return { kind: 'bool', value: false };
    case 'string':
    case 'enum':
    case 'id':
      return { kind: 'string', value: '' };
    case 'dice':
      return { kind: 'dice', value: { terms: [], flat: 0 } };
    default:
      return { kind: 'null' };
  }
}

/** Canonical text of a dice value (`1d8 + 3`). */
export function diceText(dice: f.DiceValue): string {
  let tree: f.Node | undefined;
  const join = (op: '+' | '-', right: f.Node) => {
    tree =
      tree === undefined
        ? op === '-'
          ? { type: 'unary', op: '-', operand: right }
          : right
        : { type: 'binary', op, left: tree, right };
  };
  for (const term of dice.terms) {
    join(term.sign === 1 ? '+' : '-', {
      type: 'dice',
      count: term.count,
      sides: term.sides,
      ...(term.zero ? { zero: true as const } : {}),
      modifiers: term.modifiers,
    });
  }
  if (dice.flat !== 0 || tree === undefined)
    join(dice.flat < 0 ? '-' : '+', { type: 'int', value: Math.abs(dice.flat) });
  return f.print(tree as f.Node);
}

/** Dice values become canonical text. */
export function outputData(value: f.Value): unknown {
  if (value.kind === 'dice') return diceText(value.value);
  if (value.kind === 'list') return value.value.map(outputData);
  return f.toData(value);
}

function rootValue(value: f.Value): unknown {
  return value.kind === 'decimal' || value.kind === 'dice' ? f.wrapValue(value) : f.toData(value);
}

/** For a template: the template fields and its `appliesTo` types' fields, first type first. */
export function itemFieldDeclsOf(ruleset: Ruleset, item: LoadedItem): Record<string, ValueDecl> {
  if (item.type !== 'template') return ruleset.contentTypes[item.type]?.fields ?? {};
  const decls: Record<string, ValueDecl> = {};
  for (const [name, { pack: _p, ...decl }] of Object.entries(ruleset.rules.templateFields ?? {}))
    decls[name] = decl;
  const bases = appliesQueries(item).map((q) => ruleset.contentTypes[q.type]?.fields ?? {});
  return Object.assign(decls, ...bases.toReversed());
}

/**
 * The `item` view (packages/spec/docs/engine-core.md, "Items and item"). Formula item fields
 * read input fields only; a template's also read `base`.
 */
export function itemView(
  ruleset: Ruleset,
  item: LoadedItem,
  templates: LoadedItem[],
  inputField: FieldLookup,
): Record<string, unknown> {
  if (templates.length > 0) return mergedView(ruleset, item, templates, inputField);
  // A plain view that read no input field is the same on every sheet: kept per ruleset, each
  // caller given its own copy.
  let byItem = plainViews.get(ruleset);
  if (!byItem) plainViews.set(ruleset, (byItem = new WeakMap()));
  const kept = byItem.get(item);
  if (kept) return { ...kept };
  let read = false;
  const view = mergedView(ruleset, item, templates, (name, pack) => {
    read = true;
    return inputField(name, pack);
  });
  if (!read) byItem.set(item, { ...view });
  return view;
}

const plainViews = new WeakMap<Ruleset, WeakMap<LoadedItem, Record<string, unknown>>>();

function mergedView(
  ruleset: Ruleset,
  item: LoadedItem,
  templates: LoadedItem[],
  inputField: FieldLookup,
): Record<string, unknown> {
  const type = ruleset.contentTypes[item.type];
  const view: Record<string, unknown> = {
    id: item.qid,
    type: type ? type.name : localPart(item.type),
    tags: mergedTags(item, templates),
  };
  for (const [name, raw] of Object.entries(item.fields ?? {})) {
    const decl = type?.fields?.[name];
    if (!decl) continue;
    const scope = item.scopes?.fields ?? item.pack;
    const value = fieldValue(ruleset, decl, raw, scope, inputField);
    if (value !== undefined) view[name] = rootValue(value);
  }
  // A default is read in the type's pack.
  for (const [name, decl] of Object.entries(type?.fields ?? {})) {
    if (item.fields?.[name] !== undefined || decl.default === undefined || !type) continue;
    const value = fieldValue(ruleset, decl, decl.default, type.pack, inputField);
    if (value !== undefined) view[name] = rootValue(value);
  }
  const templateFields = ruleset.rules.templateFields ?? {};
  for (const [name, decl] of Object.entries(templateFields)) {
    if (type?.fields?.[name] !== undefined || decl.default === undefined) continue;
    const value = fieldValue(ruleset, decl, decl.default, decl.pack, inputField);
    if (value !== undefined) view[name] = rootValue(value);
  }
  if (templates.length > 0) {
    const base = { ...view, tags: mergedTags(item, []) };
    templates.forEach((template, i) => {
      const scope = template.scopes?.fields ?? template.pack;
      const prior = { ...view, tags: mergedTags(item, templates.slice(0, i)) };
      for (const [name, raw] of Object.entries(template.fields ?? {})) {
        const decl = type?.fields?.[name] ?? templateFields[name];
        if (!decl) continue;
        // `null` makes the field absent, unless a later template sets it.
        if (raw === null) {
          delete view[name];
          continue;
        }
        const value = fieldValue(ruleset, decl, raw, scope, inputField, { base, prior });
        if (value !== undefined) view[name] = rootValue(value);
      }
    });
  }
  return view;
}

/** Each template in order takes away its `removeTags`, then adds its `tags`. */
export function mergedTags(item: LoadedItem, templates: readonly LoadedItem[]): string[] {
  const tags = new Set(item.tags ?? []);
  for (const template of templates) {
    for (const tag of template.removeTags ?? []) tags.delete(tag);
    for (const tag of template.tags ?? []) tags.add(tag);
  }
  return [...tags];
}

function fieldValue(
  ruleset: Ruleset,
  decl: ValueDecl,
  raw: Literal,
  pack: string,
  inputField: FieldLookup,
  roots: Record<string, unknown> = {},
): f.Value | undefined {
  if (['string', 'enum', 'id', 'set'].includes(decl.type)) {
    const value = typedValue(decl, raw);
    return typeof value === 'string' ? undefined : value;
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    const value = typedValue(decl, raw);
    return typeof value === 'string' ? undefined : value;
  }
  if (typeof raw !== 'string') return undefined;
  const tree = f.parseCached(raw);
  if (!tree.ok) return undefined;
  const result = f.evaluate(tree.value, {
    field: (name) => inputField(name, pack),
    roots,
    id: (text) => resolveId(ruleset, text, pack),
  });
  if (!result.ok) return undefined;
  if (decl.type === 'decimal' && result.value.kind === 'int')
    return { kind: 'decimal', value: result.value.value };
  return result.value;
}

export function stateDecls(
  ruleset: Ruleset,
  item: LoadedItem,
  templates: LoadedItem[],
): Record<string, ValueDecl> {
  return {
    ...ruleset.contentTypes[item.type]?.state,
    ...item.state,
    ...Object.assign({}, ...templates.map((t) => t.state ?? {})),
  };
}

export interface ComputedSource {
  name: string;
  decl: ComputedDecl;
  pack: string;
}

export function computedDecls(
  ruleset: Ruleset,
  item: LoadedItem,
  templates: LoadedItem[],
): ComputedSource[] {
  const out = new Map<string, ComputedSource>();
  const add = (decls: Record<string, ComputedDecl> | undefined, pack: string) => {
    for (const [name, decl] of Object.entries(decls ?? {})) out.set(name, { name, decl, pack });
  };
  const type = ruleset.contentTypes[item.type];
  if (type) add(type.computed, type.pack);
  for (const owner of [item, ...templates])
    add(owner.computed, owner.scopes?.computed ?? owner.pack);
  return [...out.values()];
}

export function computedRoot(value: f.Value): unknown {
  return rootValue(value);
}

/** The `self` view (packages/spec/docs/engine-core.md, "Copies and self"). */
export function selfView(
  entry: Entry,
  decls: Record<string, ValueDecl>,
  templates: readonly string[] = entry.templates ?? [],
): Record<string, unknown> {
  const view: Record<string, unknown> = {
    id: entry.id,
    equipped: entry.equipped ?? false,
    quantity: entry.quantity ?? 1,
    templates: [...templates],
  };
  for (const [key, decl] of Object.entries(decls)) {
    const raw = entry.state?.[key] ?? decl.default;
    if (raw === undefined) continue;
    const value = typedValue(decl, raw);
    if (typeof value !== 'string') view[key] = rootValue(value);
  }
  return view;
}

/** Each declared key: the pick's saved value or the declared default. */
export function pickState(
  ruleset: Ruleset,
  item: LoadedItem,
  state: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, decl] of Object.entries(stateDecls(ruleset, item, []))) {
    const raw = state?.[key] ?? decl.default;
    if (raw === undefined) continue;
    const value = typedValue(decl, raw);
    if (typeof value !== 'string') out[key] = rootValue(value);
  }
  return out;
}

type AppliedEntry = NonNullable<CharacterDoc['applied']>[number];

/** A declared value of the wrong type is absent; undeclared keys stay raw. */
export function appliedState(ruleset: Ruleset, entry: AppliedEntry): Record<string, unknown> {
  const state: Record<string, unknown> = { ...entry.state };
  const item = ruleset.content[entry.source];
  if (!item) return state;
  for (const [key, decl] of Object.entries(stateDecls(ruleset, item, []))) {
    delete state[key];
    const raw = entry.state?.[key] ?? decl.default;
    if (raw === undefined) continue;
    const value = typedValue(decl, raw);
    if (typeof value !== 'string') state[key] = rootValue(value);
  }
  return state;
}

/** `self` on an applied entry's activation and `entry` in an immunity's query. */
export function appliedView(ruleset: Ruleset, entry: AppliedEntry): Record<string, unknown> {
  return { ...appliedState(ruleset, entry), id: entry.id };
}

/** `character.applied`, raw: blocking by immunities isn't reflected. */
export function appliedList(ruleset: Ruleset, character: CharacterDoc): Record<string, unknown>[] {
  return (character.applied ?? []).map((entry) => ({
    id: entry.id,
    source: entry.source,
    active: entry.active !== false,
    state: appliedState(ruleset, entry),
  }));
}

export interface CopyView {
  id: string;
  item: string;
  type: string;
  equipped: boolean;
  quantity: number;
  state: Record<string, unknown>;
}

const keptFieldsCache = new WeakMap<Ruleset, Map<string, Set<string>>>();

/** The `keepsFields` of every item that keeps the template on copies of `item`. */
export function keptFields(ruleset: Ruleset, template: string, item: string): ReadonlySet<string> {
  let cache = keptFieldsCache.get(ruleset);
  if (!cache) keptFieldsCache.set(ruleset, (cache = new Map()));
  const key = `${template}\0${item}`;
  let out = cache.get(key);
  if (out) return out;
  out = new Set();
  for (const keeper of Object.values(ruleset.content)) {
    if (!keeper.keepsFields?.length) continue;
    const pack = keeper.scopes?.keepsTemplates ?? keeper.pack;
    for (const kept of keeper.keepsTemplates ?? []) {
      if (kept.template !== template) continue;
      const matches = ruleset.queries[queryKey(pack, kept.copies.type, kept.copies.where)];
      if (matches && !matches.includes(item)) continue;
      for (const field of keeper.keepsFields) out.add(field);
    }
  }
  cache.set(key, out);
  return out;
}

export function keptTemplate(ruleset: Ruleset, template: LoadedItem, item: string): LoadedItem {
  const skip = keptFields(ruleset, template.qid, item);
  if (skip.size === 0 || !template.fields) return template;
  return {
    ...template,
    fields: Object.fromEntries(Object.entries(template.fields).filter(([k]) => !skip.has(k))),
  };
}

export type TemplatesOf = (entry: Entry) => readonly string[];

const savedTemplates: TemplatesOf = (entry) => entry.templates ?? [];

export function copies(
  ruleset: Ruleset,
  character: CharacterDoc,
  templatesOf: TemplatesOf = savedTemplates,
): { features: CopyView[]; inventory: CopyView[] } {
  const view = (entry: Entry): CopyView | undefined => {
    const item = ruleset.content[entry.item];
    if (!item) return undefined;
    const templates = templatesOf(entry)
      .map((t) => ruleset.content[t])
      .filter((t): t is LoadedItem => t !== undefined);
    const self = selfView(entry, stateDecls(ruleset, item, templates));
    const state: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(self))
      if (!['id', 'equipped', 'quantity', 'templates'].includes(k)) state[k] = v;
    return {
      id: entry.id,
      item: entry.item,
      type: ruleset.contentTypes[item.type]?.name ?? localPart(item.type),
      equipped: entry.equipped ?? false,
      quantity: entry.quantity ?? 1,
      state,
    };
  };
  const list = (entries: Entry[] | undefined) =>
    (entries ?? []).map(view).filter((c): c is CopyView => c !== undefined);
  return { features: list(character.features), inventory: list(character.inventory) };
}

/** Inventory first, then features; copies whose item isn't in the ruleset are skipped. */
export function copyRoots(
  ruleset: Ruleset,
  character: CharacterDoc,
  inputField: FieldLookup,
  templatesOf: TemplatesOf = savedTemplates,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const entry of [...(character.inventory ?? []), ...(character.features ?? [])]) {
    const item = ruleset.content[entry.item];
    if (!item) continue;
    const ids = templatesOf(entry);
    const saved = entry.templates?.length ?? 0;
    const templates = ids
      .map((t, i) => {
        const template = ruleset.content[t];
        return template && i >= saved ? keptTemplate(ruleset, template, item.qid) : template;
      })
      .filter((t): t is LoadedItem => t?.type === 'template');
    const self = selfView(entry, stateDecls(ruleset, item, templates), ids);
    const { id: qid, type, tags, ...fields } = itemView(ruleset, item, templates, inputField);
    const state: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(self))
      if (!['id', 'equipped', 'quantity', 'templates'].includes(k)) state[k] = v;
    out.push({
      id: entry.id,
      item: qid,
      type,
      tags,
      equipped: self.equipped,
      quantity: self.quantity,
      templates: self.templates,
      state,
      fields,
    });
  }
  return out;
}

const plain = (v: unknown) => f.fromData(v);

export function characterQueries(
  all: CopyView[],
  copyData: () => readonly unknown[],
): Omit<f.CharacterQueries, 'fields' | 'fieldValue'> {
  return {
    copies: copyData,
    countEquipped: (type) => all.filter((c) => c.type === type && c.equipped).length,
    countState: (key) =>
      all.filter((c) => {
        const v = c.state[key];
        return v !== undefined && plain(v).kind === 'bool' && f.toData(plain(v)) === true;
      }).length,
    sumState: (type, key) =>
      all
        .filter((c) => c.type === type)
        .reduce((sum, c) => {
          const v = c.state[key] === undefined ? undefined : plain(c.state[key]);
          return f.roundDecimal(
            sum + (v && (v.kind === 'int' || v.kind === 'decimal') ? v.value : 0),
          );
        }, 0),
  };
}

const fieldViewCache = new WeakMap<Ruleset, readonly f.FieldView[]>();
const fieldSetCache = new WeakMap<Ruleset, Map<string, FieldSetMember[]>>();

export function writtenTags(tags: readonly TagOrFormula[] | undefined): string[] {
  return (tags ?? []).filter((t): t is string => typeof t === 'string');
}

export function hasComputedTags(def: FieldDef): boolean {
  return (def.tags ?? []).some((t) => typeof t !== 'string');
}

const parsedWhere = new Map<string, ReturnType<typeof f.parse>>();

/** The condition reads only `item` and `picked`; one that fails to evaluate matches nothing. */
export function fieldSetMatches(
  where: string | number | boolean,
  view: f.FieldView,
  picked: Record<string, unknown> = {},
  id?: (text: string) => string | undefined,
): boolean {
  if (typeof where !== 'string') return Boolean(where);
  let tree = parsedWhere.get(where);
  if (!tree) parsedWhere.set(where, (tree = f.parse(where)));
  if (!tree.ok) return false;
  const result = f.evaluate(tree.value, {
    field: () => undefined,
    roots: { ...picked, item: { id: view.id, type: view.type, tags: [...view.tags] } },
    ...(id ? { id } : {}),
  });
  return result.ok && result.value.kind === 'bool' && result.value.value;
}

export interface FieldSetMember {
  id: string;
  computed: boolean;
}

/**
 * Resolved once per ruleset. A field with computed tags is listed with `computed` and matched
 * against its tags on each sheet.
 */
export function fieldSet(
  ruleset: Ruleset,
  where: string | number | boolean,
  picked?: Record<string, unknown>,
  /** `grant` reaches set fields; every other op numeric ones. */
  sets = false,
  pack?: string,
): readonly FieldSetMember[] {
  let cache = fieldSetCache.get(ruleset);
  if (!cache) {
    cache = new Map();
    fieldSetCache.set(ruleset, cache);
  }
  const key = JSON.stringify([where, picked ?? null, sets, pack ?? null]);
  const id = pack === undefined ? undefined : (text: string) => resolveId(ruleset, text, pack);
  let out = cache.get(key);
  if (out) return out;
  out = [];
  for (const view of fieldViews(ruleset)) {
    if (sets ? view.type !== 'set' : view.type !== 'integer' && view.type !== 'decimal') continue;
    if (hasComputedTags(ruleset.fields[view.id] as FieldDef))
      out.push({ id: view.id, computed: true });
    else if (fieldSetMatches(where, view, picked, id)) out.push({ id: view.id, computed: false });
  }
  cache.set(key, out);
  return out;
}

/** Computed tags are left out: they are the sheet's. One array per ruleset. */
export function fieldViews(ruleset: Ruleset): readonly f.FieldView[] {
  let views = fieldViewCache.get(ruleset);
  if (!views) {
    views = Object.entries(ruleset.fields).map(([id, def]) => ({
      id,
      type: def.type,
      tags: writtenTags(def.tags),
    }));
    fieldViewCache.set(ruleset, views);
  }
  return views;
}

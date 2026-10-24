import type {
  BandSet,
  ActionDef,
  Choice,
  Constraint,
  ContentItem,
  DeclaredField,
  ContentTypeDef,
  DisplayGroup,
  Effect,
  FieldDef,
  FieldHints,
  TypeHints,
  FollowUp,
  Formula,
  Immunity,
  Literal,
  PackManifest,
  Query,
  Settings,
  Situational,
  TagMembers,
  UpgradeDoc,
  ValueDecl,
} from './pack-types.ts';
import type { PackRelease } from './release.ts';

/** Where a rules-level definition came from; its formulas resolve names in this pack's scope. */
export interface FromPack {
  pack: string;
}

export interface RulesetPack {
  id: string;
  version: string;
  license: string;
  credit?: string;
  /** Other license notices, by name, in order. */
  notices?: Record<string, string>;
  specVersion: string;
  /** The pack followed by its transitive dependencies, nearest first. */
  scope: string[];
}

/** A content item after loading: every reference qualified, `extends` and overrides applied. */
export interface LoadedItem extends ContentItem {
  qid: string;
  pack: string;
  /** Qualified content type, or `template`. */
  type: string;
  hidden?: boolean;
  /** Packs whose formulas replaced top-level properties (overrides), by property name. */
  scopes?: Record<string, string>;
  /** A kept template's `params` as its keeper gave them, as formula roots. */
  bound?: Record<string, unknown>;
}

export interface LoadedContentType extends ContentTypeDef, FromPack {
  /** The type's name without its pack (`weapon`), as formulas see it. */
  name: string;
}

/** A link slot after loading; `pack` is the defining pack. */
export interface LoadedLink extends FromPack {
  /** The slot's name without its pack (`crew`), as formulas see it. */
  name: string;
  fields: Record<string, DeclaredField>;
  /** The pack the linked character is expected to use (the slot's own `pack`), if any. */
  expects?: string;
}

/** A creation start after loading. `pack` declared it and names it. */
export interface LoadedCreationStart extends FromPack {
  id: string;
  action: string;
  params?: Record<string, Literal>;
  random: boolean;
}

export interface Conflict {
  target: string;
  property?: string;
  packs: string[];
}

/** The output of loadRuleset: plain JSON. Only the top-level properties are fixed by the spec. */
export interface Ruleset {
  specVersion: string;
  packs: RulesetPack[];
  tags: string[];
  fields: Record<string, FieldDef & FromPack>;
  contentTypes: Record<string, LoadedContentType>;
  content: Record<string, LoadedItem>;
  rules: {
    settings: Settings;
    situational: Record<string, Situational & FromPack>;
    /** By name; a later pack's declaration replaces an earlier one. Members qualified in the declaring pack. */
    templateFields: Record<string, ValueDecl & FromPack>;
    links: Record<string, LoadedLink>;
    tallies: Record<string, { name: string } & FromPack>;
    bands: Record<string, BandSet & FromPack>;
    actions: Record<string, ActionDef & FromPack>;
    effects: (Effect & FromPack & { index: number })[];
    /** In load order, then declaration order. */
    followUps: (FollowUp & FromPack)[];
    /** In load order, then declaration order. */
    immuneTo: (Immunity & FromPack)[];
    /** The queries, qualified, in load order. */
    standardCopies: (Query & FromPack)[];
    choices: Record<string, Choice & FromPack>;
    constraints: Record<string, Constraint & FromPack>;
    display: {
      groups: (DisplayGroup & FromPack)[];
      fields: Record<string, FieldHints & FromPack>;
      /** By content type name. */
      types: Record<string, TypeHints & FromPack>;
    };
  };
  /** Every pack's in load order; a later start with the same ID replaces the earlier in place. */
  creation: LoadedCreationStart[];
  /** Each pack's upgrade scripts (all of them, old ones included), by pack ID. */
  upgrades: Record<string, UpgradeDoc[]>;
  /** Results of content-only queries, by query key (see queryKey). */
  queries: Record<string, string[]>;
  /** By qualified name: the values, with loaded packs' additions. */
  families: Record<string, string[]>;
  /** By qualified family: the pack each added value comes from, whose fields `fieldOf` reads. */
  familyOrigins: Record<string, Record<string, string>>;
  /** By `<pack>:<enum>` address: the pack each added value comes from, whose text names it. */
  enumOrigins: Record<string, Record<string, string>>;
  conflicts: Conflict[];
  /** The releases loaded, so a character's homebrew can be layered wherever the ruleset is sent. */
  sources: PackRelease[];
}

export type { PackManifest };

export function queryKey(pack: string, type: string, where: Formula | undefined): string {
  return JSON.stringify([pack, type, where ?? null]);
}

export function packOf(ruleset: Ruleset, id: string): RulesetPack | undefined {
  return ruleset.packs.find((p) => p.id === id);
}

function find<T>(
  ruleset: Ruleset,
  map: Record<string, T>,
  ref: string,
  pack: string,
): string | undefined {
  if (ref.includes(':')) return Object.hasOwn(map, ref) ? ref : undefined;
  for (const pid of packOf(ruleset, pack)?.scope ?? [pack]) {
    const qid = `${pid}:${ref}`;
    if (Object.hasOwn(map, qid)) return qid;
  }
  return undefined;
}

export const resolveField = (r: Ruleset, ref: string, pack: string) => find(r, r.fields, ref, pack);
export const resolveContent = (r: Ruleset, ref: string, pack: string) =>
  find(r, r.content, ref, pack);
export const resolveType = (r: Ruleset, ref: string, pack: string) =>
  ref === 'template' ? 'template' : find(r, r.contentTypes, ref, pack);
export const resolveAction = (r: Ruleset, ref: string, pack: string) =>
  find(r, r.rules.actions, ref, pack);
export const resolveBands = (r: Ruleset, ref: string, pack: string) =>
  find(r, r.rules.bands, ref, pack);
export const resolveTally = (r: Ruleset, ref: string, pack: string) =>
  find(r, r.rules.tallies, ref, pack);
export const resolveLink = (r: Ruleset, ref: string, pack: string) =>
  find(r, r.rules.links, ref, pack);

/** A family's values as a pack sees it, by name: its own first, then its scope's. */
export function familyIn(r: Ruleset, name: string, pack: string): string[] | undefined {
  return familyQid(r, name, pack) ? r.families[familyQid(r, name, pack) as string] : undefined;
}

function familyQid(r: Ruleset, name: string, pack: string): string | undefined {
  return (packOf(r, pack)?.scope ?? [pack])
    .map((pid) => `${pid}:${name}`)
    .find((qid) => r.families[qid] !== undefined);
}

/** The pack whose fields a family's value names: the pack that added the value, else the formula's own. */
export function familyFieldPack(r: Ruleset, name: string, key: string, pack: string): string {
  const qid = familyQid(r, name, pack);
  return (qid && r.familyOrigins?.[qid]?.[key]) ?? pack;
}

/**
 * An ID literal in a formula: the qualified ID of the content item, field, content type, rules
 * action or link slot it names, looked up in that order in the pack's scope; a qualified ID of a
 * pack the ruleset doesn't load as written; otherwise undefined.
 */
export const resolveId = (r: Ruleset, ref: string, pack: string): string | undefined =>
  resolveContent(r, ref, pack) ??
  resolveField(r, ref, pack) ??
  find(r, r.contentTypes, ref, pack) ??
  resolveAction(r, ref, pack) ??
  resolveLink(r, ref, pack) ??
  (ref.includes(':') && !packOf(r, ref.slice(0, ref.indexOf(':'))) ? ref : undefined);

/** A standard copy's instance ID: `fitd-scoundrel:gear.lantern` → `fitd-scoundrel-gear-lantern`. */
export function standardId(qid: string): string {
  return qid.replaceAll(/[:.]/g, '-');
}

/** The items standard copies queries match: in query order, each query's in content order, each once. */
function standardMatches(
  ruleset: Ruleset,
  queries: readonly { query: Query; pack: string }[],
): string[] {
  const out = new Set<string>();
  for (const { query, pack } of queries)
    for (const qid of ruleset.queries[queryKey(pack, query.type, query.where)] ?? []) out.add(qid);
  return [...out];
}

/** The items the rules' standard copies match: every character holds a copy of each. */
export function rulesStandard(ruleset: Ruleset): string[] {
  return standardMatches(
    ruleset,
    ruleset.rules.standardCopies.map(({ pack, ...query }) => ({ query, pack })),
  );
}

/** The items an item's standard copies match, held while the item is active. */
export function itemStandard(ruleset: Ruleset, item: LoadedItem): string[] {
  if (!item.standardCopies?.length) return [];
  const pack = item.scopes?.standardCopies ?? item.pack;
  return standardMatches(
    ruleset,
    item.standardCopies.map((query) => ({ query, pack })),
  );
}

/**
 * Whether a reference is qualified with a pack the ruleset doesn't load: a change for a role or
 * target that names one is passed on as written, for the participant to check.
 */
export function unloadedPack(ruleset: Ruleset, ref: string): boolean {
  const colon = ref.indexOf(':');
  return colon > 0 && !packOf(ruleset, ref.slice(0, colon));
}

export function localPart(qid: string): string {
  return qid.slice(qid.indexOf(':') + 1);
}

const declaredTagSets = new WeakMap<Ruleset, Set<string>>();

/** Every tag the ruleset's packs declare, with the tags above each (`damage` for `damage.fire`). */
function declaredTags(ruleset: Ruleset): Set<string> {
  let set = declaredTagSets.get(ruleset);
  if (set) return set;
  set = new Set();
  for (const tag of ruleset.tags) {
    const parts = tag.split('.');
    for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join('.'));
  }
  declaredTagSets.set(ruleset, set);
  return set;
}

/**
 * Whether a tag `id` or `set` takes a tag: one in `tags`, or below one in `under`, and not in
 * `except` (the tags below one still can be). Without `members`, every tag.
 */
export function admitsTag(members: TagMembers | undefined, tag: string): boolean {
  if (!members) return true;
  const below = (t: string) => tag.startsWith(`${t}.`);
  if (members.except?.includes(tag)) return false;
  return (members.tags?.includes(tag) ?? false) || (members.under?.some(below) ?? false);
}

/** A computed tag's value: a string, or a list of strings; data, as evaluated. */
export type TagValue = { kind: string; value?: unknown };

/**
 * A tags list evaluated: a computed tag gives one tag or a list, spread in its place; repeats are
 * dropped. A computed tag must be declared (`unknown-tag`); anything but a string or a list of
 * strings is `type-mismatch`.
 */
export function evaluateTags(
  ruleset: Ruleset,
  list: readonly (string | { formula: Formula })[] | undefined,
  evaluate: (formula: Formula) => TagValue,
): { ok: true; tags: string[] } | { ok: false; code: string; data: Record<string, unknown> } {
  const tags: string[] = [];
  for (const entry of list ?? []) {
    if (typeof entry === 'string') {
      if (!tags.includes(entry)) tags.push(entry);
      continue;
    }
    const value = evaluate(entry.formula);
    const values = value.kind === 'list' ? (value.value as TagValue[]) : [value];
    for (const v of values) {
      if (v.kind !== 'string')
        return {
          ok: false,
          code: 'type-mismatch',
          data: { message: `a computed tag evaluated to ${v.kind}, not a string` },
        };
      const tag = v.value as string;
      if (!declaredTags(ruleset).has(tag)) return { ok: false, code: 'unknown-tag', data: { tag } };
      if (!tags.includes(tag)) tags.push(tag);
    }
  }
  return { ok: true, tags };
}

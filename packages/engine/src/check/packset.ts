import type {
  BandSet,
  ActionDef,
  Choice,
  ContentItem,
  ContentTypeDef,
  CreationStart,
  Constraint,
  DisplayGroup,
  Effect,
  FieldDef,
  FieldHints,
  TypeHints,
  FollowUp,
  Immunity,
  LinkSlot,
  PackManifest,
  Query,
  RulesDoc,
  Situational,
  ValueDecl,
} from '../core/pack-types.ts';
import { bandSet } from '../core/pack-types.ts';

// Packs as written, before loading, with lookups that resolve a reference in a pack, then its
// dependencies. The build (file paths as locations) and loadRuleset (JSON paths) both use it.

/** A definition and where it came from: a file for the build, a JSON path for loadRuleset. */
export interface Located<T, L> {
  def: T;
  at: L;
  pack: string;
}

export interface MergedRules<L> {
  tags: Map<string, Located<string, L>>;
  fields: Map<string, Located<FieldDef, L>>;
  links: Map<string, Located<LinkSlot, L>>;
  contentTypes: Map<string, Located<ContentTypeDef, L>>;
  templateFields: Map<string, Located<ValueDecl, L>>;
  situational: Map<string, Located<Situational, L>>;
  tallies: Map<string, Located<string, L>>;
  bands: Map<string, Located<BandSet, L>>;
  actions: Map<string, Located<ActionDef, L>>;
  effects: Located<Effect, L>[];
  followUps: Located<FollowUp, L>[];
  creation: Located<CreationStart, L>[];
  immuneTo: Located<Immunity, L>[];
  standardCopies: Located<Query, L>[];
  choices: Map<string, Located<Choice, L>>;
  constraints: Map<string, Located<Constraint, L>>;
  groups: Map<string, Located<DisplayGroup, L>>;
  fieldHints: Map<string, Located<FieldHints, L>>;
  /** Hints for content types, by type name as written. */
  typeHints: Map<string, Located<TypeHints, L>>;
  /** Families as written: own ones by name, additions by qualified name. */
  families: Map<string, string[]>;
  /** Values added to a dependency's open enums, by `<pack>:<enum>` address. */
  extendEnums: Map<string, Located<string[], L>>;
}

export interface ContentEntry<L> {
  qid: string;
  item: ContentItem;
  pack: string;
  at: L;
}

export interface PackInput<L> {
  manifest: PackManifest;
  at: L;
  rules: { doc: RulesDoc; at: L }[];
  content: { doc: ContentItem; at: L }[];
}

export class PackSet<L> {
  readonly manifests = new Map<string, PackManifest>();
  readonly rules = new Map<string, MergedRules<L>>();
  readonly content = new Map<string, ContentEntry<L>>();
  /** Items with an `override` have no ID. */
  readonly packContent = new Map<string, { doc: ContentItem; at: L }[]>();

  constructor(
    packs: PackInput<L>[],
    /** Called for a duplicate pack, definition or content ID; the first one is kept. */
    onDuplicate: (at: L, message: string) => void = () => {},
  ) {
    for (const pack of packs) {
      const id = pack.manifest.id;
      if (this.manifests.has(id)) {
        onDuplicate(pack.at, `duplicate pack id "${id}"`);
        continue;
      }
      this.manifests.set(id, pack.manifest);
      this.rules.set(id, merge(id, pack, onDuplicate));
      this.packContent.set(id, pack.content);
      for (const { at, doc } of pack.content) {
        if (doc.id === undefined) continue;
        const qid = `${id}:${doc.id}`;
        const existing = this.content.get(qid);
        if (existing) {
          onDuplicate(at, `duplicate content id "${doc.id}" (also in ${String(existing.at)})`);
          continue;
        }
        this.content.set(qid, { qid, item: doc, pack: id, at });
      }
    }
  }

  /** The pack followed by its transitive dependencies (nearest first). */
  scope(packId: string): string[] {
    const order: string[] = [];
    const visit = (id: string) => {
      if (order.includes(id)) return;
      order.push(id);
      for (const dep of Object.keys(this.manifests.get(id)?.dependencies ?? {})) visit(dep);
    };
    visit(packId);
    return order;
  }

  private find<T>(
    ref: string,
    scope: string[],
    get: (rules: MergedRules<L>) => Map<string, Located<T, L>>,
  ): (Located<T, L> & { qid: string }) | undefined {
    const [pack, local] = ref.includes(':') ? ref.split(':', 2) : [undefined, ref];
    for (const pid of pack ? [pack] : scope) {
      const rules = this.rules.get(pid);
      const hit = rules && local !== undefined ? get(rules).get(local) : undefined;
      if (hit) return { ...hit, qid: `${pid}:${local}` };
    }
    return undefined;
  }

  /** With the values the scope's packs add to its open enums. */
  field(ref: string, scope: string[]) {
    const hit = this.find(ref, scope, (r) => r.fields);
    if (!hit || hit.def.type !== 'enum' || hit.def.open !== true) return hit;
    const values = this.enumValues(
      hit.def.values,
      `${hit.pack}:fields.${hit.qid.slice(hit.pack.length + 1)}`,
      scope,
    );
    return values ? { ...hit, def: { ...hit.def, values } } : hit;
  }

  /** With the values the scope's packs add to its open enums. */
  contentType(name: string, scope: string[]) {
    const hit = this.find(name, scope, (r) => r.contentTypes);
    if (!hit) return hit;
    const local = hit.qid.slice(hit.pack.length + 1);
    let def = hit.def;
    for (const of of ['fields', 'state'] as const)
      for (const [key, decl] of Object.entries(def[of] ?? {})) {
        if (decl.type !== 'enum' || decl.open !== true) continue;
        const values = this.enumValues(
          decl.values,
          `${hit.pack}:types.${local}.${of}.${key}`,
          scope,
        );
        if (values) def = { ...def, [of]: { ...def[of], [key]: { ...decl, values } } };
      }
    return def === hit.def ? hit : { ...hit, def };
  }

  /** An open enum's values with each scoped pack's additions, farthest dependency first. */
  private enumValues(
    own: string[] | undefined,
    target: string,
    scope: string[],
  ): string[] | undefined {
    let out: string[] | undefined;
    for (const pid of scope.toReversed())
      for (const value of this.rules.get(pid)?.extendEnums.get(target)?.def ?? []) {
        out ??= [...(own ?? [])];
        if (!out.includes(value)) out.push(value);
      }
    return out;
  }

  action(ref: string, scope: string[]) {
    return this.find(ref, scope, (r) => r.actions);
  }

  bands(ref: string, scope: string[]) {
    return this.find(ref, scope, (r) => r.bands);
  }

  link(ref: string, scope: string[]) {
    return this.find(ref, scope, (r) => r.links);
  }

  situational(ref: string, scope: string[]) {
    return this.find(ref, scope, (r) => r.situational);
  }

  rulesChoice(ref: string, scope: string[]) {
    return this.find(ref, scope, (r) => r.choices);
  }

  /** The first scoped pack's declaration; other packs' additions are read at run time. */
  family(name: string, scope: string[]): string[] | undefined {
    for (const pid of scope) {
      const own = this.rules.get(pid)?.families.get(name);
      if (own) return [...own];
    }
    return undefined;
  }

  group(ref: string, scope: string[]) {
    return this.find(ref, scope, (r) => r.groups);
  }

  item(ref: string, scope: string[]): ContentEntry<L> | undefined {
    if (ref.includes(':')) return this.content.get(ref);
    for (const pid of scope) {
      const hit = this.content.get(`${pid}:${ref}`);
      if (hit) return hit;
    }
    return undefined;
  }

  typeOf(entry: ContentEntry<L>, seen = new Set<string>()): string | undefined {
    if (seen.has(entry.qid)) return undefined;
    seen.add(entry.qid);
    const { item } = entry;
    if (item.type) return item.type;
    const parentRef = item.extends ?? item.override;
    const parent = parentRef ? this.item(parentRef, this.scope(entry.pack)) : undefined;
    return parent ? this.typeOf(parent, seen) : undefined;
  }

  declaredTags(scope: string[]): Set<string> {
    const tags = new Set<string>();
    for (const pid of scope) {
      for (const tag of this.rules.get(pid)?.tags.keys() ?? []) {
        const parts = tag.split('.');
        for (let i = 1; i <= parts.length; i++) tags.add(parts.slice(0, i).join('.'));
      }
    }
    return tags;
  }

  /** A nearer pack's declaration wins. */
  templateFields(scope: string[]): Map<string, Located<ValueDecl, L>> {
    const out = new Map<string, Located<ValueDecl, L>>();
    for (const pid of scope)
      for (const [name, def] of this.rules.get(pid)?.templateFields ?? [])
        if (!out.has(name)) out.set(name, def);
    return out;
  }

  fieldIds(scope: string[]): Set<string> {
    const ids = new Set<string>();
    for (const pid of scope) for (const id of this.rules.get(pid)?.fields.keys() ?? []) ids.add(id);
    return ids;
  }
}

function merge<L>(
  pid: string,
  pack: PackInput<L>,
  onDuplicate: (at: L, message: string) => void,
): MergedRules<L> {
  const merged: MergedRules<L> = {
    tags: new Map(),
    fields: new Map(),
    links: new Map(),
    contentTypes: new Map(),
    templateFields: new Map(),
    situational: new Map(),
    tallies: new Map(),
    bands: new Map(),
    actions: new Map(),
    effects: [],
    followUps: [],
    creation: [],
    immuneTo: [],
    standardCopies: [],
    choices: new Map(),
    constraints: new Map(),
    groups: new Map(),
    fieldHints: new Map(),
    typeHints: new Map(),
    families: new Map(),
    extendEnums: new Map(),
  };
  const put = <T>(map: Map<string, Located<T, L>>, key: string, def: T, at: L, what: string) => {
    const existing = map.get(key);
    if (existing) {
      onDuplicate(at, `duplicate ${what} "${key}" (also in ${String(existing.at)})`);
      return;
    }
    map.set(key, { def, at, pack: pid });
  };
  for (const { at, doc } of pack.rules) {
    for (const [name, values] of Object.entries(doc.families ?? {}))
      merged.families.set(name, values.map(String));
    for (const [target, values] of Object.entries(doc.extendEnums ?? {}))
      merged.extendEnums.set(target, {
        def: [...(merged.extendEnums.get(target)?.def ?? []), ...values],
        at: merged.extendEnums.get(target)?.at ?? at,
        pack: pid,
      });
    for (const tag of doc.tags ?? []) put(merged.tags, tag, tag, at, 'tag');
    for (const [id, def] of Object.entries(doc.fields ?? {}))
      put(merged.fields, id, def, at, 'field');
    for (const [name, def] of Object.entries(doc.links ?? {}))
      put(merged.links, name, def, at, 'link slot');
    for (const [id, def] of Object.entries(doc.contentTypes ?? {}))
      put(merged.contentTypes, id, def, at, 'content type');
    for (const [name, def] of Object.entries(doc.templateFields ?? {}))
      put(merged.templateFields, name, def, at, 'template field');
    for (const def of doc.situational ?? [])
      put(merged.situational, def.id, def, at, 'situational choice');
    for (const name of doc.rollTallies ?? []) put(merged.tallies, name, name, at, 'roll tally');
    for (const [id, def] of Object.entries(doc.resultBands ?? {}))
      put(merged.bands, id, bandSet(def), at, 'result band set');
    for (const def of doc.actions ?? []) put(merged.actions, def.id, def, at, 'action');
    for (const def of doc.effects ?? []) merged.effects.push({ def, at, pack: pid });
    for (const def of doc.followUps ?? []) merged.followUps.push({ def, at, pack: pid });
    for (const def of doc.creation ?? []) merged.creation.push({ def, at, pack: pid });
    for (const def of doc.immuneTo ?? []) merged.immuneTo.push({ def, at, pack: pid });
    for (const def of doc.standardCopies ?? []) merged.standardCopies.push({ def, at, pack: pid });
    for (const def of doc.choices ?? []) put(merged.choices, def.id, def, at, 'choice');
    for (const def of doc.constraints ?? []) put(merged.constraints, def.id, def, at, 'constraint');
    for (const def of doc.display?.groups ?? [])
      put(merged.groups, def.id, def, at, 'display group');
    for (const [id, def] of Object.entries(doc.display?.fields ?? {}))
      put(merged.fieldHints, id, def, at, 'field hint');
    for (const [type, def] of Object.entries(doc.display?.types ?? {}))
      put(merged.typeHints, type, def, at, 'content-type hint');
  }
  return merged;
}

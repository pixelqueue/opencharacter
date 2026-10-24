import semver from 'semver';
import { SPEC_VERSION } from '@opencharacter/spec';
import { checkPackFormulas } from '../check/formulas.ts';
import { PackSet } from '../check/packset.ts';
import * as f from '../formula/index.ts';
import type { FormulaError } from '../formula/index.ts';
import type {
  ActionDef,
  ActionOrUse,
  Choice,
  ContentItem,
  Destination,
  Effect,
  FollowUp,
  Grant,
  GrantValue,
  Immunity,
  InlineOption,
  Literal,
  OptionValue,
  PresetTree,
  ProposedChange,
  Query,
  Role,
  Step,
  StepChanges,
  ValueDecl,
} from './pack-types.ts';
import { appliesQueries, fitsItemField, keptQuery } from './pack-types.ts';
import { bandSet, stepArms } from './pack-types.ts';
import type { PackRelease } from './release.ts';
import { expandFamilies } from './families.ts';
import {
  admitsTag,
  itemStandard,
  type LoadedItem,
  queryKey,
  rulesStandard,
  standardId,
  resolveAction,
  resolveBands,
  resolveContent,
  resolveLink,
  resolveTally,
  resolveField,
  resolveId,
  resolveType,
  type Ruleset,
} from './ruleset.ts';
import { itemFieldDeclsOf, itemView } from './views.ts';

import type { EngineError } from '@opencharacter/spec';

export type { EngineError };

export type LoadResult = { ok: true; ruleset: Ruleset } | { ok: false; errors: EngineError[] };

const MAX_EXTENDS = 16;
/** What a template gives only on a copy, so it can't be kept on content without one. */
const COPY_ONLY = [
  'state',
  'computed',
  'effects',
  'followUps',
  'actions',
  'choices',
  'grants',
  'immuneTo',
  'reapply',
  'nameFrom',
  'standardCopies',
  'keepsFields',
  'keepsTemplates',
  'prerequisites',
  'suppress',
] as const;
const BUILT_IN_MEMBER_KINDS = new Set(['field', 'tag', 'string']);

const isObj = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Objects merge key by key; arrays are replaced. */
function merge(base: ContentItem, overlay: ContentItem): ContentItem {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = out[key];
    out[key] =
      isObj(current) && isObj(value) ? { ...(current as object), ...(value as object) } : value;
  }
  return out as ContentItem;
}

function literalSource(c: ProposedChange): string | undefined {
  if (c.type !== 'applyEffect' || typeof c.source !== 'string') return undefined;
  const tree = f.parseCached(c.source);
  return tree.ok && tree.value.type === 'string' ? tree.value.value : undefined;
}

function ownActions(def: { actions?: ActionOrUse[] }): Set<string> {
  return new Set((def.actions ?? []).flatMap((a) => ('use' in a ? [] : [a.id])));
}

/** Reference-engine options, not part of the spec's call input. */
export interface LoadRulesetOptions {
  /**
   * Releases built by `pnpm build:packs` from the app's own bundle: their formula checks are
   * skipped. Matched by object; a release without a compiled formula table is checked anyway.
   */
  prechecked?: ReadonlySet<PackRelease>;
}

/** loadRuleset: packages/spec/docs/engine-core.md. */
export function loadRuleset(packs: PackRelease[], options: LoadRulesetOptions = {}): LoadResult {
  const { prechecked } = options;
  const trusted = (pack: PackRelease) => pack.formulas !== undefined && prechecked?.has(pack);
  if (!prechecked || !packs.some(trusted)) return loadPacks(packs);
  const check = packs.filter((pack) => !trusted(pack)).map((pack) => pack.manifest.id);
  return loadPacks(packs, { checkFormulasOf: new Set(check) });
}

export interface LoadOptions {
  /** Only these packs' formulas are checked (the others were checked when the base loaded). */
  checkFormulasOf?: ReadonlySet<string>;
  onFormula?: (pack: string, text: string) => void;
}

/** loadRuleset's steps, with options for layering a character's homebrew. */
export function loadPacks(packs: PackRelease[], options: LoadOptions = {}): LoadResult {
  const errors: EngineError[] = [];
  const err = (code: string, data: Record<string, unknown>, path?: string) =>
    errors.push(path ? { code, path, data } : { code, data });

  // 1. Check the packs.
  const byId = new Map<string, PackRelease>();
  packs.forEach((pack, i) => {
    const { id, specVersion } = pack.manifest;
    if (byId.has(id)) err('duplicate-pack', { pack: id }, `/packs/${i}`);
    byId.set(id, pack);
    if (semver.gt(specVersion, SPEC_VERSION)) {
      err('spec-version-unsupported', { pack: id, required: specVersion }, `/packs/${i}`);
    }
  });
  for (const pack of byId.values()) {
    for (const [dep, range] of Object.entries(pack.manifest.dependencies ?? {})) {
      const found = byId.get(dep);
      if (!found || !semver.satisfies(found.manifest.version, range)) {
        err('missing-dependency', { pack: pack.manifest.id, dependency: dep, range });
      }
    }
  }
  // Compiled formulas must match their text: a stale or tampered tree is refused.
  for (const pack of byId.values()) {
    for (const [text, compiled] of Object.entries(pack.formulas ?? {})) {
      const tree = f.parseCached(text);
      if (!tree.ok)
        err('formula-error', { pack: pack.manifest.id, formula: text, cause: tree.error.code });
      else if (
        JSON.stringify(tree.value) !== JSON.stringify(compiled.tree) ||
        f.print(tree.value) !== compiled.text
      ) {
        err('formula-error', { pack: pack.manifest.id, formula: text, cause: 'compiled-mismatch' });
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const scopeOf = (id: string): string[] => {
    const order: string[] = [];
    const visit = (pid: string) => {
      if (order.includes(pid)) return;
      order.push(pid);
      for (const dep of Object.keys(byId.get(pid)?.manifest.dependencies ?? {})) visit(dep);
    };
    visit(id);
    return order;
  };

  // 1b. Families and shared view fields, expanded before anything reads the rules. A pack sees
  // its own families and its dependencies' by name, its own first.
  const declaredFamilies = new Map<string, string[]>();
  for (const pack of byId.values())
    for (const [name, values] of Object.entries(pack.rules.families ?? {}))
      if (!name.includes(':'))
        declaredFamilies.set(`${pack.manifest.id}:${name}`, values.map(String));
  const families = new Map([...declaredFamilies].map(([qid, values]) => [qid, [...values]]));
  const familyOrigins: Record<string, Record<string, string>> = {};
  for (const pack of byId.values())
    for (const [name, values] of Object.entries(pack.rules.families ?? {})) {
      if (!name.includes(':')) continue;
      const base = families.get(name);
      if (!base) {
        err('invalid-family', { pack: pack.manifest.id, message: `no family "${name}" to add to` });
        continue;
      }
      for (const v of values.map(String)) {
        if (base.includes(v)) continue;
        base.push(v);
        (familyOrigins[name] ??= {})[v] = pack.manifest.id;
      }
    }
  packs.forEach((pack, i) => {
    const pid = pack.manifest.id;
    const visible = new Map<string, string[]>();
    for (const scoped of scopeOf(pid).toReversed())
      for (const [qid, values] of declaredFamilies)
        if (qid.startsWith(`${scoped}:`)) visible.set(qid.slice(scoped.length + 1), values);
    if (visible.size === 0 && pack.rules.viewFields === undefined) return;
    const expanded = expandFamilies([pack.rules], pack.content, visible);
    for (const problem of expanded.problems)
      err(
        'invalid-family',
        { pack: pid, message: problem.message },
        'rules' in problem.where
          ? `/packs/${i}/rules`
          : `/packs/${i}/content/${problem.where.content}`,
      );
    byId.set(pid, {
      ...pack,
      rules: expanded.rules[0] as PackRelease['rules'],
      content: expanded.content,
    });
  });
  if (errors.length > 0) return { ok: false, errors };

  const ruleset: Ruleset = {
    specVersion: SPEC_VERSION,
    packs: [...byId.values()].map((p) => ({
      id: p.manifest.id,
      version: p.manifest.version,
      license: p.manifest.license,
      ...(p.manifest.credit ? { credit: p.manifest.credit } : {}),
      ...(p.manifest.notices ? { notices: { ...p.manifest.notices } } : {}),
      specVersion: p.manifest.specVersion,
      scope: scopeOf(p.manifest.id),
    })),
    tags: [],
    fields: {},
    contentTypes: {},
    content: {},
    rules: {
      settings: {},
      situational: {},
      templateFields: {},
      links: {},
      tallies: {},
      bands: {},
      actions: {},
      effects: [],
      followUps: [],
      immuneTo: [],
      standardCopies: [],
      choices: {},
      constraints: {},
      display: { groups: [], fields: {}, types: {} },
    },
    creation: [],
    upgrades: Object.fromEntries([...byId.values()].map((p) => [p.manifest.id, p.upgrades ?? []])),
    queries: {},
    families: Object.fromEntries(families),
    familyOrigins,
    enumOrigins: {},
    optionOrigins: {},
    conflicts: [],
    sources: packs,
  };

  // 2. Merge the rules. Names first, so references can resolve across packs.
  const tags = new Set<string>();
  for (const pack of byId.values()) {
    const pid = pack.manifest.id;
    const r = pack.rules;
    for (const tag of r.tags ?? []) tags.add(tag);
    for (const [name, def] of Object.entries(r.contentTypes ?? {})) {
      ruleset.contentTypes[`${pid}:${name}`] = { ...def, pack: pid, name };
    }
    for (const [id, def] of Object.entries(r.fields ?? {}))
      ruleset.fields[`${pid}:${id}`] = { ...def, pack: pid };
    // Template fields are named, not qualified: a redeclaration must keep the type, and wins.
    for (const [name, def] of Object.entries(r.templateFields ?? {})) {
      const earlier = ruleset.rules.templateFields[name];
      if (earlier && !sameValueType(earlier, def))
        err('template-field-mismatch', { field: name, packs: [earlier.pack, pid] });
      ruleset.rules.templateFields[name] = { ...def, pack: pid };
    }
    for (const [name, def] of Object.entries(r.links ?? {})) {
      ruleset.rules.links[`${pid}:${name}`] = {
        name,
        fields: def.fields,
        ...(def.pack !== undefined ? { expects: def.pack } : {}),
        pack: pid,
      };
    }
    for (const def of r.actions ?? [])
      ruleset.rules.actions[`${pid}:${def.id}`] = { ...def, pack: pid };
    for (const name of r.rollTallies ?? [])
      ruleset.rules.tallies[`${pid}:${name}`] = { name, pack: pid };
    for (const [id, set] of Object.entries(r.resultBands ?? {}))
      ruleset.rules.bands[`${pid}:${id}`] = { ...bandSet(set), pack: pid };
    for (const [key, value] of Object.entries(r.settings ?? {})) {
      const settings = ruleset.rules.settings as Record<string, unknown>;
      if (key in settings)
        ruleset.conflicts.push({ target: 'settings', property: key, packs: [pid] });
      settings[key] =
        typeof value === 'object' && value !== null
          ? { ...(settings[key] as object), ...value }
          : value;
    }
  }
  ruleset.tags = [...tags].toSorted();
  extendEnums(ruleset, byId.values(), scopeOf, err);
  const declaredByPack = new Map<string, Set<string>>();
  const declaredTags = (pack: string): Set<string> => {
    let set = declaredByPack.get(pack);
    if (set) return set;
    set = new Set();
    for (const pid of scopeOf(pack)) {
      for (const tag of byId.get(pid)?.rules.tags ?? []) {
        const parts = tag.split('.');
        for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join('.'));
      }
    }
    declaredByPack.set(pack, set);
    return set;
  };
  for (const pack of byId.values()) {
    for (const item of pack.content)
      if (item.id !== undefined)
        ruleset.content[`${pack.manifest.id}:${item.id}`] = { ...item } as LoadedItem;
  }

  const unknown = (kind: string, ref: string, pack: string) =>
    err('unknown-reference', { kind, id: ref, pack });
  const unloaded = (ref: string) => ref.includes(':') && !byId.has(ref.slice(0, ref.indexOf(':')));
  const createOffers: { def: FollowUp; pack: string }[] = [];
  const q = {
    field(ref: string, pack: string): string {
      return resolveField(ruleset, ref, pack) ?? (unknown('field', ref, pack), ref);
    },
    /** A formula item is resolved per sheet. */
    grant(g: Grant, pack: string): Grant {
      return typeof g.item === 'string' ? { ...g, item: q.content(g.item, pack) } : g;
    },
    content(ref: string, pack: string): string {
      return resolveContent(ruleset, ref, pack) ?? (unknown('content', ref, pack), ref);
    },
    type(ref: string, pack: string): string {
      if (ref === 'field') return ref;
      return resolveType(ruleset, ref, pack) ?? (unknown('content type', ref, pack), ref);
    },
    actionId(ref: string, pack: string): string {
      return resolveAction(ruleset, ref, pack) ?? (unknown('action', ref, pack), ref);
    },
    bands(ref: string, pack: string): string {
      return resolveBands(ruleset, ref, pack) ?? (unknown('result bands', ref, pack), ref);
    },
    decl(decl: ValueDecl, pack: string): ValueDecl {
      if (decl.members) return q.tagMembers(decl, pack);
      return decl.of && !BUILT_IN_MEMBER_KINDS.has(decl.of)
        ? { ...decl, of: q.type(decl.of, pack) }
        : decl;
    },
    tagMembers(decl: ValueDecl, pack: string): ValueDecl {
      const { under = [], tags: own = [], except = [] } = decl.members ?? {};
      q.tags([...under, ...own, ...except], pack);
      const all = new Set<string>();
      for (const tag of ruleset.tags) {
        const parts = tag.split('.');
        for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join('.'));
      }
      const tagOptions = [...all].filter((t) => admitsTag(decl.members, t)).toSorted();
      return { ...decl, tagOptions };
    },
    members(decl: ValueDecl, value: Literal, pack: string): Literal {
      if (!decl.of || decl.of === 'tag' || decl.of === 'string') return value;
      const one = (v: string) => (decl.of === 'field' ? q.field(v, pack) : q.content(v, pack));
      if (decl.type === 'id' && typeof value === 'string') return one(value);
      if ((decl.type === 'set' || decl.type === 'list') && Array.isArray(value))
        return value.map((v) => one(String(v)));
      return value;
    },
    decls(decls: Record<string, ValueDecl> | undefined, pack: string) {
      return (
        decls && Object.fromEntries(Object.entries(decls).map(([k, d]) => [k, q.decl(d, pack)]))
      );
    },
    query(query: Query, pack: string): Query {
      return { ...query, type: q.type(query.type, pack) };
    },
    immunity(def: Immunity, pack: string): Immunity {
      return {
        ...def,
        ...(def.items ? { items: def.items.map((i) => q.content(i, pack)) } : {}),
        ...(def.query ? { query: q.query(def.query, pack) } : {}),
      };
    },
    /** Changes sent to a link are the linked character's, so they must already be qualified. */
    changes(changes: ProposedChange[], pack: string, to?: Destination): ProposedChange[] {
      if (typeof to === 'object') {
        for (const c of changes) {
          if (typeof c.field === 'string' && !c.field.includes(':'))
            unknown('field', c.field, pack);
          if (c.copies && !c.copies.type.includes(':'))
            unknown('content type', c.copies.type, pack);
          const source = literalSource(c);
          if (source !== undefined && !source.includes(':')) unknown('content', source, pack);
        }
        return changes;
      }
      // A change for a role or target may name a pack the ruleset doesn't load: passed on as
      // written, for the participant to check.
      const other = to !== undefined && to !== 'self';
      const passed = (ref: string) => other && unloaded(ref);
      return changes.map((c) => {
        const source = literalSource(c);
        if (source !== undefined && !passed(source)) {
          const qid = resolveContent(ruleset, source, pack);
          if (!qid || ruleset.content[qid]?.type === 'template') unknown('content', source, pack);
        }
        return {
          ...c,
          // A computed field is qualified when the action runs.
          ...(typeof c.field === 'string' && !passed(c.field)
            ? { field: q.field(c.field, pack) }
            : {}),
          ...(c.copies && !passed(c.copies.type)
            ? { copies: { ...c.copies, type: q.type(c.copies.type, pack) } }
            : {}),
        };
      });
    },
    to(to: Destination | undefined, pack: string): { to?: Destination } {
      if (to === undefined) return {};
      if (typeof to === 'string') return { to };
      const qid = resolveLink(ruleset, to.link, pack);
      if (!qid) unknown('link', to.link, pack);
      return { to: { link: qid ?? to.link } };
    },
    /** A computed tag isn't checked. */
    tags(list: readonly (string | { formula: unknown })[] | undefined, pack: string): void {
      const declared = declaredTags(pack);
      for (const tag of list ?? [])
        if (typeof tag === 'string' && !declared.has(tag)) err('unknown-tag', { tag, pack });
    },
    /** An effect with `then` changes its own entry (a copy or an applied entry), so it must have one. */
    copyless(effect: Effect, pack: string): void {
      if (effect.then)
        err('then-without-copy', {
          ...(effect.id !== undefined ? { effect: effect.id } : {}),
          pack,
        });
    },
    effect(effect: Effect, pack: string): Effect {
      const out: Effect = { ...effect };
      if (typeof effect.target === 'string') out.target = q.field(effect.target, pack);
      else if ('rolls' in effect.target && effect.target.tally !== undefined) {
        const ref = effect.target.tally;
        const tally = resolveTally(ruleset, ref, pack);
        if (!tally) err('unknown-tally', { tally: ref, pack });
        out.target = { ...effect.target, tally: tally ?? ref };
      } else if ('incoming' in effect.target && effect.target.incoming.fields) {
        out.target = {
          incoming: {
            ...effect.target.incoming,
            fields: effect.target.incoming.fields.map((r) => q.field(r, pack)),
          },
        };
      } else if ('steps' in effect.target) {
        q.tags(effect.target.steps, pack);
        if (effect.op === 'changes' && effect.value && typeof effect.value === 'object') {
          const v = effect.value as StepChanges;
          out.value = {
            ...v,
            changes: q.changes(v.changes ?? [], pack, v.to),
            ...q.to(v.to, pack),
          };
        }
      } else if ('choices' in effect.target) {
        q.tags(effect.target.choices, pack);
        if (effect.op === 'option' && effect.value && typeof effect.value === 'object') {
          const v = effect.value as OptionValue;
          out.value = {
            ...v,
            changes: q.changes(v.changes ?? [], pack, v.to),
            ...q.to(v.to, pack),
          };
        }
      }
      if (effect.op === 'grant' && effect.value && typeof effect.value === 'object') {
        const v = effect.value as GrantValue;
        out.value =
          v.item !== undefined
            ? { item: q.content(v.item, pack) }
            : v.field !== undefined
              ? { field: q.field(v.field, pack) }
              : v.query
                ? { query: q.query(v.query, pack) }
                : v;
      }
      return out;
    },
    /** A follow-up to a link names the linked character's action by qualified ID. */
    followUp(def: FollowUp, pack: string, own: ReadonlySet<string> = new Set()): FollowUp {
      const out: FollowUp = {
        ...def,
        ...(def.on ? { on: { ...def.on, field: q.field(def.on.field, pack) } } : {}),
        ...(def.changes ? { changes: q.changes(def.changes, pack, def.to) } : {}),
      };
      if (def.create) {
        // The start is resolved once every start is loaded (createOffers).
        if (
          def.while === undefined ||
          def.on !== undefined ||
          def.becomes !== undefined ||
          def.action !== undefined ||
          def.changes !== undefined ||
          def.to !== undefined
        )
          err('invalid-create-offer', { followUp: def.id, pack });
        const link = resolveLink(ruleset, def.create.link, pack);
        if (!link) unknown('link', def.create.link, pack);
        out.create = { ...def.create, link: link ?? def.create.link };
        createOffers.push({ def: out, pack });
      }
      if (typeof def.to === 'object') {
        out.to = q.to(def.to, pack).to as { link: string };
        if (def.action !== undefined && !def.action.includes(':'))
          unknown('action', def.action, pack);
      } else if (def.action !== undefined && !own.has(def.action)) {
        out.action = q.actionId(def.action, pack);
      }
      return out;
    },
    /** A slotted choice is one choice per slot, keyed `<id>-<slot>`. */
    choices(choices: Choice[], pack: string, owner: string): Choice[] {
      const seen = new Set<string>();
      for (const choice of choices) {
        const keys = choice.slots ? choice.slots.map((n) => `${choice.id}-${n}`) : [choice.id];
        for (const key of keys) {
          if (seen.has(key)) err('duplicate-id', { id: key, owner, pack });
          seen.add(key);
        }
      }
      return choices.map((c) => q.choice(c, pack));
    },
    choice(choice: Choice, pack: string): Choice {
      const from = choice.from;
      let qualified: Choice['from'] = from;
      if ('items' in from) qualified = { items: from.items.map((r) => q.content(r, pack)) };
      else if ('options' in from)
        qualified = { options: from.options.map((o) => q.option(o, pack)) };
      else if ('type' in from) qualified = q.query(from, pack);
      return {
        ...choice,
        from: qualified,
        ...(choice.effects
          ? {
              effects: choice.effects.map((e) => {
                q.copyless(e, pack);
                return q.effect(e, pack);
              }),
            }
          : {}),
      };
    },
    option(option: InlineOption, pack: string): InlineOption {
      return {
        ...option,
        ...(option.effects ? { effects: option.effects.map((e) => q.effect(e, pack)) } : {}),
        ...(option.grants ? { grants: option.grants.map((g) => q.grant(g, pack)) } : {}),
        ...(option.choices
          ? { choices: q.choices(option.choices, pack, `option ${option.id}`) }
          : {}),
      };
    },
    /** `target` in `to` needn't be declared; a handoff (`as: participant`) needs an `each`. */
    roles(step: Step, pack: string, roles: Record<string, Role>): void {
      const declared = (role: string) => Object.hasOwn(roles, role);
      if (step.each !== undefined && !declared(step.each))
        err('unknown-role', { role: step.each, step: step.id, pack });
      if (step.as === 'participant' && step.each === undefined)
        err('unknown-role', { step: step.id, pack });
      const destinations = [
        ...(step.kind === 'changes' ? [step.to] : []),
        ...(Array.isArray(step.options) ? step.options.map((o) => o.to) : []),
      ];
      for (const to of destinations)
        if (typeof to === 'string' && to !== 'self' && to !== 'target' && !declared(to))
          err('unknown-role', { role: to, step: step.id, pack });
      // An `each` branch step's case steps run per participant already.
      if (step.kind === 'branch' && step.each !== undefined) {
        const nested = (list: Step[]): void => {
          for (const inner of list) {
            if (inner.each !== undefined)
              err('unknown-role', { role: inner.each, step: inner.id, pack });
            for (const arm of stepArms(inner)) nested(arm.steps ?? []);
          }
        };
        for (const arm of stepArms(step)) nested(arm.steps ?? []);
      }
    },
    steps(steps: Step[], pack: string, roles: Record<string, Role> = {}): Step[] {
      for (const step of steps) q.roles(step, pack, roles);
      return steps.map((step) => ({
        ...step,
        ...(step.bands ? { bands: q.bands(step.bands, pack) } : {}),
        // With `source` or `entry`, a `use` no rules action has is the content's own action's
        // local ID.
        ...(step.use
          ? {
              use:
                (step.source !== undefined || step.entry !== undefined) && step.kind === 'action'
                  ? (resolveAction(ruleset, step.use, pack) ?? step.use)
                  : q.actionId(step.use, pack),
            }
          : {}),
        ...(step.options && !Array.isArray(step.options) && 'content' in step.options
          ? { options: { content: q.query(step.options.content, pack) } }
          : {}),
        ...(step.options && !Array.isArray(step.options) && 'copies' in step.options
          ? { options: { copies: q.query(step.options.copies, pack) } }
          : {}),
        ...(Array.isArray(step.options)
          ? {
              options: step.options.map((o) => ({
                ...o,
                ...(o.changes ? { changes: q.changes(o.changes, pack, o.to) } : {}),
                ...q.to(o.to, pack),
              })),
            }
          : {}),
        // Action steps' tags reach nested choice steps; changes steps' are aimed at by effects.
        ...(step.kind === 'choice' ||
        step.kind === 'allocate' ||
        step.kind === 'action' ||
        step.kind === 'changes'
          ? (q.tags(step.tags, pack), {})
          : {}),
        ...(step.kind === 'allocate' && step.recommend && typeof step.recommend === 'object'
          ? {
              recommend: Object.fromEntries(
                Object.entries(step.recommend).map(([field, by]) => [q.field(field, pack), by]),
              ),
            }
          : {}),
        ...(step.changes
          ? { changes: q.changes(step.changes, pack, step.kind === 'changes' ? step.to : 'self') }
          : {}),
        ...(step.kind === 'changes' ? q.to(step.to, pack) : {}),
        ...(step.cases
          ? {
              cases: step.cases.map((arm) => ({
                ...arm,
                ...(arm.steps ? { steps: q.steps(arm.steps, pack, roles) } : {}),
              })),
            }
          : {}),
        ...(step.else
          ? {
              else: {
                ...step.else,
                ...(step.else.steps ? { steps: q.steps(step.else.steps, pack, roles) } : {}),
              },
            }
          : {}),
        ...(step.kind === 'group' && step.steps ? { steps: q.steps(step.steps, pack, roles) } : {}),
      }));
    },
    /** `release` and a roll step's `of` name steps anywhere in the same action's tree. */
    releases(steps: Step[], pack: string): void {
      const all: Step[] = [];
      const walk = (list: Step[]) => {
        for (const step of list) {
          all.push(step);
          for (const arm of stepArms(step)) walk(arm.steps ?? []);
        }
      };
      walk(steps);
      const held = new Set(all.filter((s) => s.kind === 'action' && s.hold).map((s) => s.id));
      const ids = new Set(all.map((s) => s.id));
      for (const step of all) {
        for (const id of step.release?.steps ?? []) if (!held.has(id)) unknown('step', id, pack);
        const first = step.of?.split('/')[0]?.replace(/\[\d+\]$/, '');
        if (first !== undefined && !ids.has(first)) unknown('step', step.of as string, pack);
      }
    },
    results(results: ActionDef['results'], pack: string) {
      if (results === undefined) return undefined;
      return {
        results: Array.isArray(results) ? results : { bands: q.bands(results.bands, pack) },
      };
    },
    actionDef(def: ActionOrUse, pack: string): ActionOrUse {
      if ('use' in def) return { ...def, use: q.actionId(def.use, pack) };
      q.releases(def.steps, pack);
      return {
        ...def,
        params: q.decls(def.params, pack) ?? {},
        steps: q.steps(def.steps, pack, def.participants),
        ...q.results(def.results, pack),
      } as ActionDef;
    },
  };
  const qualifyActionDef = (def: ActionOrUse, pack: string) => q.actionDef(def, pack);

  /** Defined on the item, its type, and what it extends or overrides. */
  const itemActions = (raw: ContentItem, pack: string, depth = 0): Set<string> => {
    const own = ownActions(raw);
    const typeId = raw.type ? resolveType(ruleset, raw.type, pack) : undefined;
    const type = typeId ? ruleset.contentTypes[typeId] : undefined;
    for (const id of ownActions(type ?? {})) own.add(id);
    const parentRef = raw.extends ?? raw.override;
    const parentId = parentRef ? resolveContent(ruleset, parentRef, pack) : undefined;
    const parent = parentId ? ruleset.content[parentId] : undefined;
    if (parent && depth < MAX_EXTENDS) {
      const parentPack = (parentId as string).slice(0, (parentId as string).indexOf(':'));
      for (const id of itemActions(parent, parentPack, depth + 1)) own.add(id);
    }
    return own;
  };

  const qualifyItem = (raw: ContentItem, pack: string): ContentItem => {
    const out: ContentItem = { ...raw };
    if (raw.type) out.type = q.type(raw.type, pack);
    if (raw.grants) out.grants = raw.grants.map((g) => q.grant(g, pack));
    if (raw.immuneTo) out.immuneTo = raw.immuneTo.map((i) => q.immunity(i, pack));
    if (raw.choices) out.choices = q.choices(raw.choices, pack, raw.id ?? 'content');
    if (raw.effects) out.effects = raw.effects.map((e) => q.effect(e, pack));
    if (raw.followUps) {
      const own = itemActions(raw, pack);
      out.followUps = raw.followUps.map((fu) => q.followUp(fu, pack, own));
    }
    if (raw.actions) out.actions = raw.actions.map((a) => qualifyActionDef(a, pack));
    if (raw.appliesTo)
      out.appliesTo = Array.isArray(raw.appliesTo)
        ? raw.appliesTo.map((query) => q.query(query, pack))
        : q.query(raw.appliesTo, pack);
    if (raw.standardCopies) out.standardCopies = raw.standardCopies.map((s) => q.query(s, pack));
    if (raw.keepsTemplates)
      out.keepsTemplates = raw.keepsTemplates.map((k) => ({
        ...k,
        template: q.content(k.template, pack),
        ...(k.copies ? { copies: q.query(k.copies, pack) } : {}),
        ...(k.content ? { content: q.query(k.content, pack) } : {}),
      }));
    if (raw.state) out.state = q.decls(raw.state, pack) as Record<string, ValueDecl>;
    if (raw.params) out.params = q.decls(raw.params, pack) as Record<string, ValueDecl>;
    return out;
  };

  // 2b. Rules-level definitions with references. An item field's declared default is
  // qualified in the type's pack.
  const itemFieldDecls = (decls: Record<string, ValueDecl>, pack: string) =>
    Object.fromEntries(
      Object.entries(decls).map(([name, raw]) => {
        const decl = q.decl(raw, pack);
        if (decl.default === undefined) return [name, decl];
        return [name, { ...decl, default: q.members(decl, decl.default, pack) }];
      }),
    ) as Record<string, ValueDecl>;
  for (const [qid, def] of Object.entries(ruleset.contentTypes)) {
    ruleset.contentTypes[qid] = {
      ...def,
      ...(def.fields ? { fields: itemFieldDecls(def.fields, def.pack) } : {}),
      ...(def.state ? { state: q.decls(def.state, def.pack) as Record<string, ValueDecl> } : {}),
      ...(def.actions ? { actions: def.actions.map((a) => qualifyActionDef(a, def.pack)) } : {}),
      ...(def.effects ? { effects: def.effects.map((e) => q.effect(e, def.pack)) } : {}),
      ...(def.followUps
        ? { followUps: def.followUps.map((fu) => q.followUp(fu, def.pack, ownActions(def))) }
        : {}),
      ...(def.grants ? { grants: def.grants.map((g) => q.grant(g, def.pack)) } : {}),
    };
  }
  for (const [name, def] of Object.entries(ruleset.rules.templateFields)) {
    const { pack, ...decl } = def;
    ruleset.rules.templateFields[name] = {
      ...(itemFieldDecls({ [name]: decl }, pack)[name] as ValueDecl),
      pack,
    };
  }
  for (const [qid, def] of Object.entries(ruleset.fields)) {
    ruleset.fields[qid] = {
      ...(q.decl(def, def.pack) as typeof def),
      ...(def.absorbedBy ? { absorbedBy: def.absorbedBy.map((r) => q.field(r, def.pack)) } : {}),
      ...(def.nameFrom ? { nameFrom: q.field(def.nameFrom, def.pack) } : {}),
      ...(def.overflow
        ? { overflow: def.overflow.map((o) => ({ ...o, into: q.field(o.into, def.pack) })) }
        : {}),
    };
  }
  // A link slot's fields are checked against its pack only when that pack is loaded too.
  for (const [qid, link] of Object.entries(ruleset.rules.links)) {
    if (link.expects === undefined || !byId.has(link.expects)) continue;
    for (const [field, decl] of Object.entries(link.fields)) {
      const found = resolveField(ruleset, field, link.expects);
      if (!found || ruleset.fields[found]?.type !== decl.type)
        err('link-field-mismatch', { link: qid, field, pack: link.expects });
    }
  }
  for (const [qid, def] of Object.entries(ruleset.rules.actions)) {
    q.releases(def.steps, def.pack);
    ruleset.rules.actions[qid] = {
      ...def,
      params: q.decls(def.params, def.pack) ?? {},
      steps: q.steps(def.steps, def.pack, def.participants),
      ...q.results(def.results, def.pack),
    };
  }
  // Creation starts: a later start with the same ID replaces the earlier one in its place.
  for (const pack of byId.values()) {
    const pid = pack.manifest.id;
    for (const start of pack.rules.creation ?? []) {
      const action = q.actionId(start.action, pid);
      const def = ruleset.rules.actions[action];
      for (const [name, decl] of Object.entries(def?.params ?? {})) {
        if (decl.optional || decl.default !== undefined || start.params?.[name] !== undefined)
          continue;
        err('missing-param', { param: name, creation: start.id, pack: pid });
      }
      const loaded = {
        id: start.id,
        action,
        ...(start.params ? { params: start.params } : {}),
        random: start.random === true,
        pack: pid,
      };
      const index = ruleset.creation.findIndex((s) => s.id === start.id);
      if (index >= 0) ruleset.creation[index] = loaded;
      else ruleset.creation.push(loaded);
    }
  }
  for (const pack of byId.values()) {
    const pid = pack.manifest.id;
    const r = pack.rules;
    for (const def of r.situational ?? []) {
      ruleset.rules.situational[`${pid}:${def.id}`] = {
        ...def,
        pack: pid,
        ...(def.incoming?.fields
          ? {
              incoming: {
                ...def.incoming,
                fields: def.incoming.fields.map((ref) => q.field(ref, pid)),
              },
            }
          : {}),
        ...(def.effects
          ? {
              effects: def.effects.map((e) => {
                q.copyless(e, pid);
                return q.effect(e, pid);
              }),
            }
          : {}),
      };
    }
    (r.effects ?? []).forEach((def, index) => {
      q.copyless(def, pid);
      ruleset.rules.effects.push({ ...q.effect(def, pid), pack: pid, index });
    });
    for (const def of r.followUps ?? [])
      ruleset.rules.followUps.push({ ...q.followUp(def, pid), pack: pid });
    for (const def of r.immuneTo ?? [])
      ruleset.rules.immuneTo.push({ ...q.immunity(def, pid), pack: pid });
    for (const def of r.standardCopies ?? [])
      ruleset.rules.standardCopies.push({ ...q.query(def, pid), pack: pid });
    for (const def of q.choices(r.choices ?? [], pid, 'rules'))
      ruleset.rules.choices[`${pid}:${def.id}`] = { ...def, pack: pid };
    for (const def of r.constraints ?? [])
      ruleset.rules.constraints[`${pid}:${def.id}`] = {
        ...def,
        ...(def.copies ? { copies: { ...def.copies, type: q.type(def.copies.type, pid) } } : {}),
        pack: pid,
      };
    for (const group of r.display?.groups ?? []) {
      const members =
        group.members && group.kind !== 'actions' ? { members: q.query(group.members, pid) } : {};
      const index = ruleset.rules.display.groups.findIndex((g) => g.id === group.id);
      const entry = { ...group, ...members, pack: pid };
      if (index >= 0) ruleset.rules.display.groups[index] = entry;
      else ruleset.rules.display.groups.push(entry);
    }
    for (const [id, hints] of Object.entries(r.display?.fields ?? {})) {
      const format =
        typeof hints.format === 'object'
          ? { format: { bands: q.bands(hints.format.bands, pid) } }
          : {};
      const companions = hints.with
        ? { with: hints.with.map((c) => ({ ...c, field: q.field(c.field, pid) })) }
        : {};
      ruleset.rules.display.fields[q.field(id, pid)] = {
        ...hints,
        ...format,
        ...companions,
        pack: pid,
      };
    }
    for (const [type, hints] of Object.entries(r.display?.types ?? {}))
      ruleset.rules.display.types[type] = { ...hints, pack: pid };
  }
  for (const hints of Object.values(ruleset.rules.display.fields)) {
    if (!hints.rolls) continue;
    hints.rolls = hints.rolls.map((roll) => {
      const action = q.actionId(roll.action, hints.pack);
      const decls = ruleset.rules.actions[action]?.params ?? {};
      if (!roll.params) return { action };
      const params = Object.fromEntries(
        Object.entries(roll.params).map(([name, value]) => {
          const decl = decls[name];
          return [name, decl ? q.members(decl, value, hints.pack) : value];
        }),
      );
      return { action, params };
    });
  }

  // 3. Resolve content: own properties, then extends, then overrides in load order.
  const resolved = new Map<string, LoadedItem>();
  const resolving = new Set<string>();
  const resolveItem = (qid: string, depth = 0): LoadedItem | undefined => {
    const done = resolved.get(qid);
    if (done) return done;
    const raw = ruleset.content[qid];
    if (!raw) return undefined;
    const pack = qid.slice(0, qid.indexOf(':'));
    if (resolving.has(qid) || depth > MAX_EXTENDS) {
      err('circular-extends', { id: qid });
      return undefined;
    }
    resolving.add(qid);
    const own = qualifyItem(raw, pack);
    let item: ContentItem = own;
    if (raw.extends) {
      const parentId = q.content(raw.extends, pack);
      const parent = resolveItem(parentId, depth + 1);
      if (parent) {
        const { qid: _q, pack: _p, hidden: _h, scopes: _s, id: _i, ...inherited } = parent;
        item = merge(inherited, own);
      }
    }
    resolving.delete(qid);
    const loaded = {
      ...item,
      id: raw.id,
      qid,
      pack,
      type: (item.type as string) ?? '',
    } as LoadedItem;
    delete loaded.extends;
    resolved.set(qid, loaded);
    return loaded;
  };
  for (const qid of Object.keys(ruleset.content)) resolveItem(qid);

  const touched = new Map<string, string>(); // "<qid> <property>" → pack
  for (const pack of byId.values()) {
    const pid = pack.manifest.id;
    for (const raw of pack.content) {
      if (!raw.override) continue;
      const target = resolved.get(raw.override);
      if (!target) {
        unknown('content', raw.override, pid);
        continue;
      }
      const { override: _o, ...props } = qualifyItem(raw, pid);
      const scopes = { ...target.scopes };
      for (const key of Object.keys(props)) {
        const at = `${target.qid} ${key}`;
        const previous = touched.get(at);
        if (previous)
          ruleset.conflicts.push({ target: target.qid, property: key, packs: [previous, pid] });
        touched.set(at, pid);
        scopes[key] = pid;
      }
      resolved.set(target.qid, { ...(merge(target, props) as LoadedItem), scopes });
    }
    for (const hidden of pack.manifest.hides ?? []) {
      const target = resolved.get(hidden);
      if (target) resolved.set(hidden, { ...target, hidden: true });
      else unknown('content', hidden, pid);
    }
  }
  // Options packs add to their dependencies' choices, after every override, in load order.
  for (const pack of byId.values()) {
    const pid = pack.manifest.id;
    for (const [target, choices] of Object.entries(pack.rules.extendChoices ?? {})) {
      const bad = (message: string) => err('invalid-extension', { pack: pid, target, message });
      const owner = target.slice(0, target.indexOf(':'));
      if (owner === pid || !scopeOf(pid).includes(owner)) {
        bad(`${owner} is not a dependency of ${pid}`);
        continue;
      }
      const rulesLevel = target === `${owner}:rules`;
      const item = rulesLevel ? undefined : resolved.get(target);
      if (!rulesLevel && !item) {
        unknown('content', target, pid);
        continue;
      }
      const roots: Choice[] = rulesLevel
        ? Object.values(ruleset.rules.choices)
            .filter((c) => c.pack === owner)
            .map((c) => structuredClone(c))
        : structuredClone(item?.choices ?? []);
      for (const [path, addition] of Object.entries(choices)) {
        const parts = path.split('/');
        let choice = roots.find((c) => c.id === parts[0]);
        let keyRoot = target;
        for (let at = 1; choice && at < parts.length; at += 2) {
          const from = choice.from;
          const option =
            'options' in from ? from.options.find((o) => o.id === parts[at]) : undefined;
          keyRoot = `${keyRoot}.choices.${choice.id}.options.${parts[at]}`;
          choice = option?.choices?.find((c) => c.id === parts[at + 1]);
        }
        if (!choice) {
          bad(`no choice "${path}"`);
          continue;
        }
        const origins = (ruleset.optionOrigins[`${keyRoot}/${choice.id}`] ??= {});
        const from = choice.from;
        if ('items' in addition && 'items' in from) {
          for (const ref of addition.items) {
            const qid = q.content(ref, pid);
            if (!from.items.includes(qid)) from.items.push(qid);
          }
        } else if ('values' in addition && 'values' in from && Array.isArray(from.values)) {
          for (const value of addition.values) {
            if (from.values.includes(value)) continue;
            from.values.push(value);
            origins[String(value)] = pid;
          }
        } else if ('options' in addition && 'options' in from) {
          for (const option of addition.options) {
            if (from.options.some((o) => o.id === option.id)) {
              err('duplicate-id', { id: option.id, owner: `${target}/${path}`, pack: pid });
              continue;
            }
            from.options.push({ ...q.option(option, pid), pack: pid });
            origins[option.id] = pid;
          }
        } else {
          bad(`"${path}" doesn't take ${Object.keys(addition)[0]}`);
        }
      }
      if (item) resolved.set(target, { ...item, choices: roots });
      else for (const c of roots) ruleset.rules.choices[`${owner}:${c.id}`] = c as never;
    }
  }
  // Item fields against their content type: the item's own values, then the required ones on the
  // merged item.
  [...byId.values()].forEach((pack, i) => {
    pack.content.forEach((raw, j) => {
      const qid =
        raw.override ?? (raw.id === undefined ? undefined : `${pack.manifest.id}:${raw.id}`);
      const item = qid ? resolved.get(qid) : undefined;
      const type = item ? ruleset.contentTypes[item.type] : undefined;
      if (!item || !type) return;
      const decls = type.fields ?? {};
      const bad = (field: string, reason: string) =>
        err(
          'invalid-item-field',
          { item: item.qid, field, reason, pack: pack.manifest.id },
          `/packs/${i}/content/${j}/fields/${field}`,
        );
      for (const [name, value] of Object.entries(raw.fields ?? {})) {
        const decl = decls[name];
        if (!decl) bad(name, 'undeclared');
        else if (!fitsItemField(value, decl)) bad(name, 'wrong-type');
      }
      if (raw.override) return;
      for (const [name, decl] of Object.entries(decls))
        if (decl.required && item.fields?.[name] === undefined) bad(name, 'missing');
    });
  });
  for (const [qid, item] of resolved) {
    if (!item.fields) continue;
    const decls = itemFieldDeclsOf(ruleset, item);
    const fields = { ...item.fields };
    const scope = item.scopes?.fields ?? item.pack;
    for (const [name, decl] of Object.entries(decls)) {
      const value = fields[name];
      if (
        value !== undefined &&
        value !== null &&
        (typeof value !== 'object' || Array.isArray(value))
      )
        fields[name] = q.members(decl, value, scope);
    }
    resolved.set(qid, { ...item, fields });
  }
  // Content order: the load order, then each pack's content order.
  ruleset.content = Object.fromEntries(
    Object.keys(ruleset.content).map((qid) => [qid, resolved.get(qid) as LoadedItem]),
  );

  // The start by its ID, or `<pack>:<id>`; from the slot's pack or a dependency of it, when that
  // pack is loaded too.
  for (const { def, pack } of createOffers) {
    const create = def.create;
    if (!create) continue;
    const colon = create.start.indexOf(':');
    const id = colon < 0 ? create.start : create.start.slice(colon + 1);
    const start = ruleset.creation.find(
      (s) => s.id === id && (colon < 0 || s.pack === create.start.slice(0, colon)),
    );
    if (!start) {
      unknown('creation', create.start, pack);
      continue;
    }
    create.start = `${start.pack}:${start.id}`;
    const expects = ruleset.rules.links[create.link]?.expects;
    if (expects !== undefined && byId.has(expects) && !scopeOf(expects).includes(start.pack))
      err('link-start-mismatch', { link: create.link, start: create.start, pack: expects });
  }

  // 4. Resolve content-only queries.
  const queries: { query: Query; pack: string }[] = [];
  const collectChoices = (choices: Choice[] | undefined, pack: string) => {
    for (const choice of choices ?? []) {
      if ('type' in choice.from) queries.push({ query: choice.from, pack });
      if ('options' in choice.from)
        for (const o of choice.from.options) collectChoices(o.choices, pack);
      collectEffects(choice.effects, pack);
    }
  };
  const collectEffects = (effects: Effect[] | undefined, pack: string) => {
    for (const e of effects ?? []) {
      const v = e.value as GrantValue | undefined;
      if (e.op === 'grant' && v?.query) queries.push({ query: v.query, pack });
    }
  };
  for (const item of Object.values(ruleset.content)) {
    const pack = item.pack;
    collectChoices(item.choices, item.scopes?.choices ?? pack);
    collectEffects(item.effects, item.scopes?.effects ?? pack);
    for (const query of appliesQueries(item))
      queries.push({ query, pack: item.scopes?.appliesTo ?? pack });
    for (const query of item.standardCopies ?? [])
      queries.push({ query, pack: item.scopes?.standardCopies ?? pack });
    for (const kept of item.keepsTemplates ?? [])
      queries.push({ query: keptQuery(kept), pack: item.scopes?.keepsTemplates ?? pack });
  }
  for (const { pack, ...query } of ruleset.rules.standardCopies) queries.push({ query, pack });
  for (const choice of Object.values(ruleset.rules.choices)) collectChoices([choice], choice.pack);
  collectEffects(ruleset.rules.effects, '');
  for (const e of ruleset.rules.effects) collectEffects([e], e.pack);
  for (const g of ruleset.rules.display.groups)
    if (g.members && g.kind !== 'actions') queries.push({ query: g.members, pack: g.pack });

  // Each condition is parsed once, and each item's view built once for every query.
  const visibleByType = new Map<string, LoadedItem[]>();
  for (const item of Object.values(ruleset.content)) {
    if (item.hidden) continue;
    const list = visibleByType.get(item.type);
    if (list) list.push(item);
    else visibleByType.set(item.type, [item]);
  }
  const views = new Map<LoadedItem, Record<string, unknown>>();
  const viewOf = (item: LoadedItem) => {
    let view = views.get(item);
    if (!view) views.set(item, (view = itemView(ruleset, item, [], () => undefined)));
    return view;
  };
  for (const { query, pack } of queries) {
    if (query.type === 'field' || !isContentOnly(query.where)) continue;
    const key = queryKey(pack, query.type, query.where);
    if (key in ruleset.queries) continue;
    const candidates = visibleByType.get(query.type) ?? [];
    const tree = query.where === undefined ? undefined : conditionTree(query.where);
    const ids = new Map<string, string | undefined>();
    const id = (text: string) => {
      if (!ids.has(text)) ids.set(text, resolveId(ruleset, text, pack));
      return ids.get(text);
    };
    const matches: string[] = [];
    for (const item of candidates)
      if (tree === undefined || (tree.ok && matchesQuery(viewOf(item), tree.value, id)))
        matches.push(item.qid);
    ruleset.queries[key] = matches;
  }
  const derived = new Map<string, string>();
  const standard = new Set(rulesStandard(ruleset));
  for (const item of Object.values(ruleset.content))
    for (const qid of itemStandard(ruleset, item)) standard.add(qid);
  for (const qid of standard) {
    const id = standardId(qid);
    const other = derived.get(id);
    if (other !== undefined && other !== qid) err('duplicate-id', { id, items: [other, qid] });
    else derived.set(id, qid);
  }
  for (const item of Object.values(ruleset.content))
    for (const kept of item.keepsTemplates ?? []) {
      const template = ruleset.content[kept.template];
      if (template && template.type !== 'template')
        err('unknown-reference', { kind: 'template', id: kept.template, pack: item.pack });
      // Content without a copy takes a template's fields and tags only.
      else if (template && kept.content) {
        const extra = COPY_ONLY.filter((key) => {
          const v = (template as unknown as Record<string, unknown>)[key];
          return v !== undefined && !(Array.isArray(v) && v.length === 0);
        });
        if (extra.length > 0)
          err('template-without-copy', {
            item: item.qid,
            template: template.qid,
            keys: extra,
            pack: item.pack,
          });
      }
    }
  for (const item of Object.values(ruleset.content)) {
    const type = ruleset.contentTypes[item.type];
    const reapply = item.reapply ?? type?.reapply;
    if (!reapply) continue;
    const state = { ...type?.state, ...item.state };
    for (const key of [...(reapply.match ?? []), ...Object.keys(reapply.state)]) {
      const decl = state[key];
      if (!decl) err('unknown-state-key', { item: item.qid, key });
      else if (reapply.state[key] === 'add' && !['integer', 'decimal'].includes(decl.type))
        err('wrong-type', { item: item.qid, target: key, expected: 'integer or decimal' });
    }
  }

  // A grant's preset picks name choices the granted content declares (slot keys for a slotted
  // choice), and literal options it offers; nested presets those of the literal option.
  const presetChoices = (
    tree: PresetTree,
    choices: readonly Choice[] | undefined,
    pack: string,
    at: Record<string, unknown>,
  ): void => {
    const byKey = new Map<string, Choice>();
    for (const choice of choices ?? [])
      for (const key of choice.slots?.map((n) => `${choice.id}-${n}`) ?? [choice.id])
        byKey.set(key, choice);
    for (const [key, picks] of Object.entries(tree)) {
      const choice = byKey.get(key);
      if (!choice) {
        err('unknown-reference', { kind: 'choice', id: key, ...at });
        continue;
      }
      for (const pick of picks) {
        if (typeof pick.option === 'object') continue;
        const from = choice.from;
        let nested: readonly Choice[] | undefined;
        if ('options' in from) {
          const inline = from.options.find((o) => o.id === pick.option);
          if (!inline) err('unknown-reference', { kind: 'option', id: pick.option, ...at });
          nested = inline?.choices;
        } else if ('values' in from) {
          if (Array.isArray(from.values) && !from.values.includes(pick.option))
            err('unknown-reference', { kind: 'option', id: pick.option, ...at });
        } else {
          const qid = resolveContent(ruleset, String(pick.option), pack);
          if (!qid) err('unknown-reference', { kind: 'content', id: pick.option, ...at });
          nested = qid ? ruleset.content[qid]?.choices : undefined;
        }
        if (pick.choices) presetChoices(pick.choices, nested, pack, at);
      }
    }
  };
  const grantChecks = (grants: readonly Grant[] | undefined, owner: string, pack: string) => {
    for (const grant of grants ?? []) {
      if (grant.choices && grant.scope === 'applied')
        err('unknown-reference', {
          kind: 'choice',
          id: Object.keys(grant.choices).join(', '),
          item: owner,
          scope: 'applied',
        });
      if (typeof grant.item !== 'string') continue;
      const granted = ruleset.content[grant.item];
      if (!granted) continue;
      if (grant.choices && grant.scope !== 'applied')
        presetChoices(grant.choices, granted.choices, pack, { item: owner, granted: granted.qid });
      if (!grant.state) continue;
      const declared = { ...ruleset.contentTypes[granted.type]?.state, ...granted.state };
      for (const key of Object.keys(grant.state))
        if (!declared[key]) err('unknown-state-key', { item: owner, granted: granted.qid, key });
    }
  };
  const optionGrants = (choices: readonly Choice[] | undefined, owner: string, pack: string) => {
    for (const choice of choices ?? []) {
      if (!('options' in choice.from)) continue;
      for (const option of choice.from.options) {
        grantChecks(option.grants, owner, pack);
        optionGrants(option.choices, owner, pack);
      }
    }
  };
  for (const item of Object.values(ruleset.content)) {
    grantChecks(item.grants, item.qid, item.scopes?.grants ?? item.pack);
    optionGrants(item.choices, item.qid, item.scopes?.choices ?? item.pack);
  }
  for (const [name, type] of Object.entries(ruleset.contentTypes))
    grantChecks(type.grants, name, type.pack);
  for (const choice of Object.values(ruleset.rules.choices))
    optionGrants([choice as Choice], `${choice.pack}:rules`, choice.pack);

  // Qualified once every pack's situational choices are loaded.
  const situationalId = (ref: string, pack: string): string | undefined => {
    const all = ruleset.rules.situational;
    if (ref.includes(':')) return Object.hasOwn(all, ref) ? ref : undefined;
    const scope = ruleset.packs.find((p) => p.id === pack)?.scope ?? [pack];
    return scope.map((pid) => `${pid}:${ref}`).find((qid) => Object.hasOwn(all, qid));
  };
  const situationalSteps = (steps: Step[], pack: string): void => {
    for (const step of steps) {
      if (step.situational !== undefined)
        step.situational = Object.fromEntries(
          Object.entries(step.situational).map(([ref, formula]) => [
            situationalId(ref, pack) ?? (unknown('situational', ref, pack), ref),
            formula,
          ]),
        );
      for (const arm of stepArms(step)) situationalSteps(arm.steps ?? [], pack);
    }
  };
  const situationalActions = (list: ActionOrUse[] | undefined, pack: string): void => {
    for (const def of list ?? []) if (!('use' in def)) situationalSteps(def.steps, pack);
  };
  for (const def of Object.values(ruleset.rules.actions)) situationalSteps(def.steps, def.pack);
  for (const def of Object.values(ruleset.contentTypes)) situationalActions(def.actions, def.pack);
  for (const item of Object.values(ruleset.content)) situationalActions(item.actions, item.pack);

  // 5. Check formulas: each must parse and type-check where it appears, as in the build.
  if (errors.length === 0) {
    const set = new PackSet(
      packs
        .map((given) => byId.get(given.manifest.id) ?? given)
        .map((pack, i) => ({
          manifest: pack.manifest,
          at: `/packs/${i}`,
          rules: [{ doc: pack.rules, at: `/packs/${i}/rules` }],
          content: pack.content.map((doc, j) => ({ doc, at: `/packs/${i}/content/${j}` })),
        })),
    );
    for (const id of byId.keys()) {
      if (options.checkFormulasOf && !options.checkFormulasOf.has(id)) continue;
      const onFormula = options.onFormula;
      const check = onFormula ? { onFormula: (text: string) => onFormula(id, text) } : {};
      for (const problem of checkPackFormulas(set, id, check)) {
        err(
          'formula-error',
          { pack: id, formula: problem.formula, cause: problem.code, where: problem.where },
          problem.at,
        );
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, ruleset };
}

function sameValueType(a: ValueDecl, b: ValueDecl): boolean {
  return (
    a.type === b.type &&
    a.of === b.of &&
    JSON.stringify(a.values ?? null) === JSON.stringify(b.values ?? null)
  );
}

const ITEM_ONLY = new Set(['item']);
const CHARACTER_FUNCTIONS = new Set([
  'countCopies',
  'sumCopies',
  'maxCopies',
  'minCopies',
  'countPicks',
  'countGrants',
  'countFields',
  'sumFields',
  'maxFields',
  'minFields',
  'countEquipped',
  'countState',
  'sumState',
  'picksOf',
  'grantedPicksOf',
  'itemField',
  'itemTags',
]);

/** Whether a query condition reads only `item`, so it can be resolved at load time. */
export function isContentOnly(where: f.Node | string | number | boolean | undefined): boolean {
  return readsOnlyRoots(where, ITEM_ONLY);
}

/** Whether a condition reads only the given roots and calls no character function. */
export function readsOnlyRoots(
  where: f.Node | string | number | boolean | undefined,
  roots: ReadonlySet<string>,
): boolean {
  if (where === undefined || typeof where === 'number' || typeof where === 'boolean') return true;
  const tree =
    typeof where === 'string' ? f.parseCached(where) : { ok: true as const, value: where };
  if (!tree.ok) return false;
  if (f.references(tree.value, roots).size > 0) return false;
  return !callsCharacter(tree.value);
}

function callsCharacter(n: f.Node): boolean {
  return (n.type === 'call' && CHARACTER_FUNCTIONS.has(n.fn)) || childrenOf(n).some(callsCharacter);
}

function childrenOf(n: f.Node): f.Node[] {
  switch (n.type) {
    case 'list':
      return n.items;
    case 'member':
      return [n.object];
    case 'index':
      return [n.object, n.index];
    case 'call':
      return n.args;
    case 'unary':
      return [n.operand];
    case 'binary':
      return [n.left, n.right];
    case 'conditional':
      return [n.test, n.then, n.else];
    case 'dice':
      return typeof n.count === 'number' ? [] : [n.count];
    default:
      return [];
  }
}

function conditionTree(where: string | number | boolean): ReturnType<typeof f.parse> {
  return typeof where === 'string'
    ? f.parseCached(where)
    : { ok: true, value: { type: 'bool', value: Boolean(where) } as f.Node };
}

function matchesQuery(
  view: Record<string, unknown>,
  tree: f.Node,
  id: (text: string) => string | undefined,
): boolean {
  const result = f.evaluate(tree, { field: () => undefined, roots: { item: view }, id });
  return result.ok && result.value.kind === 'bool' && result.value.value;
}

export type { FormulaError };

/**
 * A dependent pack's values for an open enum, after the enum's own, in load order, each once:
 * `<pack>:fields.<field>`, `<pack>:types.<type>.fields.<field>` or `<pack>:types.<type>.state.<key>`.
 */
function extendEnums(
  ruleset: Ruleset,
  packs: Iterable<PackRelease>,
  scopeOf: (id: string) => string[],
  err: (code: string, data: Record<string, unknown>) => void,
): void {
  for (const pack of packs) {
    const pid = pack.manifest.id;
    for (const [target, values] of Object.entries(pack.rules.extendEnums ?? {})) {
      const bad = (message: string) => err('invalid-extension', { pack: pid, target, message });
      const colon = target.indexOf(':');
      const owner = target.slice(0, colon);
      const address = target.slice(colon + 1);
      if (owner === pid || !scopeOf(pid).includes(owner)) {
        bad(`${owner} is not a dependency of ${pid}`);
        continue;
      }
      const field = /^fields\.(.+)$/.exec(address);
      const typed = /^types\.([^.]+)\.(fields|state)\.([^.]+)$/.exec(address);
      let decl: ValueDecl | undefined;
      let replace: ((next: ValueDecl) => void) | undefined;
      if (field) {
        const qid = `${owner}:${field[1]}`;
        decl = ruleset.fields[qid];
        replace = (next) => (ruleset.fields[qid] = { ...ruleset.fields[qid]!, ...next });
      } else if (typed) {
        const [, name, of, key] = typed as unknown as [string, string, 'fields' | 'state', string];
        const qid = `${owner}:${name}`;
        const type = ruleset.contentTypes[qid];
        decl = type?.[of]?.[key];
        replace = (next) => {
          const def = ruleset.contentTypes[qid]!;
          ruleset.contentTypes[qid] = { ...def, [of]: { ...def[of], [key]: next } };
        };
      }
      if (!decl || !replace || decl.type !== 'enum') {
        bad(`${address} is not an enum of ${owner}`);
        continue;
      }
      if (decl.open !== true) {
        bad(`${address} is not open`);
        continue;
      }
      const merged = [...(decl.values ?? [])];
      for (const value of values) {
        if (merged.includes(value)) continue;
        merged.push(value);
        (ruleset.enumOrigins[target] ??= {})[value] = pid;
      }
      replace({ ...decl, values: merged });
    }
  }
}

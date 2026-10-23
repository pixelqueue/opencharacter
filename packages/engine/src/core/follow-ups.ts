import type { Change, ListedFollowUp, OfferFollowUp, StoredFollowUp } from '@opencharacter/spec';
import * as f from '../formula/index.ts';
import type {
  ActionOrUse,
  CharacterDoc,
  FollowUp,
  Formula,
  ProposedChange,
  ProposedEntry,
  TagOrFormula,
} from './pack-types.ts';
import { evaluateTags, localPart, resolveContent, resolveField, type Ruleset } from './ruleset.ts';
import { type Activation, Failure, type Links, Sheet, type Source } from './sheet.ts';
import { outputData } from './views.ts';

// Derived offers (`while`) are computed from the character; ephemeral ones (`on`, `becomes`) are
// stored in its file until acted on or dismissed.

/** An offer, as computeSheet's `offers` and applyChanges' `followUps` list it. */
export type { ListedFollowUp, StoredFollowUp };

export interface FieldEntry {
  field: string;
  by: number;
  requested?: number;
  taken?: number;
  reason: 'requested' | 'absorbed' | 'overflow' | 'reset' | 'carry';
  clamped?: true;
}

const MAX_FOLLOW_UPS = 100;

interface Declared {
  def: FollowUp;
  pack: string;
  id: string;
  roots: Record<string, unknown>;
  activation?: Activation;
  sheet: Sheet;
  /** Matches the same declaration on the character before the batch (for `becomes`). */
  key: string;
  offerId: string;
}

interface Resolved {
  to: 'self' | { link: string };
  character?: string;
  action?: NonNullable<ListedFollowUp['action']>;
  params?: Record<string, unknown>;
  changes?: Change[];
  create?: NonNullable<ListedFollowUp['create']>;
}

type Cause = NonNullable<StoredFollowUp['cause']>;

/** Thrown when one batch stores more follow-ups than `maxFollowUps`. */
export class TooManyFollowUps extends Error {}

/** Thrown when a change or a run names a follow-up the character doesn't have. */
export class UnknownFollowUp extends Error {}

/**
 * Stores the ephemeral follow-ups a batch triggered into `next` and returns them as offers. An
 * `on` follow-up fires once per matching adjustment (with `once`, once on their sum).
 */
export function storeFollowUps(
  ruleset: Ruleset,
  before: CharacterDoc,
  after: Sheet,
  next: CharacterDoc,
  entries: readonly unknown[],
  tags: WeakMap<object, string[]>,
  links: Links,
  offeredBy: readonly OfferFollowUp[] = [],
): ListedFollowUp[] {
  const declared = declarations(ruleset, after);
  // A stored `becomes` follow-up ends with its condition, before any is stored again.
  if (next.followUps) {
    next.followUps = live(ruleset, after, declared, next.followUps);
    if (next.followUps.length === 0) delete next.followUps;
  }
  if (declared.length === 0) return [];
  // A `becomes` follow-up isn't stored again while a copy from its declaration is.
  const kept = new Set((next.followUps ?? []).map(entryKey));
  let previous: Map<string, Declared> | undefined;
  const beforeOf = (key: string): Declared | undefined => {
    previous ??= new Map(
      declarations(ruleset, new Sheet(ruleset, before, [], links)).map((d) => [d.key, d]),
    );
    return previous.get(key);
  };
  const fired: { d: Declared; resolved: Resolved; cause?: Cause }[] = [];
  let copies = 0;
  const spend = (n: number) => {
    copies += n;
    if (fired.length + copies > MAX_FOLLOW_UPS) throw new TooManyFollowUps();
  };
  const push = (d: Declared, resolved: Resolved | undefined, cause?: Cause) => {
    if (!resolved) return;
    if (d.def.becomes !== undefined) {
      const key = entryKey({ followUp: d.id, source: d.activation?.source as Source });
      if (kept.has(key)) return;
      kept.add(key);
    }
    fired.push({ d, resolved, ...(cause ? { cause } : {}) });
    if (fired.length + copies > MAX_FOLLOW_UPS) throw new TooManyFollowUps();
  };
  // `offerFollowUp` changes come first, checked as triggered ones, their parameters over the
  // declaration's.
  for (const offer of offeredBy) {
    const d = declarationOf(declared, offer);
    if (!d || d.def.while !== undefined) continue;
    // A `becomes` one lasts only while its condition holds.
    if (d.def.becomes !== undefined && !holds(after, d.def.becomes, d.pack, d.roots)) continue;
    const resolved = resolve(ruleset, after, d, d.roots, spend, true);
    if (resolved?.action && offer.params) resolved.params = { ...resolved.params, ...offer.params };
    push(d, resolved);
  }
  for (const d of declared) {
    const { def } = d;
    if (def.on) {
      const { field, tags: wanted } = def.on;
      const matched: { entry: Partial<FieldEntry>; own: string[] }[] = [];
      for (const raw of entries) {
        const entry = raw as Partial<FieldEntry>;
        if (entry.field !== field) continue;
        const own = tags.get(raw as object) ?? [];
        if (wanted && !wanted.some((w) => own.some((t) => t === w || t.startsWith(`${w}.`))))
          continue;
        matched.push({ entry, own });
      }
      const first = matched[0];
      const causes: Cause[] = [];
      if (def.on.once && first) {
        const sum = (key: 'by' | 'requested' | 'taken') =>
          matched.reduce((n, m) => n + (m.entry[key] ?? 0), 0);
        causes.push({
          field,
          by: sum('by'),
          requested: sum('requested'),
          taken: sum('taken'),
          reason: first.entry.reason ?? 'requested',
          clamped: matched.some((m) => m.entry.clamped === true),
          tags: [...new Set(matched.flatMap((m) => m.own))],
        });
      } else if (!def.on.once) {
        for (const { entry, own } of matched)
          causes.push({
            field,
            by: entry.by ?? 0,
            requested: entry.requested ?? 0,
            taken: entry.taken ?? 0,
            reason: entry.reason ?? 'requested',
            clamped: entry.clamped ?? false,
            tags: [...own],
          });
      }
      for (const cause of causes) {
        const roots = { ...d.roots, change: changeRoot(cause) };
        push(d, resolve(ruleset, after, d, roots, spend, true), cause);
      }
    } else if (def.becomes !== undefined) {
      if (!holds(after, def.becomes, d.pack, d.roots)) continue;
      const was = beforeOf(d.key);
      if (was && holds(was.sheet, def.becomes, was.pack, was.roots)) continue;
      push(d, resolve(ruleset, after, d, d.roots, spend, true));
    }
  }
  if (fired.length === 0) return [];
  const stored = (next.followUps ??= []);
  const used = new Set(stored.map((s) => s.id));
  const out: ListedFollowUp[] = [];
  for (const { d, resolved, cause } of fired) {
    let n = 1;
    while (used.has(`${d.def.id}-${n}`)) n++;
    const id = `${d.def.id}-${n}`;
    used.add(id);
    const entry: StoredFollowUp = {
      id,
      followUp: d.id,
      ...(d.activation ? { source: d.activation.source as Source } : {}),
      ...(typeof resolved.to === 'object' ? { to: resolved.to } : {}),
      ...(resolved.character !== undefined ? { character: resolved.character } : {}),
      ...(resolved.params ? { params: resolved.params } : {}),
      ...(cause ? { cause } : {}),
    };
    stored.push(entry);
    out.push(ephemeral(ruleset, after, entry, d));
  }
  return out;
}

/** Stored ephemeral follow-ups in file order, then the derived offers whose condition holds. */
export function offers(ruleset: Ruleset, sheet: Sheet): ListedFollowUp[] {
  const declared = declarations(ruleset, sheet);
  const out: ListedFollowUp[] = live(ruleset, sheet, declared).map((entry) =>
    ephemeral(ruleset, sheet, entry, declarationOf(declared, entry)),
  );
  const seen = new Set<string>();
  for (const d of declared) {
    if (d.def.while === undefined || seen.has(d.offerId)) continue;
    // A linked character to make is offered only while its slot is empty.
    if (d.def.create && sheet.linkedId(d.def.create.link) !== undefined) continue;
    if (!holds(sheet, d.def.while, d.pack, d.roots)) continue;
    let resolved: Resolved | undefined;
    try {
      resolved = resolve(ruleset, sheet, d, d.roots, () => {}, true);
    } catch (error) {
      if (!(error instanceof TooManyFollowUps)) throw error;
    }
    if (!resolved) continue;
    seen.add(d.offerId);
    out.push(listing(d.offerId, 'derived', d, resolved));
  }
  return out;
}

/** Whether the character is offered `id` now (startAction's `action.followUp`). */
export function offered(
  ruleset: Ruleset,
  sheet: Sheet,
  id: string,
): 'derived' | 'ephemeral' | undefined {
  if (live(ruleset, sheet, declarations(ruleset, sheet)).some((e) => e.id === id))
    return 'ephemeral';
  // An offer to make a linked character runs on the new character, not here.
  return offers(ruleset, sheet).some((o) => o.kind === 'derived' && o.id === id && !o.create)
    ? 'derived'
    : undefined;
}

function ephemeral(
  ruleset: Ruleset,
  sheet: Sheet,
  entry: StoredFollowUp,
  d: Declared | undefined,
): ListedFollowUp {
  const to = entry.to ?? 'self';
  const resolved: Resolved = {
    to,
    ...(entry.character !== undefined ? { character: entry.character } : {}),
  };
  const def = d?.def;
  if (def?.action !== undefined) {
    const action =
      typeof to === 'object'
        ? { id: def.action }
        : startable(ruleset, sheet, def.action, d?.activation, false);
    if (action) resolved.action = action;
    resolved.params = entry.params ?? {};
  } else if (d && def?.changes) {
    const roots = entry.cause ? { ...d.roots, change: changeRoot(entry.cause) } : d.roots;
    try {
      resolved.changes = resolve(ruleset, sheet, d, roots, () => {}, false)?.changes ?? [];
    } catch (error) {
      if (!(error instanceof TooManyFollowUps)) throw error;
      resolved.changes = [];
    }
  }
  const out = listing(entry.id, 'ephemeral', d, resolved, entry);
  if (entry.cause) out.cause = entry.cause;
  return out;
}

function listing(
  id: string,
  kind: 'derived' | 'ephemeral',
  d: Declared | undefined,
  resolved: Resolved,
  entry?: StoredFollowUp,
): ListedFollowUp {
  const own = resolved.to === 'self';
  const source = d?.activation ? (d.activation.source as Source) : entry?.source;
  const out: ListedFollowUp = {
    id,
    kind,
    followUp: d?.id ?? entry?.followUp ?? id,
    ...(source ? { source } : {}),
    to: resolved.to,
    ...(resolved.character !== undefined ? { character: resolved.character } : {}),
    required: d?.def.required ?? false,
  };
  if (resolved.action) {
    out.action = own ? { ...resolved.action, followUp: id } : resolved.action;
    out.params = resolved.params ?? {};
  }
  if (resolved.create) out.create = resolved.create;
  if (resolved.changes) {
    out.changes =
      own && kind === 'ephemeral'
        ? [...resolved.changes, { type: 'clearFollowUp', id } as unknown as Change]
        : resolved.changes;
  }
  return out;
}

/** `<pack>:<id>` among the rules', `<content>#<id>` on an item, `<pack>:<type>#<id>` on a type. */
export function declaresFollowUp(ruleset: Ruleset, id: string): boolean {
  return declaredDef(ruleset, id) !== undefined;
}

function declaredDef(ruleset: Ruleset, id: string): FollowUp | undefined {
  const hash = id.lastIndexOf('#');
  if (hash < 0) return ruleset.rules.followUps.find((fu) => `${fu.pack}:${fu.id}` === id);
  const owner = id.slice(0, hash);
  const own = id.slice(hash + 1);
  const item = ruleset.content[owner];
  const type = item
    ? undefined
    : Object.values(ruleset.contentTypes).find((t) => `${t.pack}:${t.name}` === owner);
  return (item?.followUps ?? type?.followUps ?? []).find((fu) => fu.id === own);
}

/**
 * A stored `becomes` follow-up is dropped once its condition fails, its content is gone, or an
 * earlier entry has the same declaration. `when` only gates the moment it fires.
 */
function live(
  ruleset: Ruleset,
  sheet: Sheet,
  declared: Declared[],
  entries: readonly StoredFollowUp[] = sheet.character.followUps ?? [],
): StoredFollowUp[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const d = declarationOf(declared, entry);
    if (!d) return declaredDef(ruleset, entry.followUp)?.becomes === undefined;
    if (d.def.becomes === undefined) return true;
    const key = entryKey(entry);
    if (seen.has(key) || !holds(sheet, d.def.becomes, d.pack, d.roots)) return false;
    seen.add(key);
    return true;
  });
}

function entryKey(entry: Pick<StoredFollowUp, 'followUp' | 'source'>): string {
  return JSON.stringify([entry.followUp, sorted(entry.source ?? null)]);
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .toSorted()
        .map((k) => [k, sorted((value as Record<string, unknown>)[k])]),
    );
  return value;
}

function declarationOf(
  declared: Declared[],
  entry: Pick<StoredFollowUp, 'followUp' | 'source'>,
): Declared | undefined {
  const key = entryKey(entry);
  return declared.find(
    (d) => entryKey({ followUp: d.id, source: d.activation?.source as Source }) === key,
  );
}

function changeRoot(cause: Cause): Record<string, unknown> {
  return {
    by: numberRoot(cause.by),
    requested: numberRoot(cause.requested),
    taken: numberRoot(cause.taken),
    reason: cause.reason,
    clamped: cause.clamped,
    tags: [...cause.tags],
  };
}

function declarations(ruleset: Ruleset, sheet: Sheet): Declared[] {
  const out: Declared[] = [];
  for (const def of ruleset.rules.followUps) {
    const id = `${def.pack}:${def.id}`;
    out.push({ def, pack: def.pack, id, roots: sheet.rulesRoots(), key: id, sheet, offerId: id });
  }
  for (const a of sheet.activations) {
    if (a.scope !== 'holder' || !a.item) continue;
    const item = a.item;
    const type = item.type !== 'template' ? ruleset.contentTypes[item.type] : undefined;
    const where = `${a.source.entry ?? ''}|${a.sourceId}|${JSON.stringify(a.path)}`;
    // Follow-ups see the copy's computed values as `self.<name>`.
    let roots: Record<string, unknown> | undefined;
    const add = (list: FollowUp[] | undefined, pack: string, owner: string) => {
      for (const def of list ?? []) {
        roots ??= sheet.actionRoots(a);
        const id = `${owner}#${def.id}`;
        const offerId = a.entry ? `${id}@${a.entry.id}` : id;
        out.push({ def, pack, id, roots, activation: a, key: `${id}|${where}`, sheet, offerId });
      }
    };
    if (type) add(type.followUps, type.pack, `${type.pack}:${type.name}`);
    add(item.followUps, item.scopes?.followUps ?? item.pack, item.qid);
  }
  return out;
}

function holds(sheet: Sheet, formula: Formula, pack: string, roots: Record<string, unknown>) {
  try {
    return sheet.test(formula, pack, roots);
  } catch (error) {
    if (error instanceof Failure) return false;
    throw error;
  }
}

function numberRoot(n: number): unknown {
  return Number.isInteger(n) ? n : f.wrapValue({ kind: 'decimal', value: f.roundDecimal(n) });
}

/** Undefined when `when` is false (with `check`), its action isn't available or a formula fails. */
function resolve(
  ruleset: Ruleset,
  sheet: Sheet,
  d: Declared,
  roots: Record<string, unknown>,
  spend: (copies: number) => void,
  check: boolean,
): Resolved | undefined {
  const { def, pack, activation } = d;
  try {
    if (check && !sheet.test(def.when, pack, roots)) return undefined;
    const linked = typeof def.to === 'object';
    const out: Resolved = { to: linked ? (def.to as { link: string }) : 'self' };
    if (linked) {
      const character = sheet.linkedId((def.to as { link: string }).link);
      if (character !== undefined) out.character = character;
    }
    if (def.create) {
      // A linked character to make: the start's pack is the new file's.
      const { link, start } = def.create;
      out.create = {
        link,
        start,
        pack: start.slice(0, start.indexOf(':')),
        params: evaluateParams(sheet, def.create.params, pack, roots),
      };
    } else if (def.action !== undefined) {
      const action = linked
        ? { id: def.action }
        : startable(ruleset, sheet, def.action, activation, true);
      if (!action) return undefined;
      out.action = action;
      out.params = evaluateParams(sheet, def.params, pack, roots);
    } else {
      let copies = 0;
      out.changes = (def.changes ?? []).flatMap((change) => {
        let each = [roots];
        if (change.forEach !== undefined) {
          const list = sheet.evaluate(change.forEach, pack, roots);
          if (list.kind !== 'list')
            throw new Failure({ code: 'type-mismatch', message: 'forEach needs a list' });
          each = list.value.map((x) => ({ ...roots, x: rootValue(x) }));
          copies += each.length;
        }
        return each.flatMap((own) => {
          const resolved = resolveChange(ruleset, sheet, change, pack, own, activation, linked);
          return resolved ? [resolved] : [];
        });
      });
      spend(copies);
    }
    return out;
  } catch (error) {
    if (error instanceof Failure) return undefined;
    throw error;
  }
}

/** A parameter whose formula gives `null` is left out. */
function evaluateParams(
  sheet: Sheet,
  params: Record<string, Formula> | undefined,
  pack: string,
  roots: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params ?? {}).flatMap(([name, formula]) => {
      const value = sheet.evaluate(formula, pack, roots);
      return value.kind === 'null' ? [] : [[name, outputData(value)]];
    }),
  );
}

/**
 * A stored follow-up's action is named whether or not it is available now. An action the
 * content defines or `use`s is named with the content's copy, as computeSheet names it.
 */
function startable(
  ruleset: Ruleset,
  sheet: Sheet,
  ref: string,
  activation: Activation | undefined,
  check: boolean,
): ListedFollowUp['action'] | undefined {
  const item = activation?.item;
  const type = item ? ruleset.contentTypes[item.type] : undefined;
  const list: ActionOrUse[] = [...(type?.actions ?? []), ...(item?.actions ?? [])];
  const fromContent = (id: string) => ({
    id,
    ...(activation?.entry ? { entry: activation.entry.id } : {}),
    ...(activation && item && activation.kind !== 'feature' && activation.kind !== 'inventory'
      ? { source: item.qid }
      : {}),
  });
  const available = (formula: Formula | undefined, pack: string, roots: Record<string, unknown>) =>
    !check || holds(sheet, formula ?? true, pack, roots);
  if (!ref.includes(':')) {
    const def = list.find((a) => !('use' in a) && a.id === ref);
    if (!def || !item || !activation || 'use' in def) return undefined;
    if (!available(def.available, activation.pack, sheet.actionRoots(activation))) return undefined;
    return fromContent(`${item.qid}#${ref}`);
  }
  const def = ruleset.rules.actions[ref];
  if (!def) return undefined;
  if (activation && list.some((a) => 'use' in a && a.use === ref)) {
    if (!available(def.available, def.pack, sheet.actionRoots(activation))) return undefined;
    return fromContent(ref);
  }
  return available(def.available, def.pack, {}) ? { id: ref } : undefined;
}

/** Like an action's `changes` step; a change aimed at copies passes its formulas on unchanged. */
function resolveChange(
  ruleset: Ruleset,
  sheet: Sheet,
  change: ProposedChange,
  pack: string,
  roots: Record<string, unknown>,
  activation: Activation | undefined,
  linked: boolean,
): Change | undefined {
  if (!sheet.test(change.when, pack, roots)) return undefined;
  const evaluate = (formula: Formula) => sheet.evaluate(formula, pack, roots);
  const out: Record<string, unknown> = { type: change.type };
  if (typeof change.field === 'object')
    out.field = computedField(ruleset, evaluate(change.field.formula), pack, linked);
  else if (change.field) out.field = change.field;
  if (typeof change.entry === 'object' && 'formula' in change.entry) {
    const id = evaluate(change.entry.formula);
    if (id.kind !== 'string' || id.value === '')
      throw new Failure({ code: 'type-mismatch', message: 'an entry is an instance ID' });
    out.entry = id.value;
  } else if (typeof change.entry === 'object')
    out.entry = newEntry(ruleset, sheet, change.entry, pack, evaluate, linked);
  else if (change.entry === 'self') {
    if (!activation?.entry)
      throw new Failure({
        code: 'unknown-name',
        message: 'entry: self needs a copy',
        data: { name: 'self' },
      });
    out.entry = activation.entry.id;
  } else if (change.entry !== undefined) out.entry = change.entry;
  if (change.key !== undefined) out.key = change.key;
  if (change.id !== undefined) out.id = change.id;
  if (change.source !== undefined) {
    const ref = evaluate(change.source);
    const qid =
      ref.kind !== 'string'
        ? undefined
        : linked
          ? ref.value.includes(':')
            ? ref.value
            : undefined
          : resolveContent(ruleset, ref.value, pack);
    if (!qid || (!linked && ruleset.content[qid]?.type === 'template'))
      throw new Failure({
        code: 'unknown-name',
        message: 'unknown content',
        data: { name: String(f.toData(ref)) },
      });
    out.source = qid;
  }
  if (change.active !== undefined) {
    const active = evaluate(change.active);
    if (active.kind !== 'bool')
      throw new Failure({ code: 'type-mismatch', message: '`active` is a boolean' });
    out.active = active.value;
  }
  if (change.equipped !== undefined) {
    const equipped = evaluate(change.equipped);
    if (equipped.kind !== 'bool')
      throw new Failure({ code: 'type-mismatch', message: '`equipped` is a boolean' });
    out.equipped = equipped.value;
  }
  if (change.template !== undefined) {
    const ref = evaluate(change.template);
    const qid =
      ref.kind !== 'string'
        ? undefined
        : linked
          ? ref.value.includes(':')
            ? ref.value
            : undefined
          : resolveContent(ruleset, ref.value, pack);
    if (!qid || (!linked && ruleset.content[qid]?.type !== 'template'))
      throw new Failure({
        code: 'unknown-name',
        message: 'unknown template',
        data: { name: String(f.toData(ref)) },
      });
    out.template = qid;
  }
  if (change.state)
    out.state = Object.fromEntries(
      Object.entries(change.state).map(([k, v]) => [
        k,
        readsBatch(v) ? { formula: v } : outputData(evaluate(v)),
      ]),
    );
  if (change.path) {
    const at = change.path.entry;
    let entry: string | undefined;
    if (typeof at === 'object') {
      const id = evaluate(at.formula);
      if (id.kind !== 'string' || id.value === '')
        throw new Failure({ code: 'type-mismatch', message: 'an entry is an instance ID' });
      entry = id.value;
    } else if (at === 'self') {
      if (!activation?.entry)
        throw new Failure({
          code: 'unknown-name',
          message: 'entry: self needs a copy',
          data: { name: 'self' },
        });
      entry = activation.entry.id;
    } else entry = at;
    const choice = Array.isArray(change.path.choice)
      ? change.path.choice
      : f.toData(evaluate(change.path.choice));
    if (!Array.isArray(choice) || choice.some((c) => typeof c !== 'string'))
      throw new Failure({ code: 'type-mismatch', message: 'a choice path is a list of strings' });
    out.path = { ...(entry !== undefined ? { entry } : {}), choice };
  }
  if (change.option !== undefined) out.option = outputData(evaluate(change.option));
  // `pick: self` and `grant: self` name the pick or holder grant that made the content active.
  if (change.pick === 'self') {
    const option = activation?.kind === 'pick' ? activation.path.choice.at(-1) : undefined;
    if (!activation || option === undefined)
      throw new Failure({
        code: 'unknown-name',
        message: 'pick: self needs picked content',
        data: { name: 'self' },
      });
    out.path = { ...activation.path, choice: activation.path.choice.slice(0, -1) };
    out.option = option;
  }
  if (change.grant === 'self') {
    if (!activation?.item || activation.kind !== 'grant' || activation.scope !== 'holder')
      throw new Failure({
        code: 'unknown-name',
        message: 'grant: self needs granted content',
        data: { name: 'self' },
      });
    const at = activation.path;
    if (at.choice.length === 0) out.entry = at.entry;
    else {
      out.path = { ...at, choice: at.choice.slice(0, -1) };
      out.option = at.choice.at(-1);
    }
    out.grant = activation.item.qid;
  }
  if (change.copies) {
    out.copies = { ...change.copies };
    if (change.limit !== undefined) out.limit = change.limit;
  }
  if (change.applied) out.applied = { ...change.applied };
  if (change.picks) out.picks = { ...change.picks };
  if (change.grants) out.grants = { ...change.grants };
  const perCopy = (formula: Formula) =>
    (change.copies !== undefined ||
      change.applied !== undefined ||
      change.picks !== undefined ||
      change.grants !== undefined) &&
    readsCopy(formula);
  if (change.value !== undefined)
    out.value = perCopy(change.value) ? change.value : outputData(evaluate(change.value));
  if (change.by !== undefined)
    out.by = perCopy(change.by) ? change.by : f.toData(evaluate(change.by));
  const tags = tagsOf(ruleset, change.tags, evaluate);
  if (tags.length > 0) out.tags = tags;
  // Built from a proposed change that passed its own schema, with formulas evaluated.
  return out as unknown as Change;
}

/** A field that isn't an input of the ruleset fails, so the follow-up isn't listed. */
function computedField(ruleset: Ruleset, value: f.Value, pack: string, linked: boolean): string {
  if (value.kind !== 'string')
    throw new Failure({ code: 'type-mismatch', message: 'a computed field is a string' });
  const ref = value.value;
  if (linked) {
    if (ref.includes(':')) return ref;
    throw new Failure({
      code: 'unknown-name',
      message: `unknown field "${ref}"`,
      data: { name: ref },
    });
  }
  const qid = resolveField(ruleset, ref, pack);
  if (!qid)
    throw new Failure({
      code: 'unknown-name',
      message: `unknown field "${ref}"`,
      data: { name: ref },
    });
  if (!ruleset.fields[qid]?.input)
    throw new Failure({
      code: 'unknown-name',
      message: `"${qid}" is not an input field`,
      data: { name: qid },
    });
  return qid;
}

function rootValue(value: f.Value): unknown {
  return value.kind === 'decimal' || value.kind === 'dice' ? f.wrapValue(value) : f.toData(value);
}

function tagsOf(
  ruleset: Ruleset,
  list: TagOrFormula[] | undefined,
  evaluate: (formula: Formula) => f.Value,
): string[] {
  const out = evaluateTags(ruleset, list, evaluate);
  if (!out.ok)
    throw new Failure({
      code: out.code,
      message:
        out.code === 'unknown-tag'
          ? `undeclared tag "${String(out.data.tag)}"`
          : String(out.data.message),
    } as f.FormulaError);
  return out.tags;
}

/** `self`, `item` and `batch` are only known to applyChanges, per copy. */
function readsCopy(formula: Formula): boolean {
  return readsRoot(formula, ['self', 'item', 'batch']);
}

function readsBatch(formula: Formula): boolean {
  return readsRoot(formula, ['batch']);
}

function readsRoot(formula: Formula, roots: string[]): boolean {
  if (typeof formula !== 'string') return false;
  const tree = f.parse(formula);
  if (!tree.ok) return false;
  return [...f.references(tree.value, new Set())].some((name) =>
    roots.includes(name.split('.')[0] as string),
  );
}

function newEntry(
  ruleset: Ruleset,
  sheet: Sheet,
  decl: ProposedEntry,
  pack: string,
  evaluate: (formula: Formula) => f.Value,
  linked: boolean,
): Record<string, unknown> {
  const ref = evaluate(decl.item);
  const qid =
    ref.kind !== 'string'
      ? undefined
      : linked
        ? ref.value.includes(':')
          ? ref.value
          : undefined
        : resolveContent(ruleset, ref.value, pack);
  if (!qid || (!linked && ruleset.content[qid]?.type === 'template'))
    throw new Failure({
      code: 'unknown-name',
      message: 'unknown item',
      data: { name: String(f.toData(ref)) },
    });
  let id = decl.id;
  if (id === undefined) {
    const character = sheet.character;
    const used = new Set(
      [...(character.inventory ?? []), ...(character.features ?? [])].map((e) => e.id),
    );
    const stem = localPart(qid).replaceAll('.', '-');
    let n = 1;
    while (used.has(`${stem}-${n}`)) n++;
    id = `${stem}-${n}`;
  }
  const out: Record<string, unknown> = { id, item: qid };
  if (decl.templates)
    out.templates = linked
      ? decl.templates
      : decl.templates.map((t) => resolveContent(ruleset, t, pack) ?? t);
  if (decl.equipped !== undefined) out.equipped = f.toData(evaluate(decl.equipped));
  if (decl.quantity !== undefined) out.quantity = f.toData(evaluate(decl.quantity));
  if (decl.state)
    out.state = Object.fromEntries(
      Object.entries(decl.state).map(([k, v]) => [k, outputData(evaluate(v))]),
    );
  if (decl.choices) out.choices = pickOptions(decl.choices, evaluate);
  return out;
}

function pickOptions(
  tree: Record<string, unknown>,
  evaluate: (formula: Formula) => f.Value,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, picks] of Object.entries(tree)) {
    out[key] = (picks as { option: unknown; choices?: Record<string, unknown> }[]).map((pick) => {
      let option = pick.option;
      if (option !== null && typeof option === 'object') {
        const value = evaluate((option as { formula: Formula }).formula);
        if (value.kind !== 'string' && value.kind !== 'int' && value.kind !== 'decimal')
          throw new Failure({ code: 'type-mismatch', message: "a pick's option is a string" });
        option = value.value;
      }
      return { option, ...(pick.choices ? { choices: pickOptions(pick.choices, evaluate) } : {}) };
    });
  }
  return out;
}

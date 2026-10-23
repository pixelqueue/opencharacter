import {
  type FieldValue,
  type Literal,
  type PendingChoice,
  SPEC_VERSION,
  type SpecUpgradeStep,
  type UpgradeStep,
} from '@opencharacter/spec';
import semver from 'semver';
import * as f from '../formula/index.ts';
import type { EngineError } from './load.ts';
import type {
  CharacterDoc,
  Choice,
  ChoiceTree,
  ContentItem,
  Entry,
  FieldDef,
  Pick,
  ValueDecl,
} from './pack-types.ts';
import { appliesQueries } from './pack-types.ts';
import type { PackRelease } from './release.ts';
import type { Ruleset } from './ruleset.ts';
import { homebrewFormulas, withHomebrew } from './homebrew.ts';
import { HomebrewRewriter } from './homebrew-upgrade.ts';
import { display } from './display.ts';
import { loadRuleset } from './load.ts';
import { itemStandard, rulesStandard, standardId } from './ruleset.ts';
import { upgradeSpec } from './spec-upgrade.ts';
import { expandSlots, Sheet } from './sheet.ts';
import { stateDecls } from './views.ts';

type Step = UpgradeStep;

export interface UpgradeReport {
  values: {
    field: string;
    before?: Literal;
    after?: Literal;
    shownBefore?: boolean;
    shownAfter?: boolean;
  }[];
  steps: { pack: string; from: string; to: string; step: Step }[];
  /** Present when the character's `specVersion` moved: the version it had, and the spec steps that changed it. */
  spec?: { from: string; steps: { version: string; step: SpecUpgradeStep }[] };
  errors: EngineError[];
  /** Each place in the homebrew a step rewrote. */
  homebrew: { path: string; step: Step }[];
}

export type UpgradeResult =
  | { ok: true; character: CharacterDoc; pending: PendingChoice[]; report: UpgradeReport }
  | { ok: false; errors: EngineError[] };

/** One "what changed" entry; a field missing (or broken) on one side has only the other. */
function valueChange(
  field: string,
  b?: FieldValue,
  a?: FieldValue,
): UpgradeReport['values'][number] {
  return {
    field,
    ...(b?.value === undefined ? {} : { before: b.value }),
    ...(a?.value === undefined ? {} : { after: a.value }),
    ...(b?.value === undefined ? {} : { shownBefore: b.shown ?? true }),
    ...(a?.value === undefined ? {} : { shownAfter: a.shown ?? true }),
  };
}

function shownValues(sheet: Sheet): Record<string, FieldValue> {
  const values = sheet.values();
  const shown = display(sheet).fields;
  return Object.fromEntries(
    Object.entries(values).map(([id, v]) => [id, { ...v, shown: shown[id] ?? true }]),
  );
}

/** upgrade: moves a character from the ruleset it was saved with to another. */
export function upgrade(from: Ruleset, to: Ruleset, saved: CharacterDoc): UpgradeResult {
  if (semver.gt(saved.specVersion, SPEC_VERSION)) {
    return {
      ok: false,
      errors: [
        {
          code: 'character-spec-unsupported',
          data: { specVersion: saved.specVersion, implements: SPEC_VERSION },
          path: '/specVersion',
        },
      ],
    };
  }
  for (const pin of saved.packs) {
    const target = to.packs.find((p) => p.id === pin.id);
    if (!target)
      return { ok: false, errors: [{ code: 'unknown-id', data: { id: pin.id, pack: pin.id } }] };
    if (semver.lt(target.version, pin.version)) {
      return {
        ok: false,
        errors: [
          {
            code: 'no-upgrade-path',
            data: { pack: pin.id, pinned: pin.version, target: target.version },
          },
        ],
      };
    }
  }
  // The spec's own upgrades come first, so the packs' scripts and both sheets read the file in
  // the engine's shape.
  const spec = upgradeSpec(saved);
  const character = spec.character;
  // The character's homebrew is loaded on both sides. On the new ruleset, a
  // homebrew that no longer loads is reported, and the character is still upgraded.
  const layeredFrom = withHomebrew(from, character);
  if (!layeredFrom.ok) return { ok: false, errors: layeredFrom.errors };
  from = layeredFrom.ruleset;
  const old = new Sheet(from, character);
  const next: CharacterDoc = structuredClone(character);
  const report: UpgradeReport = {
    values: [],
    steps: [],
    ...(saved.specVersion === SPEC_VERSION
      ? {}
      : { spec: { from: saved.specVersion, steps: spec.steps } }),
    errors: [],
    homebrew: [],
  };
  const renamedFields = new Map<string, string>();
  const rewriter = new HomebrewRewriter(next, from, to, homebrewFormulas(from));

  for (const pin of next.packs) {
    const target = (to.packs.find((p) => p.id === pin.id) as { version: string }).version;
    const scripts = to.upgrades[pin.id] ?? [];
    let current = pin.version;
    for (;;) {
      const exact = scripts.find((s) => s.from === current && semver.lte(s.to, target));
      const later = scripts
        .filter(
          (s) =>
            semver.gt(s.from, current) && semver.lte(s.from, target) && semver.lte(s.to, target),
        )
        .toSorted((a, b) => semver.compare(a.from, b.from))[0];
      const script = exact ?? later;
      if (!script) break;
      for (const raw of script.steps) {
        const step = raw as Step;
        const changed = applyStep(step, script.pack, next, from, to, old, renamedFields, rewriter);
        const rewritten = rewriter.apply(step, script.pack);
        for (const path of rewritten) report.homebrew.push({ path, step });
        if (changed || rewritten.length > 0) {
          report.steps.push({ pack: script.pack, from: script.from, to: script.to, step });
        }
      }
      current = script.to;
    }
    pin.version = target;
  }

  const layeredTo = withHomebrew(to, next);
  const after = new Sheet(layeredTo.ok ? layeredTo.ruleset : to, next);
  const before = shownValues(old);
  const now = shownValues(after);
  const oldIdFor = new Map([...renamedFields].map(([o, n]) => [n, o]));
  const seenOld = new Set<string>();
  for (const id of Object.keys(now)) {
    const oldId = oldIdFor.get(id) ?? id;
    seenOld.add(oldId);
    const b = before[oldId];
    const a = now[id];
    if (!b) report.values.push(valueChange(id, undefined, a));
    else if (JSON.stringify(b.value) !== JSON.stringify(a?.value))
      report.values.push(valueChange(id, b, a));
  }
  for (const id of Object.keys(before))
    if (!seenOld.has(id)) report.values.push(valueChange(id, before[id]));
  report.values.sort((x, y) => (x.field < y.field ? -1 : x.field > y.field ? 1 : 0));
  report.errors = [...(layeredTo.ok ? [] : layeredTo.errors), ...after.errors];
  return { ok: true, character: next, pending: after.pending().pending, report };
}

const allEntries = (c: CharacterDoc): Entry[] => [...(c.features ?? []), ...(c.inventory ?? [])];

interface TreeAt {
  tree: ChoiceTree;
  /** The content ID that owns the tree's bare keys (null: the rules, an inline option or a value). */
  owner: string | null;
}

/** A choice tree and every tree nested in its picks. */
function treesUnder(root: ChoiceTree, owner: string | null): TreeAt[] {
  const out: TreeAt[] = [];
  const walk = (tree: ChoiceTree, at: string | null) => {
    out.push({ tree, owner: at });
    for (const picks of Object.values(tree)) {
      for (const pick of picks)
        if (pick.choices)
          walk(
            pick.choices,
            typeof pick.option === 'string' && pick.option.includes(':') ? pick.option : null,
          );
    }
  };
  walk(root, owner);
  return out;
}

/** Every choice tree in the character with the content ID that owns its bare keys. */
function trees(c: CharacterDoc): TreeAt[] {
  return [
    ...(c.choices ? treesUnder(c.choices, null) : []),
    ...allEntries(c).flatMap((e) => (e.choices ? treesUnder(e.choices, e.item) : [])),
  ];
}

/**
 * A step's `owner`: content, then choice and inline option pairs down to a nested choice; an
 * even number of parts starts at a rules-level choice. Absent: the rules.
 */
interface OwnerPath {
  head: string | null;
  pairs: [string, string][];
}

function ownerPath(owner: string | undefined, q: (local: string) => string): OwnerPath {
  if (owner === undefined) return { head: null, pairs: [] };
  const parts = owner.split('/');
  const head = parts.length % 2 === 1 ? q(parts.shift() as string) : null;
  const pairs: [string, string][] = [];
  for (let i = 0; i < parts.length; i += 2)
    pairs.push([parts[i] as string, parts[i + 1] as string]);
  return { head, pairs };
}

/** A tree that holds an owner's own choices, and the key prefix they use in it. */
interface OwnerTree {
  tree: ChoiceTree;
  prefix: string;
}

/**
 * The trees among `scope` (or the rules tree) that hold `path`'s own choices: its content's
 * trees (bare keys) and trees that key its choices `<owner>/<choice>`, then down each choice and
 * inline option pair.
 */
function ownerTrees(scope: TreeAt[], rules: ChoiceTree | undefined, path: OwnerPath): OwnerTree[] {
  let at: OwnerTree[] = [];
  if (path.head === null) {
    if (rules) at.push({ tree: rules, prefix: '' });
  } else {
    const head = path.head;
    for (const { tree, owner } of scope) {
      if (owner === head) at.push({ tree, prefix: '' });
      if (Object.keys(tree).some((k) => k.startsWith(`${head}/`)))
        at.push({ tree, prefix: `${head}/` });
    }
  }
  for (const [choice, option] of path.pairs) {
    const next: OwnerTree[] = [];
    for (const { tree, prefix } of at)
      for (const pick of tree[`${prefix}${choice}`] ?? [])
        if (String(pick.option) === option && pick.choices)
          next.push({ tree: pick.choices, prefix: '' });
    at = next;
  }
  return at;
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A saved state map and its content: copies, content picks and granted content. */
interface StateHolder {
  holder: { state?: Record<string, unknown> };
  content: string;
}

function stateHolders(c: CharacterDoc): StateHolder[] {
  const out: StateHolder[] = [];
  const grants = (node: { grants?: Entry['grants'] }) => {
    for (const [content, saved] of Object.entries(node.grants ?? {}))
      out.push({ holder: saved as StateHolder['holder'], content });
  };
  for (const e of allEntries(c)) {
    out.push({ holder: e as StateHolder['holder'], content: e.item });
    grants(e);
  }
  for (const { tree } of trees(c))
    for (const pick of Object.values(tree).flat()) {
      if (typeof pick.option === 'string' && pick.option.includes(':'))
        out.push({ holder: pick as StateHolder['holder'], content: pick.option });
      grants(pick);
    }
  return out;
}

/** Drops a holder's empty `state`, and a grant store left empty. */
function prune(c: CharacterDoc): void {
  for (const { holder } of stateHolders(c))
    if (holder.state && Object.keys(holder.state).length === 0) delete holder.state;
  for (const node of grantNodes(c)) {
    if (!node.grants) continue;
    for (const [id, saved] of Object.entries(node.grants))
      if (Object.keys(saved).length === 0) delete node.grants[id];
    if (Object.keys(node.grants).length === 0) delete node.grants;
  }
}

/**
 * Content a copy's own node holds by holder grants on `ruleset` (those of its type, item and
 * templates, and of what they grant), by qualified ID, each with the state keys its grants set.
 */
function heldGrants(ruleset: Ruleset, entry: Entry): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const queue = [entry.item, ...(entry.templates ?? [])];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const item = ruleset.content[id];
    if (!item) continue;
    const type = ruleset.contentTypes[item.type];
    for (const grant of [...(type?.grants ?? []), ...(item.grants ?? [])]) {
      if ((grant.scope ?? 'holder') !== 'holder' || typeof grant.item !== 'string') continue;
      const keys = out.get(grant.item) ?? new Set<string>();
      for (const key of Object.keys(grant.state ?? {})) keys.add(key);
      out.set(grant.item, keys);
      queue.push(grant.item);
    }
  }
  return out;
}

/** Every node that may keep granted content's state: the copies and every pick. */
function grantNodes(c: CharacterDoc): { grants?: Entry['grants'] }[] {
  const picks = trees(c).flatMap(({ tree }) => Object.values(tree).flat());
  return [...allEntries(c), ...picks];
}

/** Moves (or, without `to`, drops) the saved state of granted content `from`. */
function renameGrant(c: CharacterDoc, from: string, to?: string): boolean {
  let changed = false;
  for (const node of grantNodes(c)) {
    const saved = node.grants?.[from];
    if (!node.grants || !saved) continue;
    if (to !== undefined) node.grants[to] = saved;
    delete node.grants[from];
    if (Object.keys(node.grants).length === 0) delete node.grants;
    changed = true;
  }
  return changed;
}

/**
 * Where moveState puts a copy's value, on the new ruleset: the pick of `option` in the copy's
 * own trees (the rules tree for a rules-level choice), or the saved state of content the copy
 * holds by a holder grant. `decl` gives a key's declared default (undefined: not declared);
 * `overridden` tells a key a grant sets, whose default isn't the declared one.
 */
function moveTarget(
  step: Step,
  entry: Entry,
  c: CharacterDoc,
  to: Ruleset,
  q: (local: string) => string,
  option: (o: string | number) => string | number,
):
  | {
      holder: { state?: Record<string, unknown> };
      decl: ((key: string) => unknown) | undefined;
      overridden: (key: string) => boolean;
    }
  | undefined {
  const declOf = (id: string) => {
    const item = to.content[id];
    if (!item) return undefined;
    const decls = stateDecls(to, item, []);
    return (key: string) => (Object.hasOwn(decls, key) ? decls[key]?.default : undefined);
  };
  const declares = (id: string, key: string) => {
    const item = to.content[id];
    return !!item && Object.hasOwn(stateDecls(to, item, []), key);
  };
  const target = step.to ?? (step.from as string);
  if (step.grant !== undefined) {
    const id = q(step.grant);
    const sets = heldGrants(to, entry).get(id);
    if (!sets || !declares(id, target)) return undefined;
    entry.grants ??= {};
    const saved = (entry.grants[id] ??= {});
    return {
      holder: saved as { state?: Record<string, unknown> },
      decl: declOf(id),
      overridden: (key) => sets.has(key),
    };
  }
  const path = ownerPath(step.owner, q);
  const scope = entry.choices ? treesUnder(entry.choices, entry.item) : [];
  const picked = option(step.option as string | number);
  const keys = choiceKeys(to, path, step.choice as string);
  for (const { tree, prefix } of ownerTrees(
    scope,
    path.head === null ? c.choices : undefined,
    path,
  ))
    for (const pick of keys.flatMap((key) => tree[`${prefix}${key}`] ?? [])) {
      if (pick.option !== picked) continue;
      if (typeof picked !== 'string' || !declares(picked, target)) return undefined;
      return {
        holder: pick as { state?: Record<string, unknown> },
        decl: declOf(picked),
        overridden: () => false,
      };
    }
  return undefined;
}

/** The saved keys of an owner's choice on `ruleset`: each slot's for a slotted choice. */
function choiceKeys(ruleset: Ruleset, path: OwnerPath, choice: string): string[] {
  let choices: readonly Choice[] =
    path.head === null
      ? Object.values(ruleset.rules.choices)
      : (ruleset.content[path.head]?.choices ?? []);
  for (const [id, opt] of path.pairs) {
    const from = choices.find((c) => c.id === id)?.from;
    choices =
      (from && 'options' in from ? from.options.find((o) => o.id === opt)?.choices : []) ?? [];
  }
  const declared = choices.find((c) => c.id === choice);
  return declared?.slots ? declared.slots.map((n) => `${choice}-${n}`) : [choice];
}

function renameKey(tree: ChoiceTree, from: string, to: string): boolean {
  if (!(from in tree)) return false;
  tree[to] = tree[from] as Pick[];
  delete tree[from];
  return true;
}

function applyStep(
  step: Step,
  pack: string,
  c: CharacterDoc,
  from: Ruleset,
  to: Ruleset,
  old: Sheet,
  renamedFields: Map<string, string>,
  rewriter: HomebrewRewriter,
): boolean {
  const q = (local: string) => (local.includes(':') ? local : `${pack}:${local}`);
  // A picked option: content as a qualified ID, else an inline option or value as written.
  const option = (o: string | number) =>
    typeof o === 'string' && (from.content[q(o)] || to.content[q(o)]) ? q(o) : o;
  const typeOf = (id: string) =>
    rewriter.typeOf(id) ?? to.content[id]?.type ?? from.content[id]?.type;
  // The state steps' content: of `item` (or homebrew extending it), and of content type `type`
  // (any when both are absent).
  const holds = (id: string) =>
    (step.item === undefined || rewriter.isOf(id, q(step.item))) &&
    (step.type === undefined || typeOf(id) === q(step.type));
  let changed = false;
  switch (step.op) {
    case 'renameContent': {
      const a = q(step.from as string);
      const b = q(step.to as string);
      for (const e of allEntries(c)) {
        if (e.item === a) {
          e.item = b;
          changed = true;
        }
        if (e.templates?.includes(a)) {
          e.templates = e.templates.map((t) => (t === a ? b : t));
          changed = true;
        }
      }
      for (const applied of c.applied ?? []) {
        if (applied.source === a) {
          applied.source = b;
          changed = true;
        }
      }
      for (const { tree } of trees(c)) {
        for (const key of Object.keys(tree)) {
          if (key.startsWith(`${a}/`))
            changed = renameKey(tree, key, `${b}/${key.slice(a.length + 1)}`) || changed;
        }
        for (const picks of Object.values(tree)) {
          for (const pick of picks) {
            if (pick.option === a) {
              pick.option = b;
              changed = true;
            }
          }
        }
      }
      changed = renameGrant(c, a, b) || changed;
      return mapSetValues(c, (v) => (v === a ? b : v)) || changed;
    }
    case 'removeContent': {
      const id = q(step.id as string);
      for (const list of ['features', 'inventory'] as const) {
        const entries = c[list];
        if (!entries) continue;
        const kept = entries.filter((e) => e.item !== id);
        if (kept.length !== entries.length) {
          c[list] = kept;
          changed = true;
        }
        for (const e of kept) {
          if (e.templates?.includes(id)) {
            e.templates = e.templates.filter((t) => t !== id);
            changed = true;
          }
        }
      }
      if (c.applied?.some((a) => a.source === id)) {
        c.applied = c.applied.filter((a) => a.source !== id);
        changed = true;
      }
      for (const { tree } of trees(c)) {
        for (const key of Object.keys(tree)) {
          if (key.startsWith(`${id}/`)) {
            delete tree[key];
            changed = true;
          } else if (tree[key]?.some((p) => p.option === id)) {
            tree[key] = (tree[key] as Pick[]).filter((p) => p.option !== id);
            changed = true;
          }
        }
      }
      changed = renameGrant(c, id) || changed;
      return mapSetValues(c, (v) => (v === id ? undefined : v)) || changed;
    }
    case 'renameField': {
      const a = q(step.from as string);
      const b = q(step.to as string);
      renamedFields.set(a, b);
      if (!c.values || !(a in c.values)) return false;
      c.values[b] = c.values[a] as never;
      delete c.values[a];
      return true;
    }
    case 'removeField': {
      const id = q(step.field as string);
      if (!c.values || !(id in c.values)) return false;
      delete c.values[id];
      return true;
    }
    case 'setDefault': {
      const id = q(step.field as string);
      if (c.values?.[id] !== undefined) return false;
      const value = old.evaluate(step.value as string, pack, {});
      c.values = { ...c.values, [id]: f.toData(value) as never };
      return true;
    }
    case 'mapValues': {
      const id = q(step.field as string);
      const current = c.values?.[id];
      if (current === undefined || !step.map || !(String(current) in step.map)) return false;
      (c.values as Record<string, unknown>)[id] = step.map[String(current)];
      return true;
    }
    case 'renameState':
    case 'removeState': {
      const key = (step.op === 'renameState' ? step.from : step.key) as string;
      for (const { holder, content } of stateHolders(c)) {
        if (!holds(content)) continue;
        if (!holder.state || !Object.hasOwn(holder.state, key)) continue;
        if (step.op === 'renameState') holder.state[step.to as string] = holder.state[key];
        delete holder.state[key];
        changed = true;
      }
      if (changed && step.op === 'removeState') prune(c);
      return changed;
    }
    case 'moveState': {
      const key = step.from as string;
      const target = step.to ?? key;
      for (const e of allEntries(c)) {
        if (!holds(e.item)) continue;
        if (!e.state || !Object.hasOwn(e.state, key)) continue;
        const value = e.state[key];
        delete e.state[key];
        changed = true;
        const place = moveTarget(step, e, c, to, q, option);
        if (!place) continue;
        const { holder, decl, overridden } = place;
        if (!decl || Object.hasOwn(holder.state ?? {}, target)) continue;
        if (!overridden(target) && sameValue(value, decl(target))) continue;
        holder.state = { ...holder.state, [target]: value };
      }
      if (changed) prune(c);
      return changed;
    }
    case 'renameChoice':
    case 'renameOption':
    case 'removeChoice': {
      const name = step.op === 'renameChoice' ? (step.from as string) : (step.choice as string);
      for (const { tree, prefix } of ownerTrees(trees(c), c.choices, ownerPath(step.owner, q))) {
        const key = `${prefix}${name}`;
        if (!(key in tree)) continue;
        if (step.op === 'renameChoice') {
          changed = renameKey(tree, key, `${prefix}${step.to}`) || changed;
          continue;
        }
        if (step.op === 'removeChoice') {
          delete tree[key];
          changed = true;
          continue;
        }
        const a = option(step.from as string);
        const picks = tree[key] as Pick[];
        if (!picks.some((p) => p.option === a)) continue;
        tree[key] =
          step.to === undefined
            ? picks.filter((p) => p.option !== a)
            : picks.map((p) => (p.option === a ? { ...p, option: option(step.to as string) } : p));
        changed = true;
      }
      return changed;
    }
    case 'renameTag': {
      // Saved sets of tags (`of: tag` input fields) follow the tag.
      const a = step.from as string;
      const b = step.to as string;
      for (const [id, value] of Object.entries(c.values ?? {})) {
        const def = from.fields[id] ?? to.fields[id];
        if (def?.of !== 'tag' || !Array.isArray(value) || !value.includes(a)) continue;
        (c.values as Record<string, unknown>)[id] = value.map((v) => (v === a ? b : v));
        changed = true;
      }
      return changed;
    }
    case 'adoptStandard': {
      // The first entry of the item becomes its standard copy.
      const item = q(step.item as string);
      const id = standardId(item);
      if (allEntries(c).some((e) => e.id === id)) return false;
      const entry = allEntries(c).find((e) => e.item === item);
      if (!entry) return false;
      entry.id = id;
      return true;
    }
    case 'requireChoice': {
      // Informational: the upgraded character reports the choice as pending. Listed when the
      // character holds the owner (or for a rules-level choice).
      if (step.owner === undefined) return true;
      const path = ownerPath(step.owner, q);
      if (path.pairs.length === 0) return trees(c).some((t) => t.owner === path.head);
      return ownerTrees(trees(c), c.choices, path).length > 0;
    }
    default:
      return false;
  }
}

function mapSetValues(c: CharacterDoc, fn: (v: string) => string | undefined): boolean {
  let changed = false;
  for (const [key, value] of Object.entries(c.values ?? {})) {
    if (!Array.isArray(value)) continue;
    const mapped = value
      .map((v) => (typeof v === 'string' ? fn(v) : v))
      .filter((v) => v !== undefined);
    if (JSON.stringify(mapped) !== JSON.stringify(value)) {
      (c.values as Record<string, unknown>)[key] = mapped;
      changed = true;
    }
  }
  return changed;
}

export interface ShapeChange {
  kind:
    | 'content-removed'
    | 'content-type-changed'
    | 'field-removed'
    | 'field-type-changed'
    | 'state-removed'
    | 'choice-removed'
    | 'option-removed'
    | 'choice-added'
    // An existing item became standard: covered by adoptStandard.
    | 'standard-copy-added'
    | 'content-type-removed'
    | 'item-field-removed'
    | 'item-field-values-removed'
    | 'tag-removed'
    | 'action-removed';
  id: string;
}

export interface CheckReleaseResult {
  ok: boolean;
  changes: ShapeChange[];
  errors: EngineError[];
}

interface ChoiceInfo {
  owner: string;
  choice: Choice;
}

/**
 * Every choice of a release, keyed `<owner>/<choice>`; owners are item IDs, `rules`, or
 * inline-option paths. A slotted choice is each of its slots, as saved.
 */
function choicesOf(release: PackRelease): Map<string, ChoiceInfo> {
  const out = new Map<string, ChoiceInfo>();
  const visit = (owner: string, choices: Choice[] | undefined) => {
    for (const choice of (choices ?? []).flatMap((c) => expandSlots(c).map((e) => e.choice))) {
      out.set(`${owner}/${choice.id}`, { owner, choice });
      if ('options' in choice.from)
        for (const o of choice.from.options) visit(`${owner}/${choice.id}/${o.id}`, o.choices);
    }
  };
  visit('rules', release.rules.choices);
  for (const item of release.content) if (item.id) visit(item.id, item.choices);
  return out;
}

function states(release: PackRelease): Map<string, { decl: ValueDecl; type?: string }> {
  const out = new Map<string, { decl: ValueDecl; type?: string }>();
  for (const [name, def] of Object.entries(release.rules.contentTypes ?? {})) {
    for (const [key, decl] of Object.entries(def.state ?? {}))
      out.set(`${name}/${key}`, { decl, type: name });
  }
  for (const item of release.content) {
    if (!item.id) continue;
    const type = item.type === 'template' ? appliesQueries(item)[0]?.type : item.type;
    for (const [key, decl] of Object.entries(item.state ?? {}))
      out.set(`${item.id}/${key}`, { decl, ...(type ? { type } : {}) });
  }
  return out;
}

/** A choice's written option IDs; undefined for a `values` formula, whose options are unknown. */
const optionIds = (choice: Choice): string[] | undefined => {
  const from = choice.from;
  if ('values' in from) return Array.isArray(from.values) ? from.values.map(String) : undefined;
  if ('options' in from) return from.options.map((o) => o.id);
  return [];
};

const items = (r: PackRelease) =>
  new Map(r.content.filter((i): i is ContentItem & { id: string } => !!i.id).map((i) => [i.id, i]));

/** Each side's dependency releases, transitively; `[]` when absent. */
export interface ReleaseDependencies {
  previous?: PackRelease[];
  next?: PackRelease[];
}

function standardItems(ruleset: Ruleset): Set<string> {
  const out = new Set(rulesStandard(ruleset));
  for (const item of Object.values(ruleset.content))
    for (const qid of itemStandard(ruleset, item)) out.add(qid);
  return out;
}

/** A breaking bump: the major version from 1.0.0, the minor version before it (0.1.x → 0.2.0). */
function breakingBump(prev: string, next: string): boolean {
  if (semver.major(next) > semver.major(prev)) return true;
  return semver.major(prev) === 0 && semver.minor(next) > semver.minor(prev);
}

/** checkRelease: compares a pack's new release with its previous one (the build check). */
export function checkRelease(
  previous: PackRelease,
  next: PackRelease,
  dependencies: ReleaseDependencies = {},
): CheckReleaseResult {
  const changes: ShapeChange[] = [];
  const errors: EngineError[] = [];
  const prevVersion = previous.manifest.version;
  const nextVersion = next.manifest.version;
  if (!semver.gt(nextVersion, prevVersion)) {
    errors.push({
      code: 'version-not-increased',
      data: { pack: next.manifest.id, previous: prevVersion, next: nextVersion },
    });
  }

  const prevItems = items(previous);
  const nextItems = items(next);
  for (const [id, item] of prevItems) {
    const now = nextItems.get(id);
    if (!now) changes.push({ kind: 'content-removed', id });
    else if (now.type !== item.type) changes.push({ kind: 'content-type-changed', id });
  }
  const prevFields = previous.rules.fields ?? {};
  const nextFields = next.rules.fields ?? {};
  // A pack's interface: needs a breaking bump, but no upgrade script.
  const interfaceChanges: ShapeChange[] = [];
  for (const [id, def] of Object.entries(prevFields) as [string, FieldDef][]) {
    if (!def.input) {
      if (!nextFields[id]) interfaceChanges.push({ kind: 'field-removed', id });
      continue;
    }
    const now = nextFields[id];
    if (!now?.input) changes.push({ kind: 'field-removed', id });
    else if (
      now.type !== def.type ||
      (def.values ?? []).some((v) => !(now.values ?? []).includes(v))
    ) {
      changes.push({ kind: 'field-type-changed', id });
    }
  }
  const prevStates = states(previous);
  const nextStates = states(next);
  for (const [id, { decl }] of prevStates) {
    const now = nextStates.get(id);
    if (!now || now.decl.type !== decl.type) changes.push({ kind: 'state-removed', id });
  }
  const prevChoices = choicesOf(previous);
  const nextChoices = choicesOf(next);
  for (const [id, { choice }] of prevChoices) {
    const now = nextChoices.get(id);
    if (!now) {
      changes.push({ kind: 'choice-removed', id });
      continue;
    }
    // A `values` formula's options can't be known before a sheet: written values it replaces
    // aren't removed (a character's pick the formula no longer offers is reported then).
    const offered = optionIds(now.choice);
    if (offered === undefined) continue;
    const kept = new Set(offered);
    for (const option of optionIds(choice) ?? [])
      if (!kept.has(option)) changes.push({ kind: 'option-removed', id: `${id}/${option}` });
  }
  for (const [id, { owner, choice }] of nextChoices) {
    if (prevChoices.has(id) || choice.required === false) continue;
    const ownerExisted =
      owner === 'rules' ||
      prevItems.has(owner) ||
      [...prevChoices.keys()].some((k) => owner.startsWith(`${k}/`));
    // A new required choice on content that existed before: saved characters lack picks for it.
    if (ownerExisted) changes.push({ kind: 'choice-added', id });
  }
  // Items that became standard: both sides are loaded with their dependencies,
  // so the standard copies queries resolve as for a character. A side that doesn't load is the
  // load's errors, `data.release` naming the side.
  const loads = (['previous', 'next'] as const).map((side) => {
    const result = loadRuleset([
      ...(dependencies[side] ?? []),
      side === 'previous' ? previous : next,
    ]);
    if (!result.ok)
      for (const e of result.errors)
        errors.push({ ...e, data: { ...e.data, release: side } } as EngineError);
    return result.ok ? result.ruleset : undefined;
  });
  const [before, after] = loads;
  if (before && after) {
    const was = standardItems(before);
    const now = standardItems(after);
    for (const [id, item] of nextItems) {
      const qid = `${next.manifest.id}:${id}`;
      if (now.has(qid) && !was.has(qid) && prevItems.get(id)?.type === item.type)
        changes.push({ kind: 'standard-copy-added', id });
    }
  }

  const prevTypes = previous.rules.contentTypes ?? {};
  const nextTypes = next.rules.contentTypes ?? {};
  for (const [name, def] of Object.entries(prevTypes)) {
    const now = nextTypes[name];
    if (!now) {
      interfaceChanges.push({ kind: 'content-type-removed', id: name });
      continue;
    }
    for (const [field, decl] of Object.entries(def.fields ?? {}) as [string, ValueDecl][]) {
      const kept = now.fields?.[field] as ValueDecl | undefined;
      const id = `${name}/${field}`;
      if (!kept || kept.type !== decl.type || kept.of !== decl.of)
        interfaceChanges.push({ kind: 'item-field-removed', id });
      else if ((decl.values ?? []).some((v) => !(kept.values ?? []).includes(v)))
        interfaceChanges.push({ kind: 'item-field-values-removed', id });
    }
  }
  const nextTags = new Set(next.rules.tags ?? []);
  for (const tag of new Set(previous.rules.tags ?? []))
    if (!nextTags.has(tag)) interfaceChanges.push({ kind: 'tag-removed', id: tag });
  const nextActions = new Set((next.rules.actions ?? []).map((a) => a.id));
  for (const action of previous.rules.actions ?? [])
    if (!nextActions.has(action.id))
      interfaceChanges.push({ kind: 'action-removed', id: action.id });

  if (changes.length + interfaceChanges.length > 0) {
    if (!breakingBump(prevVersion, nextVersion)) {
      errors.push({
        code: 'version-bump-too-small',
        data: { pack: next.manifest.id, previous: prevVersion, next: nextVersion },
      });
    }
  }
  // Only saved state's shape needs an upgrade script; interface changes need the breaking bump.
  if (changes.length > 0) {
    const script = (next.upgrades ?? []).find(
      (s) => s.from === prevVersion && s.to === nextVersion,
    );
    if (!script) {
      errors.push({
        code: 'missing-upgrade-script',
        data: { pack: next.manifest.id, previous: prevVersion },
      });
    } else {
      const steps = script.steps as Step[];
      for (const change of changes) {
        if (!covered(change, steps, prevStates, prevChoices, next.manifest.id))
          errors.push({
            code: 'upgrade-script-incomplete',
            data: {
              kind: change.kind,
              id: `${next.manifest.id}:${change.id.replace(/^rules\//, '')}`,
            },
          });
      }
    }
  }
  // Output IDs are qualified: content and fields `<pack>:<id>`, state `<pack>:<owner>/<key>`,
  // choices `<pack>:<owner>/<choice>` (`<pack>:<choice>` at rules level), options
  // `<choice id>/<option>`. Sorted by kind (in the spec table's order), then ID.
  const pack = next.manifest.id;
  const qualify = (change: ShapeChange): ShapeChange => {
    const id = change.id.startsWith('rules/') ? change.id.slice('rules/'.length) : change.id;
    return { kind: change.kind, id: `${pack}:${id}` };
  };
  const order: ShapeChange['kind'][] = [
    'content-removed',
    'content-type-changed',
    'field-removed',
    'field-type-changed',
    'state-removed',
    'choice-removed',
    'option-removed',
    'choice-added',
    'standard-copy-added',
    'content-type-removed',
    'item-field-removed',
    'item-field-values-removed',
    'tag-removed',
    'action-removed',
  ];
  // A removed derived field is listed with the shape changes' `field-removed`.
  const out = [...changes, ...interfaceChanges]
    .map(qualify)
    .toSorted(
      (a, b) =>
        order.indexOf(a.kind) - order.indexOf(b.kind) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  return { ok: errors.length === 0, changes: out, errors };
}

function covered(
  change: ShapeChange,
  steps: Step[],
  prevStates: Map<string, { type?: string }>,
  prevChoices: Map<string, ChoiceInfo>,
  pack: string,
): boolean {
  const has = (pred: (s: Step) => boolean) => steps.some(pred);
  // A step's owner as choicesOf keys it: `rules` (plus the path of a rules-level nested choice),
  // or the local content ID plus the path.
  const ownerKey = (s: Step) => {
    if (s.owner === undefined) return 'rules';
    const local = s.owner.startsWith(`${pack}:`) ? s.owner.slice(pack.length + 1) : s.owner;
    return local.split('/').length % 2 === 0 ? `rules/${local}` : local;
  };
  const ownerMatches = (s: Step, owner: string) => ownerKey(s) === owner;
  switch (change.kind) {
    case 'content-removed':
      return has(
        (s) =>
          (s.op === 'renameContent' && s.from === change.id) ||
          (s.op === 'removeContent' && s.id === change.id),
      );
    case 'content-type-changed':
      return has((s) => s.op === 'removeContent' && s.id === change.id);
    case 'field-removed':
      return has(
        (s) =>
          (s.op === 'renameField' && s.from === change.id) ||
          (s.op === 'removeField' && s.field === change.id),
      );
    case 'field-type-changed':
      return has((s) => (s.op === 'mapValues' || s.op === 'removeField') && s.field === change.id);
    case 'state-removed': {
      const key = change.id.slice(change.id.lastIndexOf('/') + 1);
      const type = prevStates.get(change.id)?.type;
      // The type as the script may have renamed it first (renameContentType).
      const names = new Set([
        type,
        ...steps.filter((s) => s.op === 'renameContentType' && s.from === type).map((s) => s.to),
      ]);
      // A step limited to an item covers only that item's own key.
      const owner = change.id.slice(0, change.id.lastIndexOf('/'));
      const local = (ref: string) =>
        ref.startsWith(`${pack}:`) ? ref.slice(pack.length + 1) : ref;
      return has(
        (s) =>
          (((s.op === 'renameState' || s.op === 'moveState') && s.from === key) ||
            (s.op === 'removeState' && s.key === key)) &&
          (s.type === undefined || names.has(s.type)) &&
          (s.item === undefined || local(s.item) === owner),
      );
    }
    case 'choice-removed': {
      const info = prevChoices.get(change.id);
      return has(
        (s) =>
          ((s.op === 'renameChoice' && s.from === info?.choice.id) ||
            (s.op === 'removeChoice' && s.choice === info?.choice.id)) &&
          ownerMatches(s, info?.owner ?? ''),
      );
    }
    case 'option-removed': {
      const option = change.id.slice(change.id.lastIndexOf('/') + 1);
      const choiceKey = change.id.slice(0, change.id.lastIndexOf('/'));
      const info = prevChoices.get(choiceKey);
      return has(
        (s) =>
          s.op === 'renameOption' &&
          s.choice === info?.choice.id &&
          s.from === option &&
          ownerMatches(s, info?.owner ?? ''),
      );
    }
    case 'choice-added': {
      const owner = change.id.slice(0, change.id.lastIndexOf('/'));
      const choice = change.id.slice(change.id.lastIndexOf('/') + 1);
      // A new required choice is covered by requireChoice, or by the renameChoice that renamed an
      // existing choice to it.
      return has(
        (s) =>
          ((s.op === 'requireChoice' && s.choice === choice) ||
            (s.op === 'renameChoice' && s.to === choice)) &&
          ownerMatches(s, owner),
      );
    }
    case 'standard-copy-added':
      return has(
        (s) =>
          s.op === 'adoptStandard' && (s.item === change.id || s.item === `${pack}:${change.id}`),
      );
    default:
      return true;
  }
}

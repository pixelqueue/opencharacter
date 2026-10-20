import type { Change, OfferFollowUp } from '@opencharacter/spec';
import * as f from '../formula/index.ts';
import type { DiceFunction } from './actions.ts';
import {
  declaresFollowUp,
  type ListedFollowUp,
  storeFollowUps,
  TooManyFollowUps,
} from './follow-ups.ts';
import type { EngineError } from './load.ts';
import type {
  CharacterDoc,
  Choice,
  ChoiceTree,
  Entry,
  Formula,
  Literal,
  Situational,
  ValueDecl,
} from './pack-types.ts';
import { appliesQueries } from './pack-types.ts';
import { admitsTag, type LoadedItem, localPart, type Ruleset } from './ruleset.ts';
import { homebrewIdsInUse, withHomebrew, withoutHomebrew } from './homebrew.ts';
import {
  type ChoicePath,
  type ChoiceRecord,
  type EffectInstance,
  Failure,
  type Links,
  type RulesIssue,
  average,
  roundNumber,
  Sheet,
  type Source,
} from './sheet.ts';
import { samePath, treeFor } from './tree.ts';
import {
  pickState,
  appliedView,
  diceText,
  itemView,
  selfView,
  stateDecls,
  typedValue,
} from './views.ts';

export type { Change };

type AnyChange = { type: string } & Record<string, unknown>;

export type Adjustment =
  | {
      field: string;
      by: number;
      requested?: number;
      /** On the `requested` entry: the amount after incoming-change effects. */
      taken?: number;
      reason: 'requested' | 'absorbed' | 'overflow' | 'reset' | 'carry';
      clamped?: true;
      tags?: string[];
      rolled?: Rolled[];
    }
  | { copies: string[] }
  | { applied: string[] }
  /** A state change an incoming-change effect's `then` made to its copy. */
  | { entry: string; key: string; value: Literal; source: Source };

export interface Rolled {
  source: Source;
  dice: string;
  faces: number[];
  total: number;
}

export type ApplyResult =
  | {
      ok: true;
      character: CharacterDoc;
      changes: Change[];
      issues: RulesIssue[];
      adjustments: Adjustment[];
      followUps: ListedFollowUp[];
    }
  | { ok: false; errors: EngineError[]; issues?: RulesIssue[] };

class ChangeError extends Error {
  constructor(
    readonly code: string,
    readonly data: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

const MAX_OVERFLOW = 16;

/** Dice for one adjust: the change's `faces` first, then the dice function. */
interface Rolling {
  supplied: number[];
  next: number;
  dice: DiceFunction | undefined;
  used: number[];
}

class OutOfFaces extends Error {}

/** Each field entry's tags, for follow-ups; `adjustments` doesn't report them. */
const entryTags = new WeakMap<object, string[]>();

/** applyChanges: packages/spec/docs/engine-core.md. */
export function applyChanges(
  ruleset: Ruleset,
  character: CharacterDoc,
  changes: readonly Change[],
  strict = false,
  links: Links = {},
  dice?: DiceFunction,
): ApplyResult {
  return applyBatch(ruleset, character, changes, strict, links, dice);
}

/** Sheets by ruleset and character JSON: an action's successive batches revisit the same ones. */
export type BatchSheets = Map<Ruleset, Map<string, Sheet>>;

/** Changes that only read the sheet before writing, so it may come from `BatchSheets`. */
const READ_FIRST = new Set(['set', 'choose', 'unchoose', 'addItem']);

/** applyChanges, with the sheets of earlier batches when given. */
export function applyBatch(
  ruleset: Ruleset,
  character: CharacterDoc,
  changes: readonly Change[],
  strict = false,
  links: Links = {},
  dice?: DiceFunction,
  sheets?: BatchSheets,
): ApplyResult {
  // A batch that starts by replacing the homebrew doesn't load the old one, so a homebrew that
  // stopped loading can be fixed.
  const base = withoutHomebrew(ruleset);
  const replacing = (changes[0] as AnyChange | undefined)?.type === 'setHomebrew';
  const layered = replacing
    ? { ok: true as const, ruleset: base }
    : withHomebrew(ruleset, character);
  if (!layered.ok) return { ok: false, errors: layered.errors };
  ruleset = layered.ruleset;
  const next = structuredClone(character);
  const adjustments: Adjustment[] = [];
  const applied: Change[] = [];
  const offered: OfferFollowUp[] = [];
  for (const [index, change] of changes.entries()) {
    if ((change as AnyChange).type === 'offerFollowUp') {
      const offer = change as OfferFollowUp;
      if (!declaresFollowUp(ruleset, offer.followUp))
        return {
          ok: false,
          errors: [
            {
              code: 'unknown-follow-up',
              path: `/changes/${index}`,
              data: { followUp: offer.followUp },
            },
          ],
        };
      offered.push(offer);
      applied.push(change);
      continue;
    }
    if ((change as AnyChange).type === 'setHomebrew') {
      const set = setHomebrew(base, next, (change as AnyChange).homebrew, index);
      if (!set.ok) return { ok: false, errors: set.errors };
      ruleset = set.ruleset;
      applied.push(change);
      continue;
    }
    try {
      const patch = applyOne(ruleset, next, change as AnyChange, adjustments, links, dice, sheets);
      // An adjust comes back with the faces it used, an applyEffect with its computed state.
      applied.push(patch ? ({ ...change, ...patch } as Change) : change);
    } catch (error) {
      if (!(error instanceof ChangeError)) throw error;
      // finishCreation's issues are also returned as `issues`, as strict mode's are.
      const issues = error.code === 'creation-incomplete' ? error.data.issues : undefined;
      return {
        ok: false,
        errors: [{ code: error.code, path: `/changes/${index}`, data: error.data }],
        ...(issues ? { issues: issues as RulesIssue[] } : {}),
      };
    }
  }
  let sheet = new Sheet(ruleset, next, [], links);
  if (dropDefaultStandard(ruleset, sheet, next)) sheet = new Sheet(ruleset, next, [], links);
  const issues = sheet.issues();
  if (strict && issues.length > 0)
    return { ok: false, errors: [{ code: 'rules-issue', data: { issues } }], issues };
  let listed: ListedFollowUp[];
  try {
    listed = storeFollowUps(
      ruleset,
      character,
      sheet,
      next,
      adjustments,
      entryTags,
      links,
      offered,
    );
  } catch (error) {
    if (!(error instanceof TooManyFollowUps)) throw error;
    return {
      ok: false,
      errors: [{ code: 'safety-limit-exceeded', data: { limit: 'maxFollowUps' } }],
    };
  }
  return { ok: true, character: next, changes: applied, issues, adjustments, followUps: listed };
}

/** Rejected with `homebrew-error`, or `unknown-id` while the file names content it would lose. */
function setHomebrew(
  base: Ruleset,
  c: CharacterDoc,
  homebrew: unknown,
  index: number,
): { ok: true; ruleset: Ruleset } | { ok: false; errors: EngineError[] } {
  if (homebrew === null || homebrew === undefined) delete c.homebrew;
  else c.homebrew = structuredClone(homebrew) as NonNullable<CharacterDoc['homebrew']>;
  const layered = withHomebrew(base, c);
  if (!layered.ok)
    return {
      ok: false,
      errors: layered.errors.map((e) => ({ ...e, path: `/changes/${index}${e.path ?? ''}` })),
    };
  const { content, fields } = layered.ruleset;
  for (const id of homebrewIdsInUse(c)) {
    if (!(id in content) && !(id in fields))
      return {
        ok: false,
        errors: [{ code: 'unknown-id', path: `/changes/${index}`, data: { id } }],
      };
  }
  return { ok: true, ruleset: layered.ruleset };
}

function allEntries(c: CharacterDoc): Entry[] {
  return [...(c.features ?? []), ...(c.inventory ?? [])];
}

function usedIds(c: CharacterDoc, sheet: Sheet): Set<string> {
  return new Set([
    ...allEntries(c).map((e) => e.id),
    ...(c.applied ?? []).map((a) => a.id),
    ...sheet.standard.map((s) => s.entry),
  ]);
}

/** Writes an unsaved standard copy to the file before a change to it applies. */
function saveStandard(ruleset: Ruleset, sheet: Sheet, c: CharacterDoc, id: string) {
  const copy = sheet.standard.find((s) => s.entry === id && !s.saved);
  if (!copy || allEntries(c).some((e) => e.id === id)) return undefined;
  // Its formula state defaults, as the sheet evaluated them, are written too.
  const unsaved = allEntries(sheet.character).find((e) => e.id === id);
  const entry: Entry = {
    id,
    item: copy.item,
    ...(unsaved?.state ? { state: structuredClone(unsaved.state) } : {}),
  };
  const item = ruleset.content[copy.item];
  if (item && ruleset.contentTypes[item.type]?.carried)
    c.inventory = [...(c.inventory ?? []), entry];
  else c.features = [...(c.features ?? []), entry];
  return entry;
}

function noPicks(
  tree: Record<string, { choices?: Record<string, unknown> }[]> | undefined,
): boolean {
  return Object.values(tree ?? {}).every((picks) => picks.length === 0);
}

function dropDefaultStandard(ruleset: Ruleset, sheet: Sheet, c: CharacterDoc): boolean {
  const saved = new Set(sheet.standard.filter((s) => s.saved).map((s) => s.entry));
  if (saved.size === 0) return false;
  const atDefaults = (entry: Entry): boolean => {
    if (!saved.has(entry.id)) return false;
    if (entry.equipped === true || (entry.quantity ?? 1) !== 1) return false;
    if ((entry.templates ?? []).length > 0 || !noPicks(entry.choices)) return false;
    const item = ruleset.content[entry.item];
    if (!item) return false;
    const decls = stateDecls(ruleset, item, []);
    const view = itemView(ruleset, item, [], (n, p) => sheet.inputValue(`${p}:${n}`));
    const pack = ruleset.contentTypes[item.type]?.pack ?? item.pack;
    return Object.entries(entry.state ?? {}).every(([key, value]) => {
      const decl = decls[key];
      if (!decl || decl.default === undefined) return false;
      const formula =
        typeof decl.default === 'string' &&
        ['integer', 'decimal', 'boolean', 'dice'].includes(decl.type);
      try {
        const fallback = formula
          ? f.toData(sheet.evaluateInput(decl.default as string, pack, { item: view }))
          : decl.default;
        return JSON.stringify(fallback) === JSON.stringify(value);
      } catch (error) {
        if (error instanceof Failure) return false;
        throw error;
      }
    });
  };
  let dropped = false;
  for (const list of ['features', 'inventory'] as const) {
    const entries = c[list];
    if (!entries?.some(atDefaults)) continue;
    c[list] = entries.filter((e) => !atDefaults(e));
    dropped = true;
  }
  return dropped;
}

function num(v: f.Value | undefined): number | undefined {
  return v && (v.kind === 'int' || v.kind === 'decimal') ? v.value : undefined;
}

const PER_COPY = new Set([
  'setState',
  'adjustState',
  'setQuantity',
  'adjustQuantity',
  'equip',
  'removeItem',
]);

/** Matches in inventory-then-features file order; formulas resolve in the type's pack. */
function applyToCopies(
  ruleset: Ruleset,
  sheet: Sheet,
  c: CharacterDoc,
  change: AnyChange,
  adjustments: Adjustment[],
  links: Links,
): void {
  const query = change.copies as { type: string; where?: Formula };
  const type = ruleset.contentTypes[query.type];
  if (!type) throw new ChangeError('unknown-reference', { kind: 'content type', id: query.type });
  const limit = change.limit as number | undefined;
  const evaluate = (formula: Formula, roots: Record<string, unknown>) => {
    try {
      return sheet.evaluate(formula, type.pack, roots);
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      throw new ChangeError(error.error.code, {
        message: error.error.message,
        ...error.error.data,
      });
    }
  };
  const matches: { id: string; roots: Record<string, unknown> }[] = [];
  const batch = batchRoot(adjustments);
  // The sheet's character has the unsaved standard copies too.
  const { character } = sheet;
  for (const entry of [...(character.inventory ?? []), ...(character.features ?? [])]) {
    if (limit !== undefined && matches.length >= limit) break;
    const item = ruleset.content[entry.item];
    if (item?.type !== query.type) continue;
    const ids = sheet.templatesOf(entry);
    const templates = sheet.templateItems(entry, item);
    const roots = {
      item: itemView(ruleset, item, templates, (n, p) => sheet.inputValue(`${p}:${n}`)),
      self: selfView(entry, stateDecls(ruleset, item, templates), ids),
      batch,
    };
    if (query.where !== undefined) {
      const ok = evaluate(query.where, roots);
      if (ok.kind !== 'bool' || !ok.value) continue;
    }
    matches.push({ id: entry.id, roots });
  }
  for (const { id, roots } of matches) {
    const one: AnyChange = { ...change, entry: id };
    delete one.copies;
    delete one.limit;
    if (change.by !== undefined) one.by = f.toData(evaluate(change.by as Formula, roots));
    if (change.value !== undefined) one.value = f.toData(evaluate(change.value as Formula, roots));
    applyOne(ruleset, c, one, adjustments, links);
  }
  adjustments.push({ copies: matches.map((m) => m.id) });
}

const sixPlaces = f.roundDecimal;

function numberRoot(n: number): unknown {
  return Number.isInteger(n) ? n : f.wrapValue({ kind: 'decimal', value: f.roundDecimal(n) });
}

/** `batch`: the batch's earlier field entries, as an `on` follow-up's `change` reads one. */
function batchRoot(adjustments: Adjustment[]): { adjustments: unknown[] } {
  return {
    adjustments: adjustments.flatMap((a) =>
      'field' in a && 'reason' in a
        ? [
            {
              field: a.field,
              by: numberRoot(a.by),
              requested: numberRoot(a.requested ?? 0),
              reason: a.reason,
              clamped: a.clamped ?? false,
              tags: [...(entryTags.get(a) ?? [])],
            },
          ]
        : [],
    ),
  };
}

const PER_APPLIED = new Set(['removeEffect', 'toggleEffect', 'setState', 'adjustState']);

/** `self` is the entry with its declared defaults; formulas resolve in the source's pack. */
function applyToApplied(
  ruleset: Ruleset,
  sheet: Sheet,
  c: CharacterDoc,
  change: AnyChange,
  adjustments: Adjustment[],
  links: Links,
): void {
  const query = change.applied as { where: Formula; limit?: number };
  const evaluate = (formula: Formula, pack: string, roots: Record<string, unknown>) => {
    try {
      return sheet.evaluate(formula, pack, roots);
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      throw new ChangeError(error.error.code, {
        message: error.error.message,
        ...error.error.data,
      });
    }
  };
  const batch = batchRoot(adjustments);
  const matches: { id: string; pack: string; roots: Record<string, unknown> }[] = [];
  for (const entry of c.applied ?? []) {
    if (query.limit !== undefined && matches.length >= query.limit) break;
    const item = ruleset.content[entry.source];
    if (!item) continue;
    const pack = ruleset.contentTypes[item.type]?.pack ?? item.pack;
    const roots = {
      item: itemView(ruleset, item, [], (n, p) => sheet.inputValue(`${p}:${n}`)),
      self: appliedView(ruleset, entry),
      batch,
    };
    const ok = evaluate(query.where, pack, roots);
    if (ok.kind !== 'bool' || !ok.value) continue;
    matches.push({ id: entry.id, pack, roots });
  }
  const key = change.type === 'removeEffect' || change.type === 'toggleEffect' ? 'id' : 'entry';
  for (const { id, pack, roots } of matches) {
    const one: AnyChange = { ...change, [key]: id };
    delete one.applied;
    if (change.by !== undefined) one.by = f.toData(evaluate(change.by as Formula, pack, roots));
    if (change.value !== undefined)
      one.value = f.toData(evaluate(change.value as Formula, pack, roots));
    applyOne(ruleset, c, one, adjustments, links);
  }
  adjustments.push({ applied: matches.map((m) => m.id) });
}

/** Picks in file order: each copy's tree, then the rules-level tree, depth first. */
function applyToPicks(
  ruleset: Ruleset,
  sheet: Sheet,
  c: CharacterDoc,
  change: AnyChange,
  adjustments: Adjustment[],
  links: Links,
): void {
  const query = change.picks as { where: Formula; limit?: number };
  const evaluate = (formula: Formula, pack: string, roots: Record<string, unknown>) => {
    try {
      return sheet.evaluate(formula, pack, roots);
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      throw new ChangeError(error.error.code, {
        message: error.error.message,
        ...error.error.data,
      });
    }
  };
  const batch = batchRoot(adjustments);
  const key = String(change.key);
  const matches: {
    path: ChoicePath;
    option: string;
    pack: string;
    roots: Record<string, unknown>;
  }[] = [];
  const walk = (tree: ChoiceTree | undefined, path: ChoicePath) => {
    for (const [choice, picks] of Object.entries(tree ?? {}))
      for (const pick of picks) {
        if (query.limit !== undefined && matches.length >= query.limit) return;
        const item = typeof pick.option === 'string' ? ruleset.content[pick.option] : undefined;
        if (item && stateDecls(ruleset, item, [])[key] !== undefined) {
          const pack = ruleset.contentTypes[item.type]?.pack ?? item.pack;
          const roots = {
            item: itemView(ruleset, item, [], (n, p) => sheet.inputValue(`${p}:${n}`)),
            self: pickState(ruleset, item, pick.state),
            batch,
          };
          const ok = evaluate(query.where, pack, roots);
          if (ok.kind === 'bool' && ok.value)
            matches.push({
              path: { ...path, choice: [...path.choice, choice] },
              option: pick.option as string,
              pack,
              roots,
            });
        }
        walk(pick.choices, { ...path, choice: [...path.choice, choice, pick.option] });
      }
  };
  for (const entry of allEntries(c)) walk(entry.choices, { entry: entry.id, choice: [] });
  walk(c.choices, { choice: [] });
  for (const { path, option, pack, roots } of matches) {
    const one: AnyChange = { ...change, path, option };
    delete one.picks;
    if (change.by !== undefined) one.by = f.toData(evaluate(change.by as Formula, pack, roots));
    if (change.value !== undefined)
      one.value = f.toData(evaluate(change.value as Formula, pack, roots));
    applyOne(ruleset, c, one, adjustments, links);
  }
}

function appliedId(c: CharacterDoc, sheet: Sheet, source: string): string {
  const used = usedIds(c, sheet);
  const stem = localPart(source).replaceAll('.', '-');
  let n = 1;
  while (used.has(`${stem}-${n}`)) n++;
  return `${stem}-${n}`;
}

function keptSheet(sheets: BatchSheets, ruleset: Ruleset, c: CharacterDoc, links: Links): Sheet {
  let byCharacter = sheets.get(ruleset);
  if (!byCharacter) sheets.set(ruleset, (byCharacter = new Map()));
  const key = JSON.stringify(c);
  let sheet = byCharacter.get(key);
  if (!sheet) byCharacter.set(key, (sheet = new Sheet(ruleset, structuredClone(c), [], links)));
  return sheet;
}

function applyOne(
  ruleset: Ruleset,
  c: CharacterDoc,
  change: AnyChange,
  adjustments: Adjustment[],
  links: Links,
  dice?: DiceFunction,
  sheets?: BatchSheets,
): Record<string, unknown> | undefined {
  const sheet =
    sheets && READ_FIRST.has(change.type)
      ? keptSheet(sheets, ruleset, c, links)
      : new Sheet(ruleset, c, [], links);
  if (change.copies !== undefined && PER_COPY.has(change.type)) {
    applyToCopies(ruleset, sheet, c, change, adjustments, links);
    return;
  }
  if (change.picks !== undefined && (change.type === 'setState' || change.type === 'adjustState')) {
    applyToPicks(ruleset, sheet, c, change, adjustments, links);
    return;
  }
  if (change.applied !== undefined && PER_APPLIED.has(change.type)) {
    applyToApplied(ruleset, sheet, c, change, adjustments, links);
    return;
  }
  const str = (key: string) => change[key] as string;
  // An unsaved standard copy is written to the file first.
  const entryOf = (id: string, list?: 'inventory') => {
    saveStandard(ruleset, sheet, c, id);
    const pool = list === 'inventory' ? (c.inventory ?? []) : allEntries(c);
    const entry = pool.find((e) => e.id === id);
    if (!entry) throw new ChangeError('not-owned', { entry: id });
    return entry;
  };

  switch (change.type) {
    case 'set': {
      const qid = str('field');
      const def = inputField(ruleset, qid);
      const value = typedValue(def, change.value);
      if (typeof value === 'string')
        throw new ChangeError('wrong-type', { target: qid, expected: value });
      checkRange(sheet, qid, value);
      checkMembers(ruleset, qid, def, change.value);
      c.values = { ...c.values, [qid]: change.value as Literal };
      return;
    }
    case 'adjust': {
      const qid = str('field');
      const def = inputField(ruleset, qid);
      if (def.type !== 'integer' && def.type !== 'decimal')
        throw new ChangeError('wrong-type', { target: qid, expected: 'a number' });
      if (typeof change.by !== 'number')
        throw new ChangeError('wrong-type', { target: qid, expected: 'a number' });
      const supplied = (change.faces as number[] | undefined) ?? [];
      const rolling: Rolling = { supplied, next: 0, dice, used: [] };
      const tags = (change.tags as string[] | undefined) ?? [];
      const given = (change.situational ?? {}) as Record<string, unknown>;
      const chosen = situationalOn(ruleset, sheet, qid, tags, given);
      const counted = route(
        ruleset,
        sheet,
        c,
        qid,
        change.by,
        tags,
        adjustments,
        true,
        'requested',
        { n: 0, live: new Map() },
        rolling,
        chosen,
      );
      if (rolling.next < supplied.length)
        throw new ChangeError('faces-mismatch', {
          supplied: supplied.length,
          used: rolling.next,
        });
      applyThen(ruleset, sheet, c, counted, adjustments, links);
      return rolling.used.length > 0 ? { faces: rolling.used } : undefined;
    }
    case 'addItem': {
      const entry = structuredClone(change.entry as Entry);
      if (usedIds(c, sheet).has(entry.id)) throw new ChangeError('duplicate-id', { id: entry.id });
      const item = ruleset.content[entry.item];
      if (!item || item.type === 'template')
        throw new ChangeError('unknown-id', { id: entry.item });
      const type = ruleset.contentTypes[item.type];
      const templates = (entry.templates ?? []).map((t) => checkTemplate(ruleset, sheet, item, t));
      if (entry.equipped !== undefined && !type?.equippable)
        throw new ChangeError('not-equippable', { item: entry.item });
      checkState(ruleset, item, templates, entry.state ?? {});
      // Formula defaults are evaluated, checked against the key's bounds and saved now.
      const view = itemView(ruleset, item, templates, (n, p) => sheet.inputValue(`${p}:${n}`));
      const pack = ruleset.contentTypes[item.type]?.pack ?? item.pack;
      for (const [key, decl] of Object.entries(stateDecls(ruleset, item, templates))) {
        if (entry.state?.[key] !== undefined || typeof decl.default !== 'string') continue;
        if (!['integer', 'decimal', 'boolean', 'dice'].includes(decl.type)) continue;
        const value = sheet.evaluateInput(decl.default, pack, { item: view });
        checkStateRange(sheet, pack, view, key, decl, num(value));
        entry.state = { ...entry.state, [key]: f.toData(value) as Literal };
      }
      if (type?.carried) c.inventory = [...(c.inventory ?? []), entry];
      else c.features = [...(c.features ?? []), entry];
      if (entry.choices) checkPicks(ruleset, new Sheet(ruleset, c, [], links), entry);
      return;
    }
    case 'removeItem': {
      const id = str('entry');
      // Every character has a standard copy: it can't be removed.
      if (sheet.standard.some((s) => s.entry === id))
        throw new ChangeError('standard-copy', { entry: id });
      entryOf(id);
      c.features = (c.features ?? []).filter((e) => e.id !== id);
      c.inventory = (c.inventory ?? []).filter((e) => e.id !== id);
      return;
    }
    case 'equip': {
      const entry = entryOf(str('entry'), 'inventory');
      const item = ruleset.content[entry.item];
      if (!item || !ruleset.contentTypes[item.type]?.equippable)
        throw new ChangeError('not-equippable', { entry: entry.id });
      entry.equipped = change.equipped as boolean;
      return;
    }
    case 'setState':
    case 'adjustState': {
      let entry: { state?: Record<string, Literal> } | undefined;
      let item: LoadedItem | undefined;
      let copy: Entry | undefined;
      if (change.path !== undefined) {
        const path = change.path as ChoicePath;
        const option = change.option as string | number;
        const picks = treeFor(c, path, false)?.[String(path.choice.at(-1))] ?? [];
        entry = picks.find((p) => p.option === option);
        if (!entry) throw new ChangeError('not-picked', { option });
        item = ruleset.content[String(option)];
        if (!item) throw new ChangeError('unknown-id', { id: option });
      } else {
        const id = str('entry');
        saveStandard(ruleset, sheet, c, id);
        copy = allEntries(c).find((e) => e.id === id);
        const appliedEntry = copy ? undefined : (c.applied ?? []).find((a) => a.id === id);
        entry = copy ?? appliedEntry;
        if (!entry) throw new ChangeError('not-owned', { entry: id });
        item = ruleset.content[copy ? copy.item : (appliedEntry?.source ?? '')];
        if (!item) throw new ChangeError('unknown-id', { id: appliedEntry?.source ?? id });
      }
      const templates = copy ? sheet.templateItems(copy, item) : [];
      const decls = stateDecls(ruleset, item, templates);
      const key = str('key');
      const decl = decls[key];
      if (!decl) throw new ChangeError('unknown-state-key', { key });
      // Default, min and max are formulas over the copy's item with templates and input fields.
      const view = itemView(ruleset, item, templates, (n, p) => sheet.inputValue(`${p}:${n}`));
      const pack = ruleset.contentTypes[item.type]?.pack ?? item.pack;
      let raw: unknown = change.value;
      if (change.type === 'adjustState') {
        if (decl.type !== 'integer' && decl.type !== 'decimal')
          throw new ChangeError('wrong-type', { target: key, expected: 'a number' });
        const saved = entry.state?.[key];
        const current =
          typeof saved === 'number'
            ? saved
            : typeof decl.default === 'string'
              ? (num(sheet.evaluateInput(decl.default, pack, { item: view })) ?? 0)
              : ((decl.default as number | undefined) ?? 0);
        raw = current + (change.by as number);
      }
      const value = typedValue(decl, raw);
      if (typeof value === 'string')
        throw new ChangeError('wrong-type', { target: key, expected: value });
      checkStateRange(sheet, pack, view, key, decl, num(value));
      entry.state = { ...entry.state, [key]: raw as Literal };
      // A pick keeps only what differs from the declared default, so files stay minimal.
      if (change.path !== undefined && entry.state[key] === decl.default) {
        delete entry.state[key];
        if (Object.keys(entry.state).length === 0) delete entry.state;
      }
      return;
    }
    case 'setQuantity':
    case 'adjustQuantity': {
      // A copy at quantity 0 stays.
      const entry = entryOf(str('entry'));
      const amount = change.type === 'setQuantity' ? change.value : change.by;
      if (typeof amount !== 'number' || !Number.isInteger(amount))
        throw new ChangeError('wrong-type', { target: 'quantity', expected: 'an integer' });
      const quantity = change.type === 'setQuantity' ? amount : (entry.quantity ?? 1) + amount;
      if (quantity < 0) throw new ChangeError('out-of-range', { target: 'quantity', min: 0 });
      entry.quantity = quantity;
      return;
    }
    case 'applyTemplate': {
      const entry = entryOf(str('entry'));
      const item = ruleset.content[entry.item] as LoadedItem;
      const template = str('template');
      if ((entry.templates ?? []).includes(template))
        throw new ChangeError('duplicate-id', { id: template });
      const applied = checkTemplate(ruleset, sheet, item, template);
      entry.templates = [...(entry.templates ?? []), template];
      // The template's own formula defaults are evaluated and saved as addItem's are.
      const templates = entry.templates
        .map((t) => ruleset.content[t])
        .filter((t): t is LoadedItem => t?.type === 'template');
      const view = itemView(ruleset, item, templates, (n, p) => sheet.inputValue(`${p}:${n}`));
      const pack = ruleset.contentTypes[item.type]?.pack ?? item.pack;
      for (const [key, decl] of Object.entries(applied.state ?? {})) {
        if (entry.state?.[key] !== undefined || typeof decl.default !== 'string') continue;
        if (!['integer', 'decimal', 'boolean', 'dice'].includes(decl.type)) continue;
        const value = sheet.evaluateInput(decl.default, pack, { item: view });
        checkStateRange(sheet, pack, view, key, decl, num(value));
        entry.state = { ...entry.state, [key]: f.toData(value) as Literal };
      }
      return;
    }
    case 'removeTemplate': {
      const entry = entryOf(str('entry'));
      const template = str('template');
      if (!(entry.templates ?? []).includes(template))
        throw new ChangeError('not-picked', { option: template });
      entry.templates = (entry.templates ?? []).filter((t) => t !== template);
      const own = ruleset.content[template]?.state ?? {};
      if (entry.state) for (const key of Object.keys(own)) delete entry.state[key];
      return;
    }
    case 'applyEffect': {
      const source = str('source');
      const item = ruleset.content[source];
      if (!item || item.type === 'template') throw new ChangeError('unknown-id', { id: source });
      const view = itemView(ruleset, item, [], (n, p) => sheet.inputValue(`${p}:${n}`));
      const pack = ruleset.contentTypes[item.type]?.pack ?? item.pack;
      // A `{ formula }` value is evaluated now, with `item` the source's item and `batch`.
      let computed = false;
      const state: Record<string, Literal> = {};
      for (const [key, raw] of Object.entries((change.state ?? {}) as Record<string, unknown>)) {
        if (raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'formula' in raw) {
          computed = true;
          let value: f.Value;
          try {
            value = sheet.evaluate((raw as { formula: Formula }).formula, pack, {
              item: view,
              batch: batchRoot(adjustments),
            });
          } catch (error) {
            if (!(error instanceof Failure)) throw error;
            throw new ChangeError(error.error.code, {
              message: error.error.message,
              ...error.error.data,
            });
          }
          state[key] = f.toData(value) as Literal;
        } else state[key] = raw as Literal;
      }
      checkState(ruleset, item, [], state);
      for (const [key, decl] of Object.entries(stateDecls(ruleset, item, [])))
        if (state[key] !== undefined)
          checkStateRange(
            sheet,
            pack,
            view,
            key,
            decl,
            num(typedValue(decl, state[key]) as f.Value),
          );
      const merged = reapplied(ruleset, sheet, c, item, view, pack, state);
      if (merged !== undefined) {
        adjustments.push({ applied: [merged] });
        return computed ? { state } : undefined;
      }
      const id = change.id === undefined ? appliedId(c, sheet, source) : str('id');
      if (usedIds(c, sheet).has(id)) throw new ChangeError('duplicate-id', { id });
      const applied = {
        id,
        source,
        ...(change.active !== undefined ? { active: change.active as boolean } : {}),
        ...(change.state ? { state } : {}),
      };
      c.applied = [...(c.applied ?? []), applied];
      return computed ? { state } : undefined;
    }
    case 'removeEffect':
    case 'toggleEffect': {
      const id = str('id');
      const applied = (c.applied ?? []).find((a) => a.id === id);
      if (!applied) throw new ChangeError('not-owned', { entry: id });
      if (change.type === 'removeEffect') c.applied = (c.applied ?? []).filter((a) => a.id !== id);
      else applied.active = change.active as boolean;
      return;
    }
    case 'choose':
    case 'unchoose': {
      const path = change.path as ChoicePath;
      const record = sheet.choices.find((r) => samePath(r.path, path));
      if (!record) throw new ChangeError('unknown-choice', { path });
      const option = change.option as string | number;
      // An unchoose without `option` on a choice with no picks changes nothing.
      if (change.type === 'unchoose' && option === undefined) {
        const held = treeFor(c, path, false);
        if (!held || (held[String(path.choice.at(-1))] ?? []).length === 0) return;
      }
      if (path.entry !== undefined) saveStandard(ruleset, sheet, c, path.entry);
      const tree = treeFor(c, path, true);
      if (!tree) throw new ChangeError('unknown-choice', { path });
      const key = String(path.choice.at(-1));
      const picks = tree[key] ?? [];
      if (change.type === 'unchoose') {
        if (option === undefined) {
          if (picks.length > 0) tree[key] = [];
          return;
        }
        if (!picks.some((p) => p.option === option))
          throw new ChangeError('not-picked', { option });
        tree[key] = picks.filter((p) => p.option !== option);
        return;
      }
      if (!isOption(ruleset, sheet, record.choice, record, option))
        throw new ChangeError('invalid-option', { option });
      if (picks.some((p) => p.option === option))
        throw new ChangeError('duplicate-id', { id: option });
      tree[key] = [...picks, { option }];
      return;
    }
    case 'finishCreation': {
      // Only a character with no rules issues and no pending choices, with the batch's earlier
      // changes applied, finishes. One not being created is unchanged.
      if (c.creating !== true) return;
      const issues = [...sheet.issues(), ...sheet.pending().unfilled];
      if (issues.length > 0) throw new ChangeError('creation-incomplete', { issues });
      delete c.creating;
      return;
    }
    case 'setExtension': {
      const namespace = str('namespace');
      const extensions = { ...c.extensions };
      if (change.value === null) delete extensions[namespace];
      else extensions[namespace] = change.value;
      if (Object.keys(extensions).length > 0) c.extensions = extensions;
      else delete c.extensions;
      return;
    }
    case 'dismissFollowUp':
    case 'clearFollowUp': {
      const id = str('id');
      const stored = c.followUps ?? [];
      const at = stored.findIndex((e) => e.id === id);
      if (at < 0) {
        if (change.type === 'dismissFollowUp') throw new ChangeError('unknown-follow-up', { id });
        return;
      }
      stored.splice(at, 1);
      if (stored.length === 0) delete c.followUps;
      return;
    }
    default:
      throw new ChangeError('unknown-change-type', { type: change.type });
  }
}

function inputField(ruleset: Ruleset, qid: string) {
  const def = ruleset.fields[qid];
  if (!def) throw new ChangeError('unknown-field', { field: qid });
  if (!def.input) throw new ChangeError('not-input-field', { field: qid });
  return def;
}

function checkRange(sheet: Sheet, qid: string, value: f.Value): void {
  const def = sheet.ruleset.fields[qid];
  const n = num(value);
  if (!def || n === undefined) return;
  const min = def.min === undefined ? undefined : num(sheet.evaluate(def.min, def.pack, {}));
  const max = def.max === undefined ? undefined : num(sheet.evaluate(def.max, def.pack, {}));
  if ((min !== undefined && n < min) || (max !== undefined && n > max)) {
    throw new ChangeError('out-of-range', { target: qid, min, max });
  }
}

function checkMembers(ruleset: Ruleset, qid: string, def: ValueDecl, raw: unknown): void {
  if (def.of === 'tag' && def.members) {
    const list = def.type === 'id' ? [raw] : Array.isArray(raw) ? raw : [];
    for (const member of list.map(String))
      if (!admitsTag(def.members, member))
        throw new ChangeError('invalid-option', { field: qid, option: member });
  }
  if (def.type !== 'set' || !Array.isArray(raw)) return;
  for (const member of raw.map(String)) {
    const ok =
      def.of === 'tag'
        ? ruleset.tags.some((t) => t === member || t.startsWith(`${member}.`))
        : def.of === 'string'
          ? true
          : def.of === 'field'
            ? member in ruleset.fields
            : member in ruleset.content;
    if (!ok) throw new ChangeError('unknown-id', { id: member });
  }
}

function checkTemplate(
  ruleset: Ruleset,
  sheet: Sheet,
  item: LoadedItem,
  templateId: string,
): LoadedItem {
  const template = ruleset.content[templateId];
  if (!template || template.type !== 'template')
    throw new ChangeError('unknown-id', { id: templateId });
  const pack = template.scopes?.appliesTo ?? template.pack;
  const ok = appliesQueries(template).some((applies) => {
    if (applies.type !== item.type) return false;
    if (applies.where === undefined) return true;
    try {
      return sheet.test(applies.where, pack, {
        item: itemView(ruleset, item, [], (n, p) => sheet.inputValue(`${p}:${n}`)),
      });
    } catch {
      return false;
    }
  });
  if (!ok)
    throw new ChangeError('template-not-applicable', { template: templateId, item: item.qid });
  return template;
}

function checkStateRange(
  sheet: Sheet,
  pack: string,
  view: Record<string, unknown>,
  key: string,
  decl: ValueDecl,
  n: number | undefined,
): void {
  const bound = (formula: Formula | undefined) =>
    formula === undefined ? undefined : num(sheet.evaluateInput(formula, pack, { item: view }));
  const min = bound(decl.min);
  const max = bound(decl.max);
  if (n !== undefined && ((min !== undefined && n < min) || (max !== undefined && n > max)))
    throw new ChangeError('out-of-range', { target: key, min, max });
}

function checkState(
  ruleset: Ruleset,
  item: LoadedItem,
  templates: LoadedItem[],
  state: Record<string, Literal>,
): void {
  const decls = stateDecls(ruleset, item, templates);
  for (const [key, raw] of Object.entries(state)) {
    const decl = decls[key];
    if (!decl) throw new ChangeError('unknown-state-key', { key });
    const value = typedValue(decl, raw);
    if (typeof value === 'string')
      throw new ChangeError('wrong-type', { target: key, expected: value });
  }
}

/**
 * Merges the new state into the first active `applied` entry whose `match` keys equal it, and
 * returns its ID; undefined when an entry is to be added.
 */
function reapplied(
  ruleset: Ruleset,
  sheet: Sheet,
  c: CharacterDoc,
  item: LoadedItem,
  view: Record<string, unknown>,
  pack: string,
  state: Record<string, Literal>,
): string | undefined {
  const reapply = item.reapply ?? ruleset.contentTypes[item.type]?.reapply;
  if (!reapply) return undefined;
  const decls = stateDecls(ruleset, item, []);
  const valueOf = (saved: Record<string, Literal> | undefined, key: string) => {
    const decl = decls[key];
    if (!decl) return undefined;
    const raw =
      saved?.[key] ??
      (typeof decl.default === 'string' &&
      ['integer', 'decimal', 'boolean', 'dice'].includes(decl.type)
        ? (f.toData(sheet.evaluateInput(decl.default, pack, { item: view })) as Literal)
        : decl.default);
    if (raw === undefined) return undefined;
    const value = typedValue(decl, raw);
    return typeof value === 'string' ? undefined : { raw, value };
  };
  const same = (a: ReturnType<typeof valueOf>, b: ReturnType<typeof valueOf>) =>
    JSON.stringify(a && f.toData(a.value)) === JSON.stringify(b && f.toData(b.value));
  const existing = (c.applied ?? []).find(
    (a) =>
      a.source === item.qid &&
      a.active !== false &&
      (reapply.match ?? []).every((key) => same(valueOf(a.state, key), valueOf(state, key))),
  );
  if (!existing) return undefined;
  const next: Record<string, Literal> = { ...existing.state };
  for (const [key, policy] of Object.entries(reapply.state)) {
    const decl = decls[key] as ValueDecl;
    const old = valueOf(existing.state, key);
    const now = valueOf(state, key);
    if (now === undefined) continue;
    let raw = now.raw;
    if (old !== undefined) {
      if (policy === 'highest' && average(old.value) >= average(now.value)) raw = old.raw;
      else if (policy === 'lowest' && average(old.value) <= average(now.value)) raw = old.raw;
      else if (policy === 'add') {
        const sum = (num(old.value) ?? 0) + (num(now.value) ?? 0);
        raw = decl.type === 'integer' ? sum : sixPlaces(sum);
      }
    }
    const value = typedValue(decl, raw);
    if (typeof value === 'string')
      throw new ChangeError('wrong-type', { target: key, expected: value });
    checkStateRange(sheet, pack, view, key, decl, num(value));
    next[key] = raw;
  }
  existing.state = next;
  return existing.id;
}

function checkPicks(ruleset: Ruleset, sheet: Sheet, entry: Entry): void {
  const walk = (tree: ChoiceTree, prefix: string[]) => {
    for (const [key, picks] of Object.entries(tree)) {
      const path: ChoicePath = { entry: entry.id, choice: [...prefix, key] };
      const record = sheet.choices.find((r) => samePath(r.path, path));
      if (!record) throw new ChangeError('unknown-choice', { path });
      for (const pick of picks) {
        if (!isOption(ruleset, sheet, record.choice, record, pick.option))
          throw new ChangeError('invalid-option', { option: pick.option });
        if (pick.choices) walk(pick.choices, [...prefix, key, String(pick.option)]);
      }
    }
  };
  walk(entry.choices ?? {}, []);
}

function isOption(
  ruleset: Ruleset,
  sheet: Sheet,
  choice: Choice,
  record: ChoiceRecord,
  option: string | number,
): boolean {
  const from = choice.from;
  if ('values' in from) return sheet.valueOptions(record).includes(option);
  if ('options' in from) return from.options.some((o) => o.id === option);
  if ('items' in from) return from.items.includes(String(option));
  const item = ruleset.content[String(option)];
  return !!item && !item.hidden && item.type === from.type;
}

/** One adjust's cascade: the values its steps stored, which the sheet before it doesn't see. */
interface Chain {
  n: number;
  live: Map<string, number>;
}

/** Routes one adjust (packages/spec/docs/engine-core.md, "Routing an adjust"). */
function route(
  ruleset: Ruleset,
  sheet: Sheet,
  c: CharacterDoc,
  qid: string,
  by: number,
  tags: string[],
  adjustments: Adjustment[],
  incoming: boolean,
  reason: 'requested' | 'overflow' | 'carry',
  chain: Chain,
  rolling?: Rolling,
  chosen?: Chosen,
): EffectInstance[] {
  const def = ruleset.fields[qid];
  if (!def) throw new ChangeError('unknown-field', { field: qid });
  const settings = ruleset.rules.settings;
  let amount = by;
  const counted: EffectInstance[] = [];
  let rolledOn: Rolled[] = [];

  // 1. Incoming-change effects; the change's situational choices' effects follow the character's.
  if (incoming) {
    const incomingRoot = { amount: by, field: qid, tags: [...tags] };
    const given = chosen?.given ?? {};
    const applicable = [...sheet.instances, ...(chosen?.instances ?? [])]
      .filter((i) => {
        const t = i.effect.target;
        return typeof t !== 'string' && 'incoming' in t && matchesIncoming(t.incoming, qid, tags);
      })
      .map((i): EffectInstance => ({
        ...i,
        roots: {
          ...i.roots,
          incoming: incomingRoot,
          situational: situationalRoot(ruleset, i.pack, given),
        },
      }))
      .filter((i) => {
        try {
          return sheet.test(i.effect.when, i.pack, i.roots);
        } catch {
          return false;
        }
      });
    const value = (i: EffectInstance) =>
      num(sheet.evaluate(i.effect.value as Formula, i.pack, i.roots)) ?? 0;
    for (const op of ['set', 'add', 'multiply', 'atLeast', 'atMost']) {
      const ofOp = applicable.filter((x) => x.effect.op === op);
      const kept = sheet.applyStacking(qid, ofOp, false);
      const rolls = op === 'add' ? rollIncoming(sheet, kept, rolling) : new Map();
      if (rolls.size > 0) rolledOn = [...rolls.values()];
      for (const i of kept) {
        counted.push(i);
        const v = rolls.get(i)?.total ?? value(i);
        if (op === 'set') amount = v;
        else if (op === 'add') amount = sixPlaces(amount + v);
        else if (op === 'atLeast') amount = Math.max(amount, v);
        else if (op === 'atMost') amount = Math.min(amount, v);
        else {
          const raw = sixPlaces(amount * v);
          const mode = i.effect.rounding ?? def.rounding ?? settings.rounding ?? 'floor';
          amount =
            def.type === 'integer'
              ? settings.roundIncoming === 'magnitude'
                ? Math.sign(raw) * roundNumber(Math.abs(raw), mode)
                : roundNumber(raw, mode)
              : raw;
          if (Object.is(amount, -0)) amount = 0;
        }
      }
    }
  }

  // A cascade reads what its earlier steps stored (an overflow into the same field twice, a carry).
  const current = (field: string) => chain.live.get(field) ?? num(sheet.inputValue(field)) ?? 0;
  const bound = (field: string, which: 'min' | 'max') => {
    const d = ruleset.fields[field];
    const formula = d?.[which];
    return formula === undefined || !d ? undefined : num(sheet.evaluate(formula, d.pack, {}));
  };
  const store = (field: string, value: number) => {
    chain.live.set(field, value);
    c.values = { ...c.values, [field]: value };
  };

  const taken = amount;

  // 2. Absorbing.
  if (amount < 0) {
    for (const absorber of def.absorbedBy ?? []) {
      if (amount >= 0) break;
      const have = current(absorber);
      const floor = bound(absorber, 'min') ?? Number.NEGATIVE_INFINITY;
      const take = Math.min(sixPlaces(have - floor), -amount);
      if (take <= 0) continue;
      store(absorber, sixPlaces(have - take));
      const absorbed: Adjustment = { field: absorber, by: -take, reason: 'absorbed' };
      entryTags.set(absorbed, tags);
      adjustments.push(absorbed);
      amount = sixPlaces(amount + take);
    }
  }

  // 3. The field, 4. overflow, 5. clamping.
  const before = current(qid);
  let after = sixPlaces(before + amount);
  const min = bound(qid, 'min');
  const max = bound(qid, 'max');
  const entry: Adjustment = {
    field: qid,
    by: amount,
    ...(reason === 'requested' ? { requested: by, taken } : {}),
    reason,
    ...(rolledOn.length > 0 ? { rolled: rolledOn } : {}),
  };
  entryTags.set(entry, tags);
  const overflow = (def.overflow ?? []).find((o) => {
    if (o.at === 'max' && max !== undefined) return o.inclusive ? after >= max : after > max;
    if (o.at === 'min' && min !== undefined) return o.inclusive ? after <= min : after < min;
    return false;
  });
  if (overflow) {
    adjustments.push(entry);
    if (++chain.n > MAX_OVERFLOW)
      throw new ChangeError('safety-limit-exceeded', { limit: 'maxOverflowChain' });
    const intoBy =
      overflow.by === undefined ? 1 : (num(sheet.evaluate(overflow.by, def.pack, {})) ?? 1);
    route(
      ruleset,
      sheet,
      c,
      overflow.into,
      intoBy,
      overflow.tags ?? [],
      adjustments,
      false,
      'overflow',
      chain,
    );
    const reset = num(sheet.evaluate(overflow.reset, def.pack, {})) ?? 0;
    const jump: Adjustment = { field: qid, by: sixPlaces(reset - after), reason: 'reset' };
    entryTags.set(jump, []);
    adjustments.push(jump);
    store(qid, reset);
    // The excess past the bound carries over: routed into the field again from its reset value,
    // so it can overflow in turn.
    const edge = overflow.at === 'max' ? max : min;
    const excess = overflow.carry === true && edge !== undefined ? sixPlaces(after - edge) : 0;
    if (excess !== 0) route(ruleset, sheet, c, qid, excess, [], adjustments, false, 'carry', chain);
    return counted;
  }
  let clamped = after;
  if (min !== undefined && clamped < min) clamped = min;
  if (max !== undefined && clamped > max) clamped = max;
  if (clamped !== after) {
    entry.by = sixPlaces(clamped - before);
    entry.clamped = true;
    after = clamped;
  }
  adjustments.push(entry);
  store(qid, after);
  return counted;
}

function matchesIncoming(
  target: { fields?: string[]; tags?: string[] },
  qid: string,
  tags: string[],
): boolean {
  if (target.fields && !target.fields.includes(qid)) return false;
  const matches = (tag: string) => tags.some((t) => t === tag || t.startsWith(`${tag}.`));
  return !target.tags || target.tags.some(matches);
}

interface Chosen {
  given: Record<string, unknown>;
  /** The selected choices' incoming-change effects, routed after the character's own. */
  instances: EffectInstance[];
}

function situationalDefault(def: Situational): unknown {
  return def.default ?? (def.type === 'boolean' ? false : def.type === 'integer' ? 0 : '');
}

function situationalOn(
  ruleset: Ruleset,
  sheet: Sheet,
  qid: string,
  tags: string[],
  given: Record<string, unknown>,
): Chosen | undefined {
  if (Object.keys(given).length === 0) return undefined;
  let offered: Set<string> | undefined;
  const instances: EffectInstance[] = [];
  for (const [id, value] of Object.entries(given)) {
    const def = ruleset.rules.situational[id];
    if (!def) throw new ChangeError('unknown-id', { id });
    const typed =
      def.type === 'boolean'
        ? typeof value === 'boolean'
        : def.type === 'integer'
          ? Number.isInteger(value)
          : typeof value === 'string' && (def.values ?? []).includes(value);
    if (!typed)
      throw new ChangeError('wrong-type', {
        target: id,
        expected: def.type === 'enum' ? `one of ${(def.values ?? []).join(', ')}` : def.type,
      });
    const selected = def.type === 'boolean' ? value === true : value !== situationalDefault(def);
    if (!selected) continue;
    offered ??= new Set(sheet.situational());
    if (!offered.has(id) || !def.incoming || !matchesIncoming(def.incoming, qid, tags))
      throw new ChangeError('situational-unavailable', { situational: id });
    (def.effects ?? []).forEach((effect, index) => {
      const t = effect.target;
      if (typeof t === 'string' || !('incoming' in t)) return;
      instances.push({
        effect,
        pack: def.pack,
        roots: {},
        source: { type: 'situational', id },
        optionId: `${id}#${effect.id ?? index}`,
        sourceId: id,
        order: Number.MAX_SAFE_INTEGER,
      });
    });
  }
  return { given, instances };
}

function situationalRoot(
  ruleset: Ruleset,
  pack: string,
  given: Record<string, unknown>,
): Record<string, unknown> {
  const scope = ruleset.packs.find((p) => p.id === pack)?.scope ?? [pack];
  const out: Record<string, unknown> = {};
  for (const [qid, def] of Object.entries(ruleset.rules.situational)) {
    if (!scope.includes(def.pack)) continue;
    out[def.id] = given[qid] !== undefined ? given[qid] : situationalDefault(def);
  }
  return out;
}

const sourceOf = (i: EffectInstance): Source => ({
  ...i.source,
  ...(i.effect.id !== undefined ? { effect: i.effect.id } : {}),
});

/** Too few faces and no dice function is `faces-required`, listing every die. */
function rollIncoming(
  sheet: Sheet,
  kept: EffectInstance[],
  rolling: Rolling | undefined,
): Map<EffectInstance, Rolled> {
  const out = new Map<EffectInstance, Rolled>();
  const dice: { i: EffectInstance; value: f.DiceValue }[] = [];
  for (const i of kept) {
    const value = sheet.evaluate(i.effect.value as Formula, i.pack, i.roots);
    if (value.kind === 'dice') dice.push({ i, value: value.value });
  }
  if (dice.length === 0) return out;
  const required = () =>
    new ChangeError('faces-required', {
      dice: dice.map((d) => ({ source: sourceOf(d.i), dice: diceText(d.value) })),
      supplied: rolling?.supplied.length ?? 0,
    });
  if (!rolling) throw required();
  for (const { i, value } of dice) {
    const faces: number[] = [];
    const source: f.FaceSource = (sides, zero) => {
      let face: number | undefined;
      if (rolling.next < rolling.supplied.length) face = rolling.supplied[rolling.next++];
      else if (rolling.dice) face = rolling.dice(1, sides, zero)[0];
      if (face === undefined) throw new OutOfFaces();
      faces.push(face);
      rolling.used.push(face);
      return face;
    };
    let rolled: ReturnType<typeof f.roll>;
    try {
      rolled = f.roll(value, source);
    } catch (error) {
      if (error instanceof OutOfFaces) throw required();
      throw error;
    }
    if (!rolled.ok)
      throw new ChangeError(rolled.error.code, {
        message: rolled.error.message,
        ...rolled.error.data,
      });
    out.set(i, { source: sourceOf(i), dice: diceText(value), faces, total: rolled.value.total });
  }
  return out;
}

/** Runs once the adjust is fully routed; an instance with no copy has nothing to change. */
function applyThen(
  ruleset: Ruleset,
  sheet: Sheet,
  c: CharacterDoc,
  counted: EffectInstance[],
  adjustments: Adjustment[],
  links: Links,
): void {
  for (const i of counted.toSorted((a, b) => a.order - b.order)) {
    const entry = i.source.entry;
    if (!i.effect.then || entry === undefined) continue;
    const evaluate = (formula: Formula) => {
      try {
        return f.toData(sheet.evaluate(formula, i.pack, i.roots));
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
        throw new ChangeError(error.error.code, {
          message: error.error.message,
          ...error.error.data,
        });
      }
    };
    for (const then of i.effect.then) {
      const one: AnyChange = { type: then.type, entry, key: then.key };
      if (then.value !== undefined) one.value = evaluate(then.value);
      if (then.by !== undefined) one.by = evaluate(then.by);
      applyOne(ruleset, c, one, adjustments, links);
      const copy = allEntries(c).find((e) => e.id === entry);
      adjustments.push({
        entry,
        key: then.key,
        value: copy?.state?.[then.key] as Literal,
        source: { ...i.source, ...(i.effect.id !== undefined ? { effect: i.effect.id } : {}) },
      });
    }
  }
}

import type {
  ChoicePath,
  CompetingOptions as SpecCompetingOptions,
  FieldValue,
  Literal,
  RulesIssue,
  Source,
} from '@opencharacter/spec';
import * as f from '../formula/index.ts';
import type { EngineError } from './load.ts';
import type {
  ActionOrUse,
  CharacterDoc,
  Choice,
  ChoiceTree,
  DeclaredField,
  Effect,
  Entry,
  FieldDef,
  Formula,
  Grant,
  GrantValue,
  Immunity,
  InlineOption,
  KeptTemplate,
  Pick,
  PresetTree,
  Query,
} from './pack-types.ts';
import type { GrantStore } from '@opencharacter/spec';
import { appliesQueries } from './pack-types.ts';
import { openOptionsOn } from './options.ts';
import { isContentOnly } from './load.ts';
import {
  itemStandard,
  type LoadedItem,
  localPart,
  packOf,
  queryKey,
  evaluateTags,
  resolveContent,
  resolveField,
  resolveId,
  resolveType,
  familyIn,
  familyFieldPack,
  type Ruleset,
  rulesStandard,
  standardId,
} from './ruleset.ts';
import {
  characterQueries,
  computedDecls,
  computedRoot,
  copyRoots,
  copies,
  diceText,
  emptyValue,
  fieldSet,
  fieldSetMatches,
  fieldViews,
  hasComputedTags,
  itemView,
  outputData,
  appliedList,
  appliedView,
  selfView,
  keptTemplate,
  pickState,
  stateDecls,
  typedValue,
  writtenTags,
} from './views.ts';

export type { ChoicePath, RulesIssue, Source };

/** Another character as values: its ID and computed values by field ID. */
export interface View {
  id: string;
  values?: Record<string, unknown>;
}

export type Links = Record<string, View>;

/**
 * Another character's view as formulas read it: `id` plus each declared field, nested at the dots,
 * matched ignoring the pack prefix, else its default. Parent objects always exist, so `has()` of a
 * nested field works. A wrong-typed or duplicated value goes to `invalid` and the default is used.
 */
export function viewData(
  fields: Record<string, DeclaredField>,
  view: { id: string; values?: Record<string, unknown> | undefined },
  invalid: (field: string, key: string, expected: string) => void,
): Record<string, unknown> {
  const data: Record<string, unknown> = { id: view.id };
  const given = Object.entries(view.values ?? {});
  for (const [field, decl] of Object.entries(fields)) {
    const matches = given.filter(([key]) => key === field || localPart(key) === field);
    let value: f.Value | undefined;
    const key = matches[0]?.[0] ?? field;
    if (matches.length > 1) invalid(field, key, 'one value');
    else if (matches.length === 1) {
      const typed = typedValue(decl, (matches[0] as [string, unknown])[1]);
      if (typeof typed === 'string') invalid(field, key, typed);
      else value = typed;
    }
    if (value === undefined && decl.default !== undefined) {
      const typed = typedValue(decl, decl.default);
      if (typeof typed !== 'string') value = typed;
    }
    const parts = field.split('.');
    let node = data;
    for (const part of parts.slice(0, -1)) {
      const next = node[part];
      if (typeof next === 'object' && next !== null && !Array.isArray(next))
        node = next as Record<string, unknown>;
      else node = node[part] = {};
    }
    if (value === undefined) continue;
    node[parts.at(-1) as string] =
      value.kind === 'decimal' || value.kind === 'dice' ? f.wrapValue(value) : f.toData(value);
  }
  return data;
}

export interface Activation {
  kind: 'rules' | 'feature' | 'inventory' | 'template' | 'grant' | 'pick' | 'inline' | 'applied';
  scope: 'holder' | 'applied';
  item?: LoadedItem;
  inline?: InlineOption;
  pack: string;
  roots: Record<string, unknown>;
  entry?: Entry;
  applied?: string;
  source: Source;
  /** Used for stacking (`source`), competing option IDs and prerequisite IDs. */
  sourceId: string;
  tree: ChoiceTree;
  path: ChoicePath;
  /** Prefix of its choice keys in `tree`: '' for the tree's own item, else `<qid>/`. */
  keyPrefix?: string;
  /** `sourceId` with each slot key replaced by its declared choice ID, where nested text lives. */
  textId?: string;
  waived?: boolean;
  /**
   * The saved copy or pick whose choice tree is `tree`: where content this activation grants keeps
   * its saved state (`grants`). Absent for the rules and applied content.
   */
  node?: { grants?: GrantStore } | undefined;
  /** Picks a grant makes for this activation's own choices, evaluated; content IDs unqualified. */
  presets?: { tree: EvaluatedPresets; pack: string } | undefined;
  /** A holder grant: its `state` values, the defaults of the granted content's saved state. */
  grantDefaults?: Record<string, Literal> | undefined;
}

type EvaluatedPresets = Record<string, { option: string | number; choices?: EvaluatedPresets }[]>;

export interface ListedActivation {
  item: string;
  entry?: string;
  via: 'copy' | 'template' | 'grant' | 'pick' | 'applied';
  scope?: 'applied';
  parent?: number;
  keptBy?: number;
  path?: ChoicePath;
  /** Its declared state keys not shown (display-hints.md, "Shown"); absent when none. */
  hiddenState?: string[];
}

export interface ListedAction {
  action: string;
  entry?: string;
  source?: string;
}

export interface ListedChoice {
  path: ChoicePath;
  owner: string;
  id: string;
  slot?: { choice: string; number: number };
  type?: string;
  min: number;
  max?: number;
  picks: (string | number)[];
  open: boolean;
  preset?: true;
}

function isOpen(record: ChoiceRecord, min: number): boolean {
  return !record.preset && record.picks.length < min && record.choice.required !== false;
}

/**
 * The qualified key root of a choice's owner: the content ID, `<pack>:rules` for the rules, and for
 * a choice in an inline option the owner's root plus `.choices.<choice>.options.<option>`.
 */
export function ownerKey(choice: Choice, owner: Activation): string {
  const [base, ...rest] = (owner.textId ?? owner.sourceId).split('/');
  const pack = (choice as Choice & { pack?: string }).pack ?? owner.pack;
  let key = base === 'rules' ? `${pack}:rules` : (base as string);
  for (let i = 0; i + 1 < rest.length; i += 2)
    key += `.choices.${rest[i] as string}.options.${rest[i + 1] as string}`;
  return key;
}

export interface ChoiceRecord {
  /** A slot of a slotted choice has its own ID (`class-feat-2`). */
  choice: Choice;
  owner: Activation;
  picks: Pick[];
  path: ChoicePath;
  applicable: boolean;
  roots: Record<string, unknown>;
  slot?: { choice: string; number: number };
  /** A grant presets the choice: `picks` are the grant's, and it is never pending. */
  preset?: boolean;
}

/** A choice, or with `slots` one choice per slot in list order, keyed `<id>-<slot>`. */
export function expandSlots(
  choice: Choice,
): { choice: Choice; slot?: { choice: string; number: number } }[] {
  if (!choice.slots) return [{ choice }];
  const { slots, ...rest } = choice;
  return slots.map((number) => ({
    choice: { ...rest, id: `${choice.id}-${number}` },
    slot: { choice: choice.id, number },
  }));
}

export interface EffectInstance {
  effect: Effect;
  pack: string;
  roots: Record<string, unknown>;
  source: Source;
  /** `<sourceId>#<index or effect id>`. */
  optionId: string;
  sourceId: string;
  order: number;
  /** For a field set over computed tags: the `where`, decided per field on this sheet. */
  match?: string | number | boolean;
  matchPack?: string;
  picked?: Record<string, unknown>;
  /** For an applied activation: the applied entry its `self` is (the granting one for a grant). */
  applied?: string;
  /**
   * For picked or held granted content that declares state: its activation, whose pick or grant
   * keeps the state its `self` reads (where `then` writes those keys).
   */
  own?: Activation;
}

interface FieldResult {
  value?: f.Value;
  base?: f.Value;
  breakdown: { op: string; value: Literal; source: Source }[];
  error?: f.FormulaError;
}

interface ActiveImmunity {
  def: Immunity;
  pack: string;
  owner: Activation;
  /** The issue ID: the qualified owner plus the immunity ID, or `<pack>:<id>` for the rules'. */
  id: string;
  source: Source;
}

interface AppliedCandidate {
  id: string;
  item: LoadedItem;
  view: Record<string, unknown>;
  entry: Record<string, unknown>;
  activation: Activation;
  /** Holder and rules immunities that match it; if any, it is blocked and no candidate. */
  held: ActiveImmunity[];
  matches: Map<AppliedCandidate, ActiveImmunity[]>;
  immunities: ActiveImmunity[];
}

interface OwnedIssue {
  owner: Activation;
  issue: RulesIssue;
}

const issueOrder = [
  'prerequisite-not-met',
  'no-eligible-option',
  'constraint-failed',
  'too-many-copies',
  'choice-not-applicable',
  'too-many-picks',
  'option-not-eligible',
  'already-picked',
  'content-hidden',
  'immune',
];

export interface CopyLimitStatus {
  type: string;
  max?: number;
  perItem?: number;
  count: number;
  entries: { entry: string; item: string }[];
}

export interface CompetingOptions extends SpecCompetingOptions {
  applied: string;
}

/** Fields are typed, so a field's value is never null. */
const literal = (value: f.Value) => outputData(value) as Literal;

export class Failure extends Error {
  constructor(readonly error: f.FormulaError) {
    super(error.message);
  }
}

const MAX_DEPTH = 16;

/** An item as merged with its templates: a copy's (`entry`), or content's without a copy. */
export interface TemplatedItem {
  entry?: string;
  item: string;
  templates: string[];
  tags: string[];
  fields: Record<string, Literal>;
}

export interface StandardCopy {
  entry: string;
  item: string;
  saved: boolean;
}

const itemsByType = new WeakMap<Ruleset['content'], Map<string, LoadedItem[]>>();

function itemsOfType(ruleset: Ruleset, type: string): LoadedItem[] {
  let byType = itemsByType.get(ruleset.content);
  if (!byType) {
    byType = new Map();
    for (const item of Object.values(ruleset.content)) {
      const list = byType.get(item.type);
      if (list) list.push(item);
      else byType.set(item.type, [item]);
    }
    itemsByType.set(ruleset.content, byType);
  }
  return byType.get(type) ?? [];
}

const itemStandardIn = new WeakMap<Ruleset, boolean>();

function hasItemStandard(ruleset: Ruleset): boolean {
  let has = itemStandardIn.get(ruleset);
  if (has === undefined) {
    has = Object.values(ruleset.content).some((item) => (item.standardCopies?.length ?? 0) > 0);
    itemStandardIn.set(ruleset, has);
  }
  return has;
}

const keptIn = new WeakMap<Ruleset, boolean>();

function hasKeptTemplates(ruleset: Ruleset): boolean {
  let has = keptIn.get(ruleset);
  if (has === undefined) {
    has = Object.values(ruleset.content).some((item) => (item.keepsTemplates?.length ?? 0) > 0);
    keptIn.set(ruleset, has);
  }
  return has;
}

/** A template kept on a copy or an item, with the `params` its first keeper gave. */
export interface KeptOn {
  template: string;
  params?: Record<string, unknown>;
}

export interface Rounds {
  standard: readonly string[];
  /** Kept templates by copy instance ID. */
  kept: ReadonlyMap<string, readonly KeptOn[]>;
  /** Kept templates by the qualified ID of content without a copy. */
  content: ReadonlyMap<string, readonly KeptOn[]>;
}

function sameKept(
  a: ReadonlyMap<string, readonly KeptOn[]>,
  b: ReadonlyMap<string, readonly KeptOn[]>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [id, list] of a) {
    const other = b.get(id);
    if (other?.length !== list.length) return false;
    for (const [i, k] of list.entries())
      if (
        other[i]?.template !== k.template ||
        JSON.stringify(other[i]?.params) !== JSON.stringify(k.params)
      )
        return false;
  }
  return true;
}

/**
 * The templates found so far, each kept once per copy or item: one found again keeps its place
 * and takes the params of its first keeper this round, one new is added after.
 */
function addKept(
  found: ReadonlyMap<string, readonly KeptOn[]>,
  wanted: readonly { id: string; kept: KeptOn }[],
): Map<string, KeptOn[]> {
  const out = new Map([...found].map(([id, list]) => [id, [...list]]));
  const seen = new Set<string>();
  for (const { id, kept } of wanted) {
    const key = `${id}\0${kept.template}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = out.get(id) ?? [];
    const at = list.findIndex((k) => k.template === kept.template);
    if (at >= 0) list[at] = kept;
    else list.push(kept);
    out.set(id, list);
  }
  return out;
}

/** A merged `item` view as output data: its tags and fields. */
function mergedData(view: Record<string, unknown>): {
  tags: string[];
  fields: Record<string, Literal>;
} {
  const { id: _id, type: _type, tags, ...rest } = view;
  const fields: Record<string, Literal> = {};
  for (const [name, v] of Object.entries(rest)) fields[name] = literal(f.fromData(v));
  return { tags: [...(tags as string[])], fields };
}

function sameRounds(a: Rounds, b: Rounds): boolean {
  return (
    a.standard.length === b.standard.length &&
    sameKept(a.kept, b.kept) &&
    sameKept(a.content, b.content)
  );
}

export class Sheet {
  readonly errors: EngineError[] = [];
  readonly activations: Activation[] = [];
  readonly choices: ChoiceRecord[] = [];
  /** Each activation's children in activation order; the roots under `undefined`. */
  private readonly childrenOf = new Map<Activation | undefined, Activation[]>();
  private readonly parentOf = new Map<Activation, Activation>();
  private readonly pickedIn = new Map<Activation, ChoiceRecord>();
  private readonly walking: Activation[] = [];
  readonly instances: EffectInstance[] = [];
  readonly competing: CompetingOptions[] = [];
  private readonly byField = new Map<string, EffectInstance[]>();
  private readonly onField = new Map<string, EffectInstance[]>();
  private readonly tagResults = new Map<string, string[]>();
  private readonly results = new Map<string, FieldResult>();
  private readonly stack: string[] = [];
  private readonly suppressed = new Set<EffectInstance>();
  private readonly immune: OwnedIssue[] = [];
  /**
   * The file with each unsaved standard copy appended as `{ id, item }`, and an entry with a
   * standard copy's ID but another item left out.
   */
  readonly character!: CharacterDoc;
  readonly file: CharacterDoc;
  readonly standard: StandardCopy[] = [];
  private readonly fileIndex = new Map<Entry, number>();
  // `!`: the constructor assigns these, or returns the probe that has them.
  private readonly queries!: f.CharacterQueries;
  private readonly inputQueries!: f.CharacterQueries;
  private readonly characterRoot!: Record<string, unknown>;
  private copyData: Record<string, unknown>[] | undefined;
  private readonly inputs = new Map<string, f.Value>();
  /** Plain item views (no templates): they read input fields only, so they're fixed per sheet. */
  private readonly queryViews = new Map<LoadedItem, Record<string, unknown>>();
  private order = 0;
  private readonly picks: ReadonlySet<string>;
  private readonly linkViews = new Map<string, Record<string, unknown>>();
  private readonly linkRoots = new Map<string, Record<string, unknown>>();

  private givenLinks: Links = {};

  constructor(
    readonly ruleset: Ruleset,
    character: CharacterDoc,
    picks: readonly string[] = [],
    links: Links = {},
    fixed?: Rounds,
  ) {
    this.picks = new Set(picks);
    this.file = character;
    let found: Rounds = fixed ?? {
      standard: rulesStandard(ruleset),
      kept: new Map(),
      content: new Map(),
    };
    // `fixed` given, the sheet is a probe that finds what its active items add. Otherwise standard
    // copies and kept templates are found in rounds: what the active content adds is added, until
    // a round adds nothing.
    if (fixed === undefined && (hasItemStandard(ruleset) || hasKeptTemplates(ruleset))) {
      for (let round = 0; round < MAX_DEPTH; round++) {
        const probe = new Sheet(ruleset, character, picks, links, found);
        const errors = probe.errors.length;
        const next = probe.wanted(found);
        if (sameRounds(next, found)) {
          // The last probe was built from the rounds found, as this sheet would be: it is the
          // sheet, less the errors of reading what it adds.
          probe.errors.length = errors;
          return probe;
        }
        found = next;
      }
    }
    const items = found.standard;
    this.kept = found.kept;
    this.keptContent = found.content;
    this.character = this.withStandard(character, items);
    character = this.character;
    this.readInputs();
    this.stateDefaults();
    const views = copies(ruleset, character, this.templatesOf);
    this.queries = {
      ...characterQueries([...views.features, ...views.inventory], () => {
        this.copyData ??= copyRoots(
          ruleset,
          character,
          (n, p) => this.inputByName(n, p),
          this.templatesOf,
          this.templateItems,
        );
        return this.copyData;
      }),
      fields: () => fieldViews(ruleset),
      fieldValue: (qid) => this.fieldValue(qid),
    };
    // Activation conditions read input fields only, through the field functions too.
    this.inputQueries = {
      ...this.queries,
      fieldValue: (qid) => {
        const value = this.inputValue(qid);
        if (value === undefined)
          throw new Failure({
            code: 'unknown-name',
            message: `${qid} is not an input field, and activation conditions read only those`,
            data: { name: qid },
          });
        return value;
      },
    };
    this.characterRoot = {
      id: character.id,
      features: views.features,
      inventory: views.inventory,
      creating: character.creating === true,
      applied: appliedList(ruleset, character),
    };
    this.readLinks(links);
    this.givenLinks = links;
    this.activate();
    for (const instance of this.instances) {
      if (typeof instance.effect.target !== 'string') continue;
      const list = this.byField.get(instance.effect.target) ?? [];
      list.push(instance);
      this.byField.set(instance.effect.target, list);
    }
  }

  // --- Inputs -------------------------------------------------------------------------------

  private readInputs(): void {
    for (const pin of this.character.packs) {
      const pack = this.ruleset.packs.find((p) => p.id === pin.id);
      if (!pack) this.errors.push({ code: 'unknown-id', path: '/packs', data: { id: pin.id } });
      else if (pack.version !== pin.version) {
        this.errors.push({
          code: 'pack-version-mismatch',
          data: { pack: pin.id, expected: pin.version, actual: pack.version },
        });
      }
    }
    for (const [qid, raw] of Object.entries(this.character.values ?? {})) {
      const def = this.ruleset.fields[qid];
      const path = `/values/${qid}`;
      if (!def) this.errors.push({ code: 'unknown-field', path, data: { field: qid } });
      else if (!def.input)
        this.errors.push({ code: 'not-input-field', path, data: { field: qid } });
      else {
        const value = typedValue(def, raw);
        if (typeof value === 'string')
          this.errors.push({ code: 'wrong-type', path, data: { target: qid, expected: value } });
        else this.inputs.set(qid, value);
      }
    }
  }

  private readLinks(views: Links): void {
    const saved = this.character.links ?? {};
    for (const qid of new Set([...Object.keys(saved), ...Object.keys(views)]))
      if (!this.ruleset.rules.links[qid])
        this.errors.push({ code: 'unknown-link', path: `/links/${qid}`, data: { link: qid } });
    for (const [qid, slot] of Object.entries(this.ruleset.rules.links)) {
      const view = Object.hasOwn(views, qid) ? views[qid] : undefined;
      const id = view?.id ?? saved[qid];
      if (id === undefined) continue;
      const data = viewData(slot.fields, { id, values: view?.values }, (field, key, expected) =>
        this.errors.push({
          code: 'invalid-link-value',
          path: `/links/${qid}/values/${key}`,
          data: { link: qid, field, expected },
        }),
      );
      this.linkViews.set(qid, data);
    }
  }

  /** The slots a pack's scope sees, by name, its own first. */
  private linksRoot(pack: string): Record<string, unknown> {
    let root = this.linkRoots.get(pack);
    if (root) return root;
    root = {};
    const seen = new Set<string>();
    for (const pid of packOf(this.ruleset, pack)?.scope ?? [pack]) {
      for (const [qid, slot] of Object.entries(this.ruleset.rules.links)) {
        if (slot.pack !== pid || seen.has(slot.name)) continue;
        seen.add(slot.name);
        const view = this.linkViews.get(qid);
        if (view) root[slot.name] = view;
      }
    }
    this.linkRoots.set(pack, root);
    return root;
  }

  linkedId(qid: string): string | undefined {
    return this.linkViews.get(qid)?.id as string | undefined;
  }

  private baseRoots(pack: string): Record<string, unknown> {
    return { character: this.characterRoot, links: this.linksRoot(pack) };
  }

  inputValue(qid: string): f.Value | undefined {
    const def = this.ruleset.fields[qid];
    if (!def?.input) return undefined;
    return this.inputs.get(qid) ?? emptyValue(def);
  }

  // --- Formula contexts ---------------------------------------------------------------------

  private parse(formula: Formula): f.Node {
    if (typeof formula === 'boolean') return { type: 'bool', value: formula };
    if (typeof formula === 'number') {
      const node: f.Node = Number.isInteger(formula)
        ? { type: 'int', value: Math.abs(formula) }
        : { type: 'decimal', value: Math.abs(formula) };
      return formula < 0 ? { type: 'unary', op: '-', operand: node } : node;
    }
    const tree = cachedParse(formula);
    if (!tree.ok) throw new Failure(tree.error);
    return tree.value;
  }

  /** Throws Failure. */
  evaluate(
    formula: Formula,
    pack: string,
    roots: Record<string, unknown>,
    queries: f.CharacterQueries = this.queries,
  ): f.Value {
    const result = f.evaluate(this.parse(formula), {
      field: (name) => {
        const qid = resolveField(this.ruleset, name, pack);
        return qid ? this.fieldValue(qid) : undefined;
      },
      roots: { ...this.baseRoots(pack), ...roots },
      id: (text) => resolveId(this.ruleset, text, pack),
      family: (name) => familyIn(this.ruleset, name, pack),
      familyField: (name, key, id) => {
        const qid = resolveField(this.ruleset, id, familyFieldPack(this.ruleset, name, key, pack));
        return qid ? this.fieldValue(qid) : undefined;
      },
      character: queries,
    });
    if (!result.ok) throw new Failure(result.error);
    return result.value;
  }

  private choiceTypes: ReadonlySet<string> | undefined;

  /** A display hint's formula, with `hasChoice` bound. Throws Failure. */
  evaluateHint(formula: Formula, pack: string, roots: Record<string, unknown>): f.Value {
    this.choiceTypes ??= new Set(this.choiceList().flatMap((c) => (c.type ? [c.type] : [])));
    const types = this.choiceTypes;
    return this.evaluate(formula, pack, roots, {
      ...this.queries,
      hasChoice: (type) => {
        const qid = resolveType(this.ruleset, type, pack);
        return qid !== undefined && types.has(qid);
      },
    });
  }

  /** Reads only input fields (saved or default). Throws Failure. */
  evaluateInput(formula: Formula, pack: string, roots: Record<string, unknown>): f.Value {
    const result = f.evaluate(this.parse(formula), {
      field: (name) => {
        const qid = resolveField(this.ruleset, name, pack);
        return qid ? this.inputValue(qid) : undefined;
      },
      roots: { ...this.baseRoots(pack), ...roots },
      id: (text) => resolveId(this.ruleset, text, pack),
      family: (name) => familyIn(this.ruleset, name, pack),
    });
    if (!result.ok) throw new Failure(result.error);
    return result.value;
  }

  /** An activation formula's value: input fields and the character functions. Throws Failure. */
  private evaluateActivation(
    formula: Formula,
    pack: string,
    roots: Record<string, unknown>,
  ): f.Value {
    const result = f.evaluate(this.parse(formula), {
      field: (name) => {
        const qid = resolveField(this.ruleset, name, pack);
        return qid ? this.inputValue(qid) : undefined;
      },
      roots: { ...this.baseRoots(pack), ...roots },
      id: (text) => resolveId(this.ruleset, text, pack),
      family: (name) => familyIn(this.ruleset, name, pack),
      character: this.inputQueries,
    });
    if (!result.ok) throw new Failure(result.error);
    return result.value;
  }

  private condition(
    formula: Formula | undefined,
    pack: string,
    roots: Record<string, unknown>,
    where: string,
  ): boolean {
    if (formula === undefined) return true;
    try {
      const result = f.evaluate(this.parse(formula), {
        field: (name) => {
          const qid = resolveField(this.ruleset, name, pack);
          return qid ? this.inputValue(qid) : undefined;
        },
        roots: { ...this.baseRoots(pack), ...roots },
        id: (text) => resolveId(this.ruleset, text, pack),
        family: (name) => familyIn(this.ruleset, name, pack),
        character: this.inputQueries,
      });
      if (!result.ok) throw new Failure(result.error);
      return result.value.kind === 'bool' && result.value.value;
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      this.errors.push({
        code: error.error.code,
        data: { where, message: error.error.message, ...error.error.data },
      });
      return false;
    }
  }

  /** Errors count as false. */
  test(formula: Formula | undefined, pack: string, roots: Record<string, unknown>): boolean {
    if (formula === undefined) return true;
    const value = this.evaluate(formula, pack, roots);
    if (value.kind !== 'bool')
      throw new Failure({ code: 'type-mismatch', message: 'a condition must be a bool' });
    return value.value;
  }

  // --- Standard copies ----------------------------------------------------------------------

  /**
   * An entry with a standard copy's ID and item is that copy, saved; with another item it is
   * `duplicate-id` and left out. Unsaved copies follow the file's entries, in `items` order.
   */
  private withStandard(character: CharacterDoc, items: readonly string[]): CharacterDoc {
    const ids = new Map(items.map((qid) => [standardId(qid), qid]));
    const doc: CharacterDoc = { ...character };
    const saved = new Set<string>();
    for (const list of ['features', 'inventory'] as const) {
      const entries = character[list];
      if (!entries) continue;
      const kept: Entry[] = [];
      entries.forEach((entry, i) => {
        this.fileIndex.set(entry, i);
        const qid = ids.get(entry.id);
        if (qid !== undefined && entry.item !== qid) {
          this.errors.push({
            code: 'duplicate-id',
            path: `/${list}/${i}/id`,
            data: { id: entry.id },
          });
          return;
        }
        if (qid !== undefined) saved.add(entry.id);
        kept.push(entry);
      });
      doc[list] = kept;
    }
    for (const qid of items) {
      const id = standardId(qid);
      this.standard.push({ entry: id, item: qid, saved: saved.has(id) });
      if (saved.has(id)) continue;
      const item = this.ruleset.content[qid];
      const list = item && this.ruleset.contentTypes[item.type]?.carried ? 'inventory' : 'features';
      doc[list] = [...(doc[list] ?? []), { id, item: qid }];
    }
    return doc;
  }

  /**
   * Formula state defaults of every copy with no saved value, as `addItem` evaluates them: `item`
   * with its templates, input fields only. They go on the sheet's entry; a failing one leaves the
   * key absent.
   */
  private stateDefaults(): void {
    for (const list of ['features', 'inventory'] as const) {
      const entries = this.character[list];
      if (!entries) continue;
      this.character[list] = entries.map((entry) => {
        const item = this.ruleset.content[entry.item];
        if (!item) return entry;
        const templates = this.templateItems(entry, item);
        const decls = Object.entries(stateDecls(this.ruleset, item, templates)).filter(
          ([key, decl]) =>
            entry.state?.[key] === undefined &&
            typeof decl.default === 'string' &&
            ['integer', 'decimal', 'boolean', 'dice'].includes(decl.type),
        );
        if (decls.length === 0) return entry;
        const view = itemView(this.ruleset, item, templates, (n, p) => this.inputByName(n, p));
        const pack = this.ruleset.contentTypes[item.type]?.pack ?? item.pack;
        const state = { ...entry.state };
        for (const [key, decl] of decls) {
          const result = f.evaluate(this.parse(decl.default as string), {
            field: (name) => {
              const qid = resolveField(this.ruleset, name, pack);
              return qid ? this.inputValue(qid) : undefined;
            },
            roots: { item: view },
            id: (text) => resolveId(this.ruleset, text, pack),
            family: (name) => familyIn(this.ruleset, name, pack),
          });
          if (result.ok) state[key] = f.toData(result.value) as Literal;
        }
        const copy: Entry = { ...entry, state };
        const at = this.fileIndex.get(entry);
        if (at !== undefined) this.fileIndex.set(copy, at);
        return copy;
      });
    }
  }

  private wanted(found: Rounds): Rounds {
    const standard = new Set(found.standard);
    for (const a of this.activations)
      if (a.item) for (const qid of itemStandard(this.ruleset, a.item)) standard.add(qid);
    const kept = addKept(
      found.kept,
      this.keptWanted().map((k) => ({ id: k.entry.id, kept: k.kept })),
    );
    const content = addKept(found.content, this.keptContentWanted());
    return { standard: [...standard], kept, content };
  }

  /**
   * Whether a kept template's query matches a base item: resolved at load when it reads only
   * `item`, else an activation condition with the keeper's roots and the candidate as `item`.
   */
  private keptMatches(query: Query, pack: string, keeper: Activation, base: LoadedItem): boolean {
    if (base.type !== query.type) return false;
    const stored = this.ruleset.queries[queryKey(pack, query.type, query.where)];
    if (stored) return stored.includes(base.qid);
    if (query.where === undefined) return true;
    let view = this.queryViews.get(base);
    if (!view) {
      view = itemView(this.ruleset, base, [], (n, p) => this.inputByName(n, p));
      this.queryViews.set(base, view);
    }
    return this.condition(
      query.where,
      pack,
      { ...keeper.roots, item: view },
      `${keeper.sourceId} keepsTemplates`,
    );
  }

  /** A kept template's `params`: activation formulas with the keeper's roots. */
  private keptParams(
    kept: KeptTemplate,
    template: LoadedItem,
    pack: string,
    keeper: Activation,
  ): KeptOn {
    if (!kept.params) return { template: template.qid };
    const params: Record<string, unknown> = {};
    for (const [name, formula] of Object.entries(kept.params)) {
      try {
        let value = this.evaluateActivation(formula, pack, keeper.roots);
        if (template.params?.[name]?.type === 'decimal' && value.kind === 'int')
          value = { kind: 'decimal', value: value.value };
        params[name] =
          value.kind === 'decimal' || value.kind === 'dice' ? f.wrapValue(value) : f.toData(value);
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
        this.errors.push({
          code: error.error.code,
          data: {
            where: `${keeper.sourceId} keepsTemplates params ${name}`,
            message: error.error.message,
            ...error.error.data,
          },
        });
      }
    }
    return { template: template.qid, params };
  }

  private keptWanted(): { kept: KeptOn; entry: Entry; keeper: Activation }[] {
    const out: { kept: KeptOn; entry: Entry; keeper: Activation }[] = [];
    const entries = [...(this.character.features ?? []), ...(this.character.inventory ?? [])];
    for (const a of this.activations) {
      const item = a.item;
      if (!item?.keepsTemplates?.length) continue;
      const pack = item.scopes?.keepsTemplates ?? item.pack;
      for (const kept of item.keepsTemplates) {
        if (!kept.copies || (kept.scope ?? 'holder') !== a.scope) continue;
        if (!this.condition(kept.when, pack, a.roots, `${a.sourceId} keepsTemplates`)) continue;
        const template = this.ruleset.content[kept.template];
        if (template?.type !== 'template') continue;
        let values: KeptOn | undefined;
        for (const entry of entries) {
          const base = this.ruleset.content[entry.item];
          if (!base || !this.keptMatches(kept.copies, pack, a, base)) continue;
          if (!this.appliesTo(template, base)) continue;
          values ??= this.keptParams(kept, template, pack, a);
          out.push({ kept: values, entry, keeper: a });
        }
      }
    }
    return out;
  }

  /**
   * Templates kept on content without a copy: for each holder activation picked or granted whose
   * item an active keeper's `content` query matches, by item.
   */
  private keptContentWanted(): { id: string; kept: KeptOn }[] {
    const out: { id: string; kept: KeptOn }[] = [];
    const reached = this.activations.filter(
      (a) => (a.kind === 'pick' || a.kind === 'grant') && a.scope === 'holder' && a.item,
    );
    for (const a of this.activations) {
      const item = a.item;
      if (!item?.keepsTemplates?.length) continue;
      const pack = item.scopes?.keepsTemplates ?? item.pack;
      for (const kept of item.keepsTemplates) {
        if (!kept.content || (kept.scope ?? 'holder') !== a.scope) continue;
        if (!this.condition(kept.when, pack, a.roots, `${a.sourceId} keepsTemplates`)) continue;
        const template = this.ruleset.content[kept.template];
        if (template?.type !== 'template') continue;
        let values: KeptOn | undefined;
        for (const r of reached) {
          const base = r.item as LoadedItem;
          if (!this.keptMatches(kept.content, pack, a, base)) continue;
          if (!this.appliesTo(template, base)) continue;
          values ??= this.keptParams(kept, template, pack, a);
          out.push({ id: base.qid, kept: values });
        }
      }
    }
    return out;
  }

  private readonly keptContent!: ReadonlyMap<string, readonly KeptOn[]>;

  /**
   * The templates content keeps on an item without a copy, its keepers' `keepsFields` left out
   * and their `params` given.
   */
  contentTemplates(item: LoadedItem): LoadedItem[] {
    const kept = this.keptContent.get(item.qid);
    if (!kept?.length) return [];
    return kept.map((k) =>
      keptTemplate(
        this.ruleset,
        this.ruleset.content[k.template] as LoadedItem,
        item.qid,
        k.params,
      ),
    );
  }

  /** Picked or granted content's `item`: the item with the templates content keeps on it. */
  private contentView(item: LoadedItem): Record<string, unknown> {
    return itemView(this.ruleset, item, this.contentTemplates(item), (n, p) =>
      this.inputByName(n, p),
    );
  }

  /** The item's type and `where` (input fields only); a failing condition doesn't match. */
  private appliesTo(template: LoadedItem, item: LoadedItem): boolean {
    return appliesQueries(template).some((applies) => {
      if (applies.type !== item.type) return false;
      if (applies.where === undefined) return true;
      const pack = template.scopes?.appliesTo ?? template.pack;
      const stored = this.ruleset.queries[queryKey(pack, applies.type, applies.where)];
      if (stored) return stored.includes(item.qid);
      try {
        const view = itemView(this.ruleset, item, [], (n, p) => this.inputByName(n, p));
        const value = this.evaluateInput(applies.where, pack, { item: view });
        return value.kind === 'bool' && value.value;
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
        return false;
      }
    });
  }

  private readonly kept!: ReadonlyMap<string, readonly KeptOn[]>;

  /** The kept templates a copy doesn't have saved. */
  private keptOn(entry: Entry): readonly KeptOn[] {
    const kept = this.kept.get(entry.id);
    if (!kept?.length) return [];
    const saved = entry.templates ?? [];
    return kept.filter((k) => !saved.includes(k.template));
  }

  readonly templatesOf = (entry: Entry): readonly string[] => {
    const saved = entry.templates ?? [];
    const kept = this.keptOn(entry);
    if (kept.length === 0) return saved;
    return [...saved, ...kept.map((k) => k.template)];
  };

  /**
   * A copy's templates as merged: its saved ones (those in the ruleset), then the kept ones,
   * which leave their keepers' `keepsFields` alone and have their keepers' `params`.
   */
  readonly templateItems = (entry: Entry, item: LoadedItem): LoadedItem[] => {
    const out: LoadedItem[] = [];
    for (const t of entry.templates ?? []) {
      const template = this.ruleset.content[t];
      if (template?.type === 'template') out.push(template);
    }
    for (const k of this.keptOn(entry))
      out.push(
        keptTemplate(
          this.ruleset,
          this.ruleset.content[k.template] as LoadedItem,
          item.qid,
          k.params,
        ),
      );
    return out;
  };

  isKept(entry: Entry, template: string): boolean {
    return this.keptOn(entry).some((k) => k.template === template);
  }

  // --- Activation ---------------------------------------------------------------------------

  private activate(): void {
    const rulesTree = this.character.choices ?? {};
    const rulesChoices = Object.values(this.ruleset.rules.choices) as Choice[];
    const rules: Activation = {
      kind: 'rules',
      scope: 'holder',
      pack: '',
      roots: { [f.OWNER_PICKS]: ownerPicks(rulesChoices, rulesTree, '') },
      source: { type: 'rules' },
      sourceId: 'rules',
      tree: rulesTree,
      path: { choice: [] },
    };
    this.activations.push(rules);
    this.childOf(undefined, rules);
    for (const e of this.ruleset.rules.effects) {
      const { pack, index, ...effect } = e;
      this.instance(
        effect,
        pack,
        rules.roots,
        { type: 'rules', id: `${pack}:rules` },
        `${pack}:rules`,
        String(e.id ?? index),
      );
    }
    this.walking.push(rules);
    this.walkChoices(
      rules,
      Object.values(this.ruleset.rules.choices).map((c) => ({ choice: c as Choice, pack: c.pack })),
      0,
    );
    this.walking.pop();

    for (const [list, entries] of [
      ['features', this.character.features ?? []],
      ['inventory', this.character.inventory ?? []],
    ] as const) {
      entries.forEach((entry, at) => {
        const i = this.fileIndex.get(entry) ?? at;
        const item = this.ruleset.content[entry.item];
        if (!item) {
          this.errors.push({
            code: 'unknown-id',
            path: `/${list}/${i}/item`,
            data: { id: entry.item },
          });
          return;
        }
        const templates: LoadedItem[] = [];
        for (const t of entry.templates ?? []) {
          const template = this.ruleset.content[t];
          if (template?.type === 'template') templates.push(template);
          else
            this.errors.push({
              code: 'unknown-id',
              path: `/${list}/${i}/templates`,
              data: { id: t },
            });
        }
        const ids = this.templatesOf(entry);
        // A kept template leaves its keepers' `keepsFields` alone and has their `params`.
        for (const k of this.keptOn(entry))
          templates.push(
            keptTemplate(
              this.ruleset,
              this.ruleset.content[k.template] as LoadedItem,
              item.qid,
              k.params,
            ),
          );
        const self = selfView(entry, stateDecls(this.ruleset, item, templates), ids);
        const merged = itemView(this.ruleset, item, templates, (n, p) => this.inputByName(n, p));
        const tree = entry.choices ?? {};
        const path: ChoicePath = { entry: entry.id, choice: [] };
        this.content(
          {
            kind: list === 'features' ? 'feature' : 'inventory',
            scope: 'holder',
            item,
            pack: item.pack,
            roots: { item: merged, self },
            entry,
            source: { type: 'item', id: item.qid, entry: entry.id },
            sourceId: item.qid,
            tree,
            path,
            node: entry,
          },
          0,
        );
        const base = itemView(this.ruleset, item, [], (n, p) => this.inputByName(n, p));
        for (const template of templates) {
          this.content(
            {
              kind: 'template',
              scope: 'holder',
              item: template,
              pack: template.pack,
              roots: { item: merged, base, self },
              entry,
              source: { type: 'template', id: template.qid, entry: entry.id },
              sourceId: template.qid,
              tree,
              path,
              node: entry,
              keyPrefix: `${template.qid}/`,
            },
            0,
          );
        }
      });
    }

    // Immunities: the holder activations' block applied entries first. The other entries are
    // candidates, decided among themselves in either direction, the earliest winning a cycle.
    const held: ActiveImmunity[] = [];
    for (const a of this.activations) held.push(...this.immunitiesOf(a));

    const entries: AppliedCandidate[] = [];
    (this.character.applied ?? []).forEach((applied, i) => {
      if (applied.active === false) return;
      const item = this.ruleset.content[applied.source];
      if (!item) {
        this.errors.push({
          code: 'unknown-id',
          path: `/applied/${i}/source`,
          data: { id: applied.source },
        });
        return;
      }
      const view = itemView(this.ruleset, item, [], (n, p) => this.inputByName(n, p));
      const self = appliedView(this.ruleset, applied);
      entries.push({
        id: applied.id,
        item,
        view,
        entry: self,
        activation: {
          kind: 'applied',
          scope: 'applied',
          applied: applied.id,
          item,
          pack: item.pack,
          roots: { item: view, self },
          source: { type: 'item', id: item.qid },
          sourceId: item.qid,
          tree: {},
          path: { choice: [] },
        },
        held: held.filter((im) => this.blocks(im, item, view, self)),
        matches: new Map(),
        immunities: [],
      });
    });
    const candidates = entries.filter((e) => e.held.length === 0);
    for (const c of candidates) {
      // A candidate's immunities include those of the content its applied grants reach, except
      // grants the holder's immunities block.
      const self = c.activation.roots.self as Record<string, unknown>;
      const reach = this.appliedReach(c.activation, (g) =>
        held.some((im) => this.blocks(im, g.item as LoadedItem, g.roots.item as never, self)),
      );
      c.immunities = [c.activation, ...reach].flatMap((a) => this.immunitiesOf(a));
      const own = c.immunities;
      for (const e of entries) {
        if (e === c) continue;
        const matching = own.filter((im) => this.blocks(im, e.item, e.view, e.entry));
        if (matching.length > 0) c.matches.set(e, matching);
      }
    }
    const blockers = (e: AppliedCandidate) => candidates.filter((c) => c.matches.has(e));
    const status = new Map<AppliedCandidate, 'active' | 'blocked'>();
    const open = () => candidates.filter((c) => !status.has(c));
    while (status.size < candidates.length) {
      // Active: every candidate that blocks it is blocked.
      const free = open().filter((e) => blockers(e).every((c) => status.get(c) === 'blocked'));
      // None: every open candidate has an open blocker, so the open candidates hold a cycle; its
      // earliest member wins.
      const won =
        free.length > 0
          ? free
          : open()
              .filter((e) => this.onCycle(e, open()))
              .slice(0, 1);
      for (const e of won) status.set(e, 'active');
      for (const e of open())
        if (blockers(e).some((c) => status.get(c) === 'active')) status.set(e, 'blocked');
    }

    const active = candidates.filter((c) => status.get(c) === 'active');
    for (const e of entries) {
      if (status.get(e) === 'active') continue;
      const blocking = [...e.held, ...active.flatMap((c) => c.matches.get(e) ?? [])];
      for (const im of blocking)
        this.immune.push({
          owner: im.owner,
          issue: {
            code: 'immune',
            id: im.id,
            source: im.source,
            data: { entry: e.id, item: e.item.qid },
          },
        });
    }
    for (const c of active)
      this.grantBlockers.set(c.id, [
        ...held,
        ...active.filter((o) => o !== c).flatMap((o) => o.immunities),
      ]);
    for (const c of active) this.content(c.activation, 0);
  }

  private readonly grantBlockers = new Map<string, ActiveImmunity[]>();
  private readonly appliedChildren = new Map<Activation, Activation[]>();

  /**
   * An applied activation's `scope: applied` grants (type's, then item's) whose `when` holds, as
   * activation conditions with `self` the entry: applied activations of the same entry.
   */
  private appliedGrantsOf(a: Activation): Activation[] {
    let list = this.appliedChildren.get(a);
    if (list) return list;
    list = [];
    this.appliedChildren.set(a, list);
    const item = a.item;
    if (!item) return list;
    const type = item.type !== 'template' ? this.ruleset.contentTypes[item.type] : undefined;
    const grantPack = item.scopes?.grants ?? item.pack;
    const grants = [
      ...(type?.grants ?? []).map((grant) => ({ grant, pack: type?.pack ?? grantPack })),
      ...(item.grants ?? []).map((grant) => ({ grant, pack: grantPack })),
    ];
    for (const { grant, pack } of grants) {
      if ((grant.scope ?? 'holder') !== 'applied') continue;
      if (!this.condition(grant.when, pack, a.roots, `${a.sourceId} grant`)) continue;
      const granted = this.grantedItem(grant, pack, a.roots, `${a.sourceId} grant`);
      if (!granted) continue;
      list.push({
        ...a,
        kind: 'grant',
        waived: false,
        item: granted,
        pack: granted.pack,
        roots: {
          ...a.roots,
          item: itemView(this.ruleset, granted, [], (n, p) => this.inputByName(n, p)),
          self: this.grantedSelf(grant, pack, a.roots, `${a.sourceId} grant`).self,
        },
        presets: undefined,
        source: { type: 'item', id: granted.qid },
        sourceId: granted.qid,
        keyPrefix: `${granted.qid}/`,
      });
    }
    return list;
  }

  /**
   * A `{ formula }` grant is evaluated as an activation condition and qualified in the grant's
   * pack.
   * An empty string grants nothing; an unknown ID grants nothing with `unknown-id`.
   */
  private grantedItem(
    grant: Grant,
    pack: string,
    roots: Record<string, unknown>,
    where: string,
  ): LoadedItem | undefined {
    if (typeof grant.item === 'string') return this.ruleset.content[grant.item];
    let id: string;
    try {
      const value = this.evaluateInput(grant.item.formula, pack, roots);
      if (value.kind !== 'string')
        throw new Failure({ code: 'type-mismatch', message: 'a grant item formula is a string' });
      id = value.value;
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      this.errors.push({
        code: error.error.code,
        data: { where: `${where} item`, message: error.error.message, ...error.error.data },
      });
      return undefined;
    }
    if (id === '') return undefined;
    const qid = resolveContent(this.ruleset, id, pack);
    const item = qid ? this.ruleset.content[qid] : undefined;
    if (!item) this.errors.push({ code: 'unknown-id', data: { id, where: `${where} item` } });
    return item;
  }

  /**
   * The owner's copy or entry with the grant's `state` values in place, each an activation formula;
   * one that fails leaves the key as it was, with a `formula-error`.
   */
  private grantedSelf(
    grant: Grant,
    pack: string,
    roots: Record<string, unknown>,
    where: string,
    holder?: { granted: LoadedItem; node: Activation['node'] },
  ): { self: unknown; defaults: Record<string, Literal> } {
    const defaults: Record<string, Literal> = {};
    // Held granted content that declares state reads its grant's saved state, else the grant's
    // `state`, else the declared default, over the owner's copy, as picked content reads its pick's.
    const own = !!holder && Object.keys(stateDecls(this.ruleset, holder.granted, [])).length > 0;
    if (!grant.state && !own) return { self: roots.self, defaults };
    const self: Record<string, unknown> = {
      ...(roots.self as Record<string, unknown> | undefined),
      ...(own && holder ? pickState(this.ruleset, holder.granted, undefined) : {}),
    };
    for (const [key, formula] of Object.entries(grant.state ?? {})) {
      try {
        const value = this.evaluateInput(formula, pack, roots);
        self[key] =
          value.kind === 'decimal' || value.kind === 'dice' ? f.wrapValue(value) : f.toData(value);
        defaults[key] = f.toData(value) as Literal;
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
        this.errors.push({
          code: error.error.code,
          data: {
            where: `${where} state ${key}`,
            message: error.error.message,
            ...error.error.data,
          },
        });
      }
    }
    const saved = own && holder ? holder.node?.grants?.[holder.granted.qid]?.state : undefined;
    if (saved && holder) {
      const typed = pickState(this.ruleset, holder.granted, saved);
      for (const key of Object.keys(saved)) if (key in typed) self[key] = typed[key];
    }
    return { self, defaults };
  }

  /**
   * A grant's preset picks, each option a literal or an activation formula; one that fails, or
   * isn't a string or number, is left out with a `formula-error`.
   */
  private evaluatePresets(
    tree: PresetTree,
    pack: string,
    roots: Record<string, unknown>,
    where: string,
  ): EvaluatedPresets {
    const out: EvaluatedPresets = {};
    for (const [choice, picks] of Object.entries(tree)) {
      const list: EvaluatedPresets[string] = [];
      for (const pick of picks) {
        let option: string | number;
        if (typeof pick.option !== 'object') option = pick.option;
        else {
          try {
            const value = this.evaluateInput(pick.option.formula, pack, roots);
            if (value.kind !== 'string' && value.kind !== 'int' && value.kind !== 'decimal')
              throw new Failure({
                code: 'type-mismatch',
                message: 'a preset option is a string or a number',
              });
            option = value.kind === 'string' ? value.value : (f.toData(value) as number);
          } catch (error) {
            if (!(error instanceof Failure)) throw error;
            this.errors.push({
              code: error.error.code,
              data: {
                where: `${where} choices ${choice}`,
                message: error.error.message,
                ...error.error.data,
              },
            });
            continue;
          }
        }
        list.push({
          option,
          ...(pick.choices
            ? { choices: this.evaluatePresets(pick.choices, pack, roots, where) }
            : {}),
        });
      }
      out[choice] = list;
    }
    return out;
  }

  /**
   * A preset choice's picks: the grant's options, a content ID qualified in the grant's pack (one
   * naming no content is left out with `unknown-id`). A saved pick of the same option holds its
   * nested picks, state and grants' state.
   */
  private presetPicks(
    choice: Choice,
    presets: NonNullable<Activation['presets']>,
    saved: Pick[],
    where: string,
  ): { pick: Pick; nested?: EvaluatedPresets }[] {
    const from = choice.from;
    const content = !('values' in from) && !('options' in from);
    const out: { pick: Pick; nested?: EvaluatedPresets }[] = [];
    for (const preset of presets.tree[choice.id] ?? []) {
      let option = preset.option;
      if (content && typeof option === 'string') {
        const qid = resolveContent(this.ruleset, option, presets.pack);
        if (!qid) {
          this.errors.push({ code: 'unknown-id', data: { id: option, where } });
          continue;
        }
        option = qid;
      }
      if (out.some((p) => p.pick.option === option)) continue;
      const node = saved.find((p) => p.option === option);
      out.push({
        pick: { ...node, option },
        ...(preset.choices ? { nested: preset.choices } : {}),
      });
    }
    return out;
  }

  private appliedReach(
    a: Activation,
    blocked: (granted: Activation) => boolean,
    depth = 0,
  ): Activation[] {
    if (depth >= MAX_DEPTH) return [];
    return this.appliedGrantsOf(a)
      .filter((g) => !blocked(g))
      .flatMap((g) => [g, ...this.appliedReach(g, blocked, depth + 1)]);
  }

  private onCycle(start: AppliedCandidate, among: AppliedCandidate[]): boolean {
    const seen = new Set<AppliedCandidate>();
    const stack = [start];
    while (stack.length > 0) {
      const c = stack.pop()!;
      for (const e of among) {
        if (!c.matches.has(e)) continue;
        if (e === start) return true;
        if (!seen.has(e)) {
          seen.add(e);
          stack.push(e);
        }
      }
    }
    return false;
  }

  private immunitiesOf(a: Activation): ActiveImmunity[] {
    const out: ActiveImmunity[] = [];
    if (a.kind === 'rules') {
      for (const def of this.ruleset.rules.immuneTo) {
        const id = `${def.pack}:${def.id}`;
        if (this.condition(def.when, def.pack, {}, `${id} immunity`))
          out.push({ def, pack: def.pack, owner: a, id, source: { type: 'rules', id } });
      }
      return out;
    }
    const item = a.item;
    if (!item) return out;
    const pack = item.scopes?.immuneTo ?? item.pack;
    for (const def of item.immuneTo ?? []) {
      if ((def.scope ?? 'holder') !== a.scope) continue;
      const id = `${item.qid}/${def.id}`;
      if (this.condition(def.when, pack, a.roots, `${id} immunity`))
        out.push({ def, pack, owner: a, id, source: a.source });
    }
    return out;
  }

  private blocks(
    im: ActiveImmunity,
    item: LoadedItem,
    view: Record<string, unknown>,
    entry: Record<string, unknown>,
  ): boolean {
    if (im.def.items) return im.def.items.includes(item.qid);
    const query = im.def.query;
    if (!query || query.type !== item.type) return false;
    return this.condition(
      query.where,
      im.pack,
      { ...im.owner.roots, item: view, entry },
      `${im.id} query`,
    );
  }

  private inputByName(name: string, pack: string): f.Value | undefined {
    const qid = resolveField(this.ruleset, name, pack);
    return qid ? this.inputValue(qid) : undefined;
  }

  private content(activation: Activation, depth: number): void {
    if (depth > MAX_DEPTH) {
      this.errors.push({ code: 'safety-limit-exceeded', data: { limit: 'maxChoiceDepth' } });
      return;
    }
    // Its formulas read its own choices' picks with `picksOf`.
    const declared = activation.item?.choices ?? activation.inline?.choices ?? [];
    activation.roots = {
      ...activation.roots,
      [f.OWNER_PICKS]: ownerPicks(declared, activation.tree, activation.keyPrefix ?? ''),
    };
    this.activations.push(activation);
    this.childOf(this.walking.at(-1), activation);
    this.walking.push(activation);
    try {
      this.activateContent(activation, depth);
    } finally {
      this.walking.pop();
    }
  }

  private childOf(parent: Activation | undefined, child: Activation): void {
    if (parent) this.parentOf.set(child, parent);
    const list = this.childrenOf.get(parent);
    if (list) list.push(child);
    else this.childrenOf.set(parent, [child]);
  }

  /**
   * Pre-order: each activation's own choices in declaration order, each followed at once by the
   * choices of what it picked, then those of the activations it reaches, in activation order.
   */
  private choiceOrder(): Map<ChoiceRecord, number> {
    const own = new Map<Activation, ChoiceRecord[]>();
    for (const record of this.choices) {
      const list = own.get(record.owner);
      if (list) list.push(record);
      else own.set(record.owner, [record]);
    }
    const order = new Map<ChoiceRecord, number>();
    const visit = (a: Activation) => {
      const children = this.childrenOf.get(a) ?? [];
      for (const record of own.get(a) ?? []) {
        order.set(record, order.size);
        for (const child of children) if (this.pickedIn.get(child) === record) visit(child);
      }
      for (const child of children) {
        const record = this.pickedIn.get(child);
        if (!record || record.owner !== a) visit(child);
      }
    };
    for (const root of this.childrenOf.get(undefined) ?? []) visit(root);
    for (const record of this.choices) if (!order.has(record)) order.set(record, order.size);
    return order;
  }

  private activateContent(activation: Activation, depth: number): void {
    const item = activation.item;
    const type =
      item && item.type !== 'template' ? this.ruleset.contentTypes[item.type] : undefined;
    // Picked or held granted content with state of its own: `then` writes there, as `self` reads.
    const owner =
      item &&
      activation.scope === 'holder' &&
      (activation.kind === 'pick' || activation.kind === 'grant') &&
      Object.keys(stateDecls(this.ruleset, item, [])).length > 0
        ? activation
        : undefined;
    if (type) {
      (type.effects ?? []).forEach((effect, index) => {
        if (effect.id !== undefined && item?.suppress?.includes(effect.id)) return;
        if ((effect.scope ?? 'holder') !== activation.scope) return;
        this.instance(
          effect,
          type.pack,
          activation.roots,
          activation.source,
          activation.sourceId,
          `type.${effect.id ?? index}`,
          activation.applied,
          owner,
        );
      });
    }
    const effects = item?.effects ?? activation.inline?.effects ?? [];
    const effectPack = item ? (item.scopes?.effects ?? item.pack) : activation.pack;
    effects.forEach((effect, index) => {
      if ((effect.scope ?? 'holder') !== activation.scope) return;
      this.instance(
        effect,
        effectPack,
        activation.roots,
        activation.source,
        activation.sourceId,
        effect.id ?? String(index),
        activation.applied,
        owner,
      );
    });
    if (activation.scope === 'applied') {
      // Applied grants: each granted content is applied content too, unless an
      // immunity blocks it as it would an entry of it (reported `immune` with the entry).
      const blockers = this.grantBlockers.get(activation.applied ?? '') ?? [];
      const entry = activation.roots.self as Record<string, unknown>;
      for (const granted of this.appliedGrantsOf(activation)) {
        const content = granted.item as LoadedItem;
        const view = granted.roots.item as Record<string, unknown>;
        const blocking = blockers.filter((im) => this.blocks(im, content, view, entry));
        for (const im of blocking)
          this.immune.push({
            owner: im.owner,
            issue: {
              code: 'immune',
              id: im.id,
              source: im.source,
              data: { entry: activation.applied as string, item: content.qid },
            },
          });
        if (blocking.length === 0) this.content(granted, depth + 1);
      }
      return;
    }

    const grantPack = item ? (item.scopes?.grants ?? item.pack) : activation.pack;
    const grants = [
      ...(type?.grants ?? []).map((grant) => ({ grant, pack: type?.pack ?? grantPack })),
      ...(item?.grants ?? activation.inline?.grants ?? []).map((grant) => ({
        grant,
        pack: grantPack,
      })),
    ];
    for (const { grant, pack } of grants) {
      if ((grant.scope ?? 'holder') !== 'holder') continue;
      if (!this.condition(grant.when, pack, activation.roots, `${activation.sourceId} grant`))
        continue;
      const granted = this.grantedItem(
        grant,
        pack,
        activation.roots,
        `${activation.sourceId} grant`,
      );
      if (!granted) continue;
      const where = `${activation.sourceId} grant`;
      const { self, defaults } = this.grantedSelf(grant, pack, activation.roots, where, {
        granted,
        node: activation.node,
      });
      const presets = grant.choices
        ? { tree: this.evaluatePresets(grant.choices, pack, activation.roots, where), pack }
        : undefined;
      this.content(
        {
          ...activation,
          kind: 'grant',
          waived: grant.waivePrerequisites === true,
          item: granted,
          inline: undefined as unknown as InlineOption,
          pack: granted.pack,
          roots: {
            ...activation.roots,
            item: this.contentView(granted),
            self,
          },
          presets,
          grantDefaults: defaults,
          source: {
            type: 'item',
            id: granted.qid,
            ...(activation.entry ? { entry: activation.entry.id } : {}),
          },
          sourceId: granted.qid,
          keyPrefix: `${granted.qid}/`,
        },
        depth + 1,
      );
    }
    const choices = item?.choices ?? activation.inline?.choices ?? [];
    const choicePack = item ? (item.scopes?.choices ?? item.pack) : activation.pack;
    this.walkChoices(
      activation,
      choices.map((choice) => ({ choice, pack: choicePack })),
      depth,
    );
  }

  private pickedContent(record: ChoiceRecord, activation: Activation, depth: number): void {
    this.pickedIn.set(activation, record);
    this.content(activation, depth);
  }

  private walkChoices(
    owner: Activation,
    choices: { choice: Choice; pack: string }[],
    depth: number,
  ): void {
    const expanded = choices.flatMap(({ choice, pack }) =>
      expandSlots(choice).map((e) => ({ ...e, pack })),
    );
    for (const { choice, pack, slot } of expanded) {
      const key = `${owner.keyPrefix ?? ''}${choice.id}`;
      const saved = owner.tree[key] ?? [];
      // A choice a grant presets has the grant's picks; saved picks of the same options hold
      // what is nested under them.
      const preset =
        owner.presets && Object.hasOwn(owner.presets.tree, choice.id)
          ? this.presetPicks(choice, owner.presets, saved, `${owner.sourceId} choice ${choice.id}`)
          : undefined;
      const picks = preset ? preset.map((p) => p.pick) : saved;
      const path: ChoicePath = { ...owner.path, choice: [...owner.path.choice, key] };
      const roots = slot ? { ...owner.roots, slot: slot.number } : owner.roots;
      const applicable = this.condition(
        choice.when,
        pack,
        roots,
        `${owner.sourceId} choice ${choice.id}`,
      );
      const record: ChoiceRecord = {
        choice: { ...choice, ...(owner.kind === 'rules' ? { pack } : {}) } as Choice,
        owner,
        picks,
        path,
        applicable,
        roots,
        ...(slot ? { slot } : {}),
        ...(preset ? { preset: true } : {}),
      };
      this.choices.push(record);
      if (!applicable) continue;
      for (const [at, pick] of picks.entries()) {
        const nestedPresets = preset?.[at]?.nested;
        const own = {
          node: pick,
          presets:
            nestedPresets && owner.presets
              ? { tree: nestedPresets, pack: owner.presets.pack }
              : undefined,
          grantDefaults: undefined,
        };
        const pickRoot = { pick: { id: pick.option, value: pick.option } };
        (choice.effects ?? []).forEach((effect, index) => {
          this.instance(
            effect,
            pack,
            { ...roots, ...pickRoot },
            owner.source,
            `${owner.sourceId}/${choice.id}`,
            `${pick.option}/${effect.id ?? index}`,
          );
        });
        const nested: Pick['choices'] = pick.choices ?? {};
        const pickPath: ChoicePath = { ...owner.path, choice: [...path.choice, pick.option] };
        const from = choice.from;
        if ('options' in from) {
          const inline = from.options.find((o) => o.id === pick.option);
          if (!inline) continue;
          const sourceId = `${owner.sourceId}/${choice.id}/${inline.id}`;
          const textId = `${owner.textId ?? owner.sourceId}/${slot?.choice ?? choice.id}/${inline.id}`;
          this.pickedContent(
            record,
            {
              ...owner,
              kind: 'inline',
              waived: choice.waivePrerequisites === true,
              item: undefined as unknown as LoadedItem,
              inline,
              pack,
              roots,
              source: owner.source,
              sourceId,
              textId,
              tree: nested,
              path: pickPath,
              keyPrefix: '',
              ...own,
            },
            depth + 1,
          );
        } else if (
          choice.activate !== false &&
          typeof pick.option === 'string' &&
          this.ruleset.content[pick.option]
        ) {
          const picked = this.ruleset.content[pick.option] as LoadedItem;
          this.pickedContent(
            record,
            {
              ...owner,
              kind: 'pick',
              waived: choice.waivePrerequisites === true,
              item: picked,
              inline: undefined as unknown as InlineOption,
              pack: picked.pack,
              roots: {
                ...owner.roots,
                item: this.contentView(picked),
                // Content that declares state reads it from its pick, over the owner's copy.
                ...(Object.keys(stateDecls(this.ruleset, picked, [])).length > 0
                  ? {
                      self: {
                        ...(owner.roots.self as Record<string, unknown> | undefined),
                        ...pickState(this.ruleset, picked, pick.state),
                      },
                    }
                  : {}),
              },
              source: {
                type: 'item',
                id: picked.qid,
                ...(owner.entry ? { entry: owner.entry.id } : {}),
              },
              sourceId: picked.qid,
              tree: nested,
              path: pickPath,
              keyPrefix: '',
              ...own,
            },

            depth + 1,
          );
        }
      }
    }
  }

  private instance(
    effect: Effect,
    pack: string,
    roots: Record<string, unknown>,
    source: Source,
    sourceId: string,
    key: string,
    applied?: string,
    owner?: Activation,
  ): void {
    const own = {
      ...(applied === undefined ? {} : { applied }),
      ...(owner === undefined ? {} : { own: owner }),
    };
    const target = effect.target;
    if (typeof target === 'object' && 'fields' in target) {
      // One instance per matching field, as if written with that field as its target. A field whose
      // tags are computed is matched on this sheet, when its effects are gathered.
      const where = target.fields.where as string | number | boolean;
      const picked = readsOnlyItem(where) ? undefined : pickRoots(roots);
      for (const { id: qid, computed } of fieldSet(
        this.ruleset,
        where,
        picked,
        effect.op === 'grant',
        pack,
      ))
        this.instances.push({
          effect: { ...effect, target: qid },
          pack,
          roots,
          source,
          sourceId,
          optionId: `${sourceId}#${key}@${qid}`,
          order: this.order++,
          ...own,
          ...(computed ? { match: where, matchPack: pack, ...(picked ? { picked } : {}) } : {}),
        });
      return;
    }
    this.instances.push({
      effect,
      pack,
      roots,
      source,
      sourceId,
      optionId: `${sourceId}#${key}`,
      order: this.order++,
      ...own,
    });
  }

  /** A field's keyed `add` instances that counted: what a roll part reading it carries. */
  carried(qid: string): { instance: EffectInstance; value: f.Value }[] {
    const result = this.field(qid);
    if (result.error) return [];
    const out: { instance: EffectInstance; value: f.Value }[] = [];
    for (const instance of this.instancesOn(qid)) {
      const e = instance.effect;
      if (e.op !== 'add' || e.stackKey === undefined || this.suppressed.has(instance)) continue;
      try {
        if (!this.test(e.when, instance.pack, instance.roots)) continue;
        out.push({
          instance,
          value: this.evaluate(e.value as Formula, instance.pack, instance.roots),
        });
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
      }
    }
    return out;
  }

  /**
   * An effect on a field set reaches a field with computed tags only when its `where` holds for the
   * field's tags on this sheet. Throws Failure when those tags can't be computed.
   */
  private instancesOn(qid: string): EffectInstance[] {
    const known = this.onField.get(qid);
    if (known) return known;
    const all = this.byField.get(qid) ?? [];
    let out = all;
    if (all.some((i) => i.match !== undefined)) {
      const def = this.ruleset.fields[qid] as FieldDef;
      const view = { id: qid, type: def.type, tags: this.fieldTags(qid) };
      out = all.filter(
        (i) =>
          i.match === undefined ||
          fieldSetMatches(i.match, view, i.picked, (text) =>
            resolveId(this.ruleset, text, i.matchPack ?? i.pack),
          ),
      );
    }
    this.onField.set(qid, out);
    return out;
  }

  /** False while undecided. */
  private reaches(instance: EffectInstance): boolean {
    if (instance.match === undefined) return true;
    try {
      return this.instancesOn(instance.effect.target as string).includes(instance);
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      return false;
    }
  }

  // --- Fields -------------------------------------------------------------------------------

  /**
   * Written tags, then those the `{ formula }` entries give, without repeats. Throws Failure when a
   * formula fails or gives an undeclared tag or a value that isn't a tag.
   */
  fieldTags(qid: string): string[] {
    const known = this.tagResults.get(qid);
    if (known) return known;
    const def = this.ruleset.fields[qid];
    if (!def)
      throw new Failure({ code: 'unknown-name', message: `no field ${qid}`, data: { name: qid } });
    const result = evaluateTags(this.ruleset, def.tags, (formula) =>
      this.evaluate(formula, def.pack, {}),
    );
    if (!result.ok)
      throw new Failure({
        code: result.code as f.FormulaErrorCode,
        message: `${qid}: a computed tag failed (${result.code})`,
        data: { field: qid, ...result.data },
      });
    this.tagResults.set(qid, result.tags);
    return result.tags;
  }

  /** `fieldTags`, or the written tags when its computed tags fail. */
  sheetTags(qid: string): string[] {
    const def = this.ruleset.fields[qid] as FieldDef;
    if (!hasComputedTags(def)) return writtenTags(def.tags);
    try {
      return [...this.fieldTags(qid)];
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      return writtenTags(def.tags);
    }
  }

  /** Computed on demand. Throws Failure when the field has an error. */
  fieldValue(qid: string): f.Value {
    const result = this.field(qid);
    if (result.error) throw new Failure(result.error);
    return result.value as f.Value;
  }

  field(qid: string): FieldResult {
    const done = this.results.get(qid);
    if (done) return done;
    const def = this.ruleset.fields[qid];
    if (!def)
      return {
        breakdown: [],
        error: { code: 'unknown-name', message: `no field ${qid}`, data: { name: qid } },
      };
    if (this.stack.includes(qid)) {
      const loop = this.stack.slice(this.stack.indexOf(qid));
      throw new Failure({
        code: 'circular-formula',
        message: `fields depend on each other in a loop: ${[...loop, qid].join(' → ')}`,
        data: { fields: loop },
      });
    }
    this.stack.push(qid);
    let result: FieldResult;
    try {
      result = this.compute(qid, def);
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      result = { breakdown: [], error: error.error };
    } finally {
      this.stack.pop();
    }
    this.results.set(qid, result);
    return result;
  }

  private compute(qid: string, def: FieldDef & { pack: string }): FieldResult {
    const breakdown: FieldResult['breakdown'] = [];
    // Computed tags decide which effects reach the field, so a failing one fails it.
    if (hasComputedTags(def)) this.fieldTags(qid);
    let value: f.Value;
    if (def.input) value = this.clampInput(qid, def, this.inputValue(qid) as f.Value);
    else if (def.formula !== undefined)
      value = coerce(this.evaluate(def.formula, def.pack, {}), def);
    else value = emptyValue(def);
    const base = value;

    const active = (op: string) =>
      this.instancesOn(qid).filter(
        (i) => i.effect.op === op && this.test(i.effect.when, i.pack, i.roots),
      );

    if (def.type === 'set') {
      const members = new Set(
        (value.kind === 'list' ? value.value : []).map((v) => String(f.toData(v))),
      );
      for (const instance of active('grant')) {
        for (const member of this.grantMembers(instance)) members.add(member);
        breakdown.push({
          op: 'grant',
          value: [...this.grantMembers(instance)],
          source: instance.source,
        });
      }
      value = {
        kind: 'list',
        value: [...members].toSorted().map((m) => ({ kind: 'string', value: m }) as f.Value),
      };
    }

    const sets = this.applyStacking(qid, active('set'));
    if (sets.length > 0) {
      const options = sets.map((i) => ({
        instance: i,
        value: coerce(this.evaluate(i.effect.value as Formula, i.pack, i.roots), def),
      }));
      let chosen = options[0] as (typeof options)[number];
      if (options.length > 1) {
        const policy =
          def.recommend ?? this.ruleset.rules.settings.competing?.recommend ?? 'highest';
        let recommended = chosen;
        if (policy === 'last') recommended = options.at(-1) as typeof chosen;
        else if (policy === 'highest' || policy === 'lowest') {
          for (const o of options) {
            const d = compareValues(o.value, recommended.value);
            if (policy === 'highest' ? d > 0 : d < 0) recommended = o;
          }
        }
        const picked = options.find((o) => this.picks.has(o.instance.optionId));
        chosen = picked ?? recommended;
        this.competing.push({
          field: qid,
          op: 'set',
          options: options.map((o) => ({
            id: o.instance.optionId,
            value: literal(o.value),
            source: o.instance.source,
          })),
          recommended: recommended.instance.optionId,
          applied: chosen.instance.optionId,
        });
      }
      value = chosen.value;
      breakdown.push({ op: 'set', value: literal(value), source: chosen.instance.source });
    }

    for (const instance of this.applyStacking(qid, active('add'))) {
      const amount = this.evaluate(instance.effect.value as Formula, instance.pack, instance.roots);
      value = addValues(value, amount);
      breakdown.push({ op: 'add', value: literal(amount), source: instance.source });
    }
    for (const instance of this.applyStacking(qid, active('multiply'))) {
      const factor = this.evaluate(instance.effect.value as Formula, instance.pack, instance.roots);
      value = multiplyValues(value, factor);
      if (def.type === 'integer' && value.kind === 'decimal') {
        const mode =
          instance.effect.rounding ?? def.rounding ?? this.ruleset.rules.settings.rounding;
        value = { kind: 'int', value: roundNumber(value.value, mode ?? 'floor') };
      }
      breakdown.push({ op: 'multiply', value: literal(factor), source: instance.source });
    }
    let floorBy: { v: f.Value; s: EffectInstance } | undefined;
    for (const instance of this.applyStacking(qid, active('atLeast'))) {
      const v = this.evaluate(instance.effect.value as Formula, instance.pack, instance.roots);
      if (!floorBy || compareValues(v, floorBy.v) > 0) floorBy = { v, s: instance };
    }
    if (floorBy && compareValues(floorBy.v, value) > 0) {
      value = floorBy.v;
      breakdown.push({ op: 'atLeast', value: literal(floorBy.v), source: floorBy.s.source });
    }
    let ceilingBy: { v: f.Value; s: EffectInstance } | undefined;
    for (const instance of this.applyStacking(qid, active('atMost'))) {
      const v = this.evaluate(instance.effect.value as Formula, instance.pack, instance.roots);
      if (!ceilingBy || compareValues(v, ceilingBy.v) < 0) ceilingBy = { v, s: instance };
    }
    if (ceilingBy && compareValues(ceilingBy.v, value) < 0) {
      value = ceilingBy.v;
      breakdown.push({ op: 'atMost', value: literal(ceilingBy.v), source: ceilingBy.s.source });
    }

    if (def.type === 'integer' && value.kind === 'decimal') {
      value = {
        kind: 'int',
        value: roundNumber(
          value.value,
          def.rounding ?? this.ruleset.rules.settings.rounding ?? 'floor',
        ),
      };
    }
    if (!def.input && isNumber(value)) {
      const min = def.min === undefined ? undefined : this.evaluate(def.min, def.pack, {});
      const max = def.max === undefined ? undefined : this.evaluate(def.max, def.pack, {});
      let clamped = value.value;
      if (min && isNumber(min) && clamped < min.value) clamped = min.value;
      if (max && isNumber(max) && clamped > max.value) clamped = max.value;
      if (clamped !== value.value) value = { kind: value.kind, value: clamped };
    }
    return { value, base, breakdown };
  }

  private clampInput(qid: string, def: FieldDef & { pack: string }, value: f.Value): f.Value {
    if (!isNumber(value)) return value;
    const min = def.min === undefined ? undefined : this.evaluate(def.min, def.pack, {});
    const max = def.max === undefined ? undefined : this.evaluate(def.max, def.pack, {});
    let clamped = value.value;
    if (min && isNumber(min) && clamped < min.value) clamped = min.value;
    if (max && isNumber(max) && clamped > max.value) clamped = max.value;
    if (clamped === value.value) return value;
    this.errors.push({
      code: 'out-of-range',
      path: `/values/${qid}`,
      data: { target: qid, min: min && f.toData(min), max: max && f.toData(max) },
    });
    return { kind: value.kind, value: clamped };
  }

  private grantMembers(instance: EffectInstance): string[] {
    const v = instance.effect.value as GrantValue;
    if (v.item !== undefined) return [v.item];
    if (v.tag !== undefined) return [v.tag];
    if (v.field !== undefined) return [v.field];
    if (v.query)
      return this.queryMatches(v.query.type, v.query.where, instance.pack, instance.roots);
    if (v.formula !== undefined)
      return [String(f.toData(this.evaluate(v.formula, instance.pack, instance.roots)))];
    return [];
  }

  queryMatches(
    type: string,
    where: Formula | undefined,
    pack: string,
    roots: Record<string, unknown>,
  ): string[] {
    const stored = this.ruleset.queries[queryKey(pack, type, where)];
    if (stored) return stored;
    const matches: string[] = [];
    for (const item of itemsOfType(this.ruleset, type)) {
      if (item.hidden) continue;
      if (where === undefined) {
        matches.push(item.qid);
        continue;
      }
      let view = this.queryViews.get(item);
      if (!view) {
        view = itemView(this.ruleset, item, [], (n, p) => this.inputByName(n, p));
        this.queryViews.set(item, view);
      }
      if (this.test(where, pack, { ...roots, item: view })) matches.push(item.qid);
    }
    return matches;
  }

  /**
   * With `report` off (incoming changes), nothing is recorded as competing or suppressed and
   * `playerChooses` keeps the recommended instance.
   */
  applyStacking(target: string, instances: EffectInstance[], report = true): EffectInstance[] {
    const groups = new Map<string, EffectInstance[]>();
    const out: EffectInstance[] = [];
    for (const instance of instances) {
      const key = instance.effect.stackKey;
      if (key === undefined) {
        out.push(instance);
        continue;
      }
      const group = `${key === 'source' ? instance.sourceId : key}`;
      groups.set(group, [...(groups.get(group) ?? []), instance]);
    }
    const settings = this.ruleset.rules.settings.stacking;
    for (const [, group] of groups) {
      const key = group[0]?.effect.stackKey as string;
      const policy = settings?.keys?.[key] ?? settings?.default ?? 'addAll';
      if (policy === 'addAll' || group.length === 1) {
        out.push(...group);
        continue;
      }
      const valued = group.map((i) => {
        const value = this.evaluate(i.effect.value as Formula, i.pack, i.roots);
        return { i, value, v: average(value) };
      });
      let best = valued[0] as (typeof valued)[number];
      for (const c of valued) if (policy === 'lowestOnly' ? c.v < best.v : c.v > best.v) best = c;
      let chosen = best.i;
      if (policy === 'playerChooses' && report) {
        const picked = group.find((i) => this.picks.has(i.optionId));
        chosen = picked ?? best.i;
        this.competing.push({
          field: target,
          op: best.i.effect.op as CompetingOptions['op'],
          stackKey: key,
          options: valued.map((c) => ({
            id: c.i.optionId,
            value: literal(c.value),
            source: c.i.source,
          })),
          recommended: best.i.optionId,
          applied: chosen.optionId,
        });
      }
      out.push(chosen);
      if (report) for (const i of group) if (i !== chosen) this.suppressed.add(i);
    }
    return out.toSorted((a, b) => a.order - b.order);
  }

  // --- Output -------------------------------------------------------------------------------

  values(): Record<string, FieldValue> {
    const out: Record<string, FieldValue> = {};
    for (const qid of Object.keys(this.ruleset.fields)) {
      const r = this.field(qid);
      // The written tags when its computed tags fail. Left out when it has none.
      const tags = this.sheetTags(qid);
      const named = this.nameOf(qid);
      out[qid] = r.error
        ? {
            error: { code: r.error.code, data: { message: r.error.message, ...r.error.data } },
            breakdown: [],
            ...(tags.length > 0 ? { tags } : {}),
          }
        : {
            value: literal(r.value as f.Value),
            base: literal(r.base as f.Value),
            breakdown: r.breakdown,
            ...(tags.length > 0 ? { tags } : {}),
            ...(named !== undefined ? { name: named } : {}),
          };
    }
    return out;
  }

  private nameOf(qid: string): string | undefined {
    const from = this.ruleset.fields[qid]?.nameFrom;
    if (from === undefined || !this.ruleset.fields[from]) return undefined;
    const v = this.field(from);
    return !v.error && v.value?.kind === 'string' && v.value.value.trim() !== ''
      ? v.value.value
      : undefined;
  }

  /**
   * A count sets both; `{ min, max }` defaults to 0 and unbounded; the default is 1. A count that
   * fails to evaluate leaves the default.
   */
  private pickCounts(record: ChoiceRecord): { min: number; max?: number } {
    const { choice, owner, roots } = record;
    const pack = (choice as Choice & { pack?: string }).pack ?? owner.pack;
    let min = 1;
    let max: number | undefined = 1;
    try {
      const count = (formula: Formula) => {
        const v = this.evaluate(formula, pack, roots);
        return isNumber(v) ? v.value : 0;
      };
      if (typeof choice.pick === 'object') {
        min = choice.pick.min === undefined ? 0 : count(choice.pick.min);
        max = choice.pick.max === undefined ? undefined : count(choice.pick.max);
      } else if (choice.pick !== undefined) {
        min = count(choice.pick);
        max = min;
      }
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
    }
    return max === undefined ? { min } : { min, max };
  }

  /**
   * Every applicable choice in pending order, answered or not, inline options' and
   * `activate: false` ones included, each slot on its own.
   */
  choiceList(): ListedChoice[] {
    const order = this.choiceOrder();
    return this.choices
      .filter((record) => record.applicable)
      .toSorted((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      .map((record) => {
        const { min, max } = this.pickCounts(record);
        const type = this.choiceType(record.choice);
        return {
          path: record.path,
          owner: ownerKey(record.choice, record.owner),
          id: record.choice.id,
          ...(record.slot ? { slot: { ...record.slot } } : {}),
          ...(type !== undefined ? { type } : {}),
          min,
          ...(max === undefined ? {} : { max }),
          picks: record.picks.map((pick) => pick.option),
          open: isOpen(record, min),
          ...(record.preset ? { preset: true as const } : {}),
        };
      });
  }

  /** A query's type, or the one type every listed item shares; none for options and values. */
  private choiceType(choice: Choice): string | undefined {
    const from = choice.from;
    if ('values' in from || 'options' in from) return undefined;
    if (!('items' in from)) return from.type;
    const types = new Set(from.items.map((id) => this.ruleset.content[id]?.type));
    const [only] = types;
    return types.size === 1 && only !== undefined ? only : undefined;
  }

  pending(): {
    pending: {
      path: ChoicePath;
      min: number;
      max?: number;
      picked: number;
      slot?: { choice: string; number: number };
    }[];
    issues: OwnedIssue[];
    unfilled: RulesIssue[];
  } {
    const pending: {
      path: ChoicePath;
      min: number;
      max?: number;
      picked: number;
      slot?: { choice: string; number: number };
    }[] = [];
    const issues: OwnedIssue[] = [];
    const unfilled: RulesIssue[] = [];
    const order = this.choiceOrder();
    const ranks: number[] = [];
    for (const record of this.choices) {
      const { choice, owner, picks, path } = record;
      const source = owner.source;
      const pack = (choice as Choice & { pack?: string }).pack ?? owner.pack;
      if (!record.applicable) {
        if (picks.length > 0)
          issues.push({
            owner,
            issue: { code: 'choice-not-applicable', id: choiceId(owner, choice), source },
          });
        continue;
      }
      const { min, max } = this.pickCounts(record);
      if (isOpen(record, min)) {
        ranks.push(order.get(record) ?? 0);
        pending.push({
          path,
          min,
          ...(max === undefined ? {} : { max }),
          picked: picks.length,
          ...(record.slot ? { slot: { ...record.slot } } : {}),
        });
        unfilled.push({
          code: 'too-few-picks',
          id: choiceId(owner, choice),
          source,
          data: { path, min, picked: picks.length },
        });
      }
      if (max !== undefined && picks.length > max) {
        issues.push({
          owner,
          issue: { code: 'too-many-picks', id: choiceId(owner, choice), source, data: { max } },
        });
      }
      const from = choice.from;
      const reported = new Set<string | number>();
      const notEligible = (option: string | number) =>
        !reported.has(option) &&
        reported.add(option) &&
        issues.push({
          owner,
          issue: {
            code: 'option-not-eligible',
            id: choiceId(owner, choice),
            source,
            data: { option },
          },
        });
      if ('values' in from) {
        const listed = Array.isArray(from.values) ? undefined : this.valueOptions(record);
        for (const pick of picks) {
          if (listed && !listed.includes(pick.option)) notEligible(pick.option);
          else if (!this.valueEligible(record, pick.option)) notEligible(pick.option);
        }
      }
      if (choice.activate === false && !('values' in from) && !('options' in from)) {
        // Picks that aren't activated are still reported when hidden.
        for (const pick of picks) {
          const item =
            typeof pick.option === 'string' ? this.ruleset.content[pick.option] : undefined;
          if (item?.hidden)
            issues.push({
              owner,
              issue: {
                code: 'content-hidden',
                id: item.qid,
                source: {
                  type: 'item',
                  id: item.qid,
                  ...(owner.entry ? { entry: owner.entry.id } : {}),
                },
              },
            });
        }
      }
      if ('type' in from) {
        // The query runs once per choice, not once per pick; a failing query matches nothing.
        let matches: ReadonlySet<string> | undefined;
        for (const pick of picks) {
          if (typeof pick.option !== 'string') continue;
          if (!matches) {
            try {
              matches = new Set(
                this.queryMatches(from.type, from.where, pack, this.ownRoots(record)),
              );
            } catch (error) {
              if (!(error instanceof Failure)) throw error;
              matches = new Set();
            }
          }
          if (!matches.has(pick.option)) notEligible(pick.option);
        }
      }
      if (choice.eligible !== undefined && !('options' in from))
        for (const pick of picks)
          if (!this.optionEligible(record, pick.option)) notEligible(pick.option);
    }
    const byRank = <T>(list: T[]) =>
      list
        .map((value, i) => ({ value, rank: ranks[i] ?? 0 }))
        .toSorted((a, b) => a.rank - b.rank)
        .map((x) => x.value);
    return { pending: byRank(pending), issues, unfilled: byRank(unfilled) };
  }

  /** The written list, or its formula's strings and numbers, each once; failing, none. */
  valueOptions(record: ChoiceRecord): (string | number)[] {
    const from = record.choice.from;
    if (!('values' in from)) return [];
    if (Array.isArray(from.values)) return from.values;
    const pack = (record.choice as Choice & { pack?: string }).pack ?? record.owner.pack;
    try {
      const data = f.toData(this.evaluate(from.values.formula, pack, this.ownRoots(record)));
      if (!Array.isArray(data)) return [];
      const out: (string | number)[] = [];
      for (const v of data) {
        if (typeof v !== 'string' && typeof v !== 'number') return [];
        if (!out.includes(v)) out.push(v);
      }
      return out;
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      return [];
    }
  }

  valueEligible(record: ChoiceRecord, value: string | number): boolean {
    const from = record.choice.from;
    if (!('values' in from) || from.where === undefined) return true;
    const pack = (record.choice as Choice & { pack?: string }).pack ?? record.owner.pack;
    try {
      return this.test(from.where, pack, { ...this.ownRoots(record), value });
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      return false;
    }
  }

  /** The owner's roots plus `choice`: `path`, `owner`, `id`, `slot` and its own `picks`. */
  ownRoots(record: ChoiceRecord): Record<string, unknown> {
    return {
      ...record.roots,
      choice: {
        path: record.path,
        owner: ownerKey(record.choice, record.owner),
        id: record.choice.id,
        ...(record.slot ? { slot: { ...record.slot } } : {}),
        picks: record.picks.map((p) => p.option),
      },
    };
  }

  /** `item` is the content option's item, `value` the value; a failing condition doesn't hold. */
  optionEligible(record: ChoiceRecord, option: string | number): boolean {
    const choice = record.choice;
    if (choice.eligible === undefined) return true;
    const pack = (choice as Choice & { pack?: string }).pack ?? record.owner.pack;
    const roots = this.ownRoots(record);
    if ('values' in choice.from) roots.value = option;
    else {
      const item = typeof option === 'string' ? this.ruleset.content[option] : undefined;
      if (!item) return false;
      roots.item = itemView(this.ruleset, item, [], (n, p) => this.inputByName(n, p));
    }
    try {
      return this.test(choice.eligible, pack, roots);
    } catch (error) {
      if (!(error instanceof Failure)) throw error;
      return false;
    }
  }

  repeatable(option: string | number): boolean {
    return typeof option === 'string' && this.ruleset.content[option]?.repeatable === true;
  }

  /**
   * A local key is the declaring pack's, a qualified one as written. A group scoped to the owner is
   * one group per owner activation: the key plus where its choices live.
   */
  uniqueKey(record: ChoiceRecord): string | undefined {
    const unique = record.choice.unique;
    if (unique === undefined) return undefined;
    const pack = (record.choice as Choice & { pack?: string }).pack ?? record.owner.pack;
    const key = unique.includes(':') ? unique : `${pack}:${unique}`;
    if (record.choice.uniqueScope !== 'owner') return key;
    const { owner } = record;
    return `${key} ${JSON.stringify([owner.path, owner.keyPrefix ?? ''])}`;
  }

  private alreadyPicked(): OwnedIssue[] {
    const issues: OwnedIssue[] = [];
    const seen = new Map<string, ChoicePath>();
    for (const record of this.choices) {
      const group = this.uniqueKey(record);
      if (!group || !record.applicable) continue;
      for (const pick of record.picks) {
        if (this.repeatable(pick.option)) continue;
        const key = `${group} ${String(pick.option)}`;
        const earlier = seen.get(key);
        if (earlier) {
          issues.push({
            owner: record.owner,
            issue: {
              code: 'already-picked',
              id: choiceId(record.owner, record.choice),
              source: record.owner.source,
              data: { option: pick.option, path: earlier },
            },
          });
        } else {
          seen.set(key, record.path);
        }
      }
    }
    return issues;
  }

  /** For each type with `copies`, in ruleset order: its copies, features then inventory. */
  copyLimits(): CopyLimitStatus[] {
    const held = this.activations.filter(
      (a) => (a.kind === 'feature' || a.kind === 'inventory') && a.entry && a.item,
    );
    const out: CopyLimitStatus[] = [];
    for (const [qid, def] of Object.entries(this.ruleset.contentTypes)) {
      if (!def.copies) continue;
      const entries = held
        .filter((a) => a.item?.type === qid)
        .map((a) => ({ entry: a.entry?.id ?? '', item: a.item?.qid ?? '' }));
      // A formula limit that fails is no limit, with a `formula-error`.
      const limit = (value: number | string | undefined, key: string): number | undefined => {
        if (typeof value !== 'string') return value;
        try {
          const v = this.evaluate(value, def.pack, {});
          if (v.kind === 'int') return v.value;
          throw new Failure({
            code: 'type-mismatch',
            message: `copies.${key} must be an integer`,
          });
        } catch (error) {
          if (!(error instanceof Failure)) throw error;
          this.errors.push({
            code: error.error.code,
            data: {
              where: `${qid} copies ${key}`,
              message: error.error.message,
              ...error.error.data,
            },
          });
          return undefined;
        }
      };
      const max = limit(def.copies.max, 'max');
      const perItem = limit(def.copies.perItem, 'perItem');
      out.push({
        type: qid,
        ...(max === undefined ? {} : { max }),
        ...(perItem === undefined ? {} : { perItem }),
        count: entries.length,
        entries,
      });
    }
    return out;
  }

  /** A type over its `max`, then each item over `perItem`, in the order of its first copy. */
  private tooManyCopies(): RulesIssue[] {
    const issues: RulesIssue[] = [];
    for (const limit of this.copyLimits()) {
      const { type, max, perItem } = limit;
      const issue = (data: Record<string, unknown>): RulesIssue => ({
        code: 'too-many-copies',
        id: type,
        source: { type: 'rules', id: type },
        data,
      });
      if (max !== undefined && limit.count > max) {
        const entries = limit.entries.map((e) => e.entry);
        issues.push(issue({ type, max, count: limit.count, entries, limit: max }));
      }
      if (perItem === undefined) continue;
      const byItem = new Map<string, string[]>();
      for (const e of limit.entries) byItem.set(e.item, [...(byItem.get(e.item) ?? []), e.entry]);
      for (const [item, entries] of byItem)
        if (entries.length > perItem)
          issues.push(
            issue({ type, item, perItem, count: entries.length, entries, limit: perItem }),
          );
    }
    return issues;
  }

  private outOfLimits(): RulesIssue[] {
    const issues: RulesIssue[] = [];
    for (const [qid, def] of Object.entries(this.ruleset.fields)) {
      if (!def.limits) continue;
      const result = this.field(qid);
      if (result.error || !result.value || !isNumber(result.value)) continue;
      const value = result.value.value;
      for (const limit of ['min', 'max'] as const) {
        const formula = def.limits[limit];
        if (formula === undefined) continue;
        let bound: number | undefined;
        try {
          const b = this.evaluate(formula, def.pack, {});
          bound = isNumber(b) ? b.value : undefined;
        } catch (error) {
          if (!(error instanceof Failure)) throw error;
        }
        if (bound === undefined) continue;
        if (limit === 'min' ? value < bound : value > bound) {
          issues.push({
            code: 'out-of-limits',
            id: qid,
            source: { type: 'field', id: qid },
            data: { field: qid, limit, value, bound },
          });
        }
      }
    }
    return issues;
  }

  /**
   * By activation order, then by kind (`issueOrder`). Fields outside their `limits` belong to no
   * activation and come last, in field order.
   */
  issues(): RulesIssue[] {
    const owned: OwnedIssue[] = [];
    const rules = this.activations[0] as Activation;
    for (const [qid, c] of Object.entries(this.ruleset.rules.constraints)) {
      // Once per held copy of the type whose `where` holds, with `item` and `self` the copy's.
      const runs: { roots: Record<string, unknown>; entry?: string | undefined }[] = c.copies
        ? this.activations
            .filter(
              (a) =>
                (a.kind === 'feature' || a.kind === 'inventory') &&
                a.entry &&
                a.item?.type === c.copies?.type,
            )
            .map((a) => ({
              roots: { item: a.roots.item, self: this.actionRoots(a).self },
              entry: a.entry?.id,
            }))
            .filter((run) => {
              if (c.copies?.where === undefined) return true;
              try {
                return this.test(c.copies.where, c.pack, run.roots);
              } catch (error) {
                if (!(error instanceof Failure)) throw error;
                return false;
              }
            })
        : [{ roots: {} }];
      for (const run of runs) {
        let ok = false;
        const data: Record<string, unknown> = run.entry !== undefined ? { entry: run.entry } : {};
        try {
          ok = this.test(c.check, c.pack, run.roots);
          for (const [k, v] of Object.entries(c.data ?? {}))
            data[k] = outputData(this.evaluate(v, c.pack, run.roots));
        } catch (error) {
          if (!(error instanceof Failure)) throw error;
        }
        if (!ok)
          owned.push({
            owner: rules,
            issue: { code: 'constraint-failed', id: qid, source: { type: 'rules', id: qid }, data },
          });
      }
    }
    for (const a of this.activations) {
      for (const issue of this.unmet(a)) owned.push({ owner: a, issue });
      for (const issue of this.noOption(a)) owned.push({ owner: a, issue });
      if (a.item?.hidden)
        owned.push({
          owner: a,
          issue: { code: 'content-hidden', id: a.item.qid, source: a.source },
        });
    }
    for (const issue of this.tooManyCopies()) owned.push({ owner: rules, issue });
    owned.push(...this.pending().issues, ...this.alreadyPicked(), ...this.immune);
    const position = new Map(this.activations.map((a, i) => [a, i]));
    const rank = (o: OwnedIssue) => issueOrder.indexOf(o.issue.code);
    const sorted = owned.toSorted(
      (x, y) => (position.get(x.owner) ?? 0) - (position.get(y.owner) ?? 0) || rank(x) - rank(y),
    );
    return [...sorted.map((o) => o.issue), ...this.outOfLimits()];
  }

  private unmet(a: Activation): RulesIssue[] {
    if (a.waived) return [];
    const prerequisites = a.item?.prerequisites ?? a.inline?.prerequisites ?? [];
    const pack = a.item ? (a.item.scopes?.prerequisites ?? a.item.pack) : a.pack;
    const out: RulesIssue[] = [];
    for (const p of prerequisites) {
      let ok = false;
      try {
        ok = this.test(p.when, pack, a.roots);
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
      }
      if (!ok)
        out.push({ code: 'prerequisite-not-met', id: `${a.sourceId}/${p.id}`, source: a.source });
    }
    return out;
  }

  /**
   * The `prerequisite-not-met` issues for activations whose source ID is `id` or starts with `id/`,
   * in `issues()` order: what listOptions reads from a trial sheet.
   */
  prerequisiteIssues(id: string): RulesIssue[] {
    const out: RulesIssue[] = [];
    for (const a of this.activations)
      if (a.sourceId === id || a.sourceId.startsWith(`${id}/`))
        out.push(...this.unmet(a), ...this.noOption(a));
    return out;
  }

  /** The activation's pending `requiresOption` choices with no eligible option left. */
  private noOption(a: Activation): RulesIssue[] {
    const out: RulesIssue[] = [];
    for (const record of this.choices) {
      if (record.owner !== a || record.choice.requiresOption !== true || !record.applicable)
        continue;
      if (!isOpen(record, this.pickCounts(record).min)) continue;
      const listed = openOptionsOn(this.ruleset, this, record.path, this.givenLinks);
      if ('errors' in listed || listed.options.some((o) => o.eligible && !o.picked)) continue;
      out.push({
        code: 'no-eligible-option',
        id: choiceId(a, record.choice),
        source: a.source,
        data: { path: record.path },
      });
    }
    return out;
  }

  /** Active effects; roll and incoming effects are listed without evaluating them. */
  activeEffects(): {
    source: Source;
    target: unknown;
    op: string;
    value?: unknown;
    suppressed?: boolean;
  }[] {
    this.values(); // stacking is decided while fields are computed
    const out: {
      source: Source;
      target: unknown;
      op: string;
      value?: unknown;
      suppressed?: boolean;
    }[] = [];
    for (const i of this.instances) {
      const e = i.effect;
      if (typeof e.target !== 'string') {
        out.push({ source: i.source, target: e.target, op: e.op });
        continue;
      }
      if (!this.reaches(i)) continue;
      let active = false;
      try {
        active = this.test(e.when, i.pack, i.roots);
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
      }
      if (!active) continue;
      out.push({
        source: i.source,
        target: e.target,
        op: e.op,
        ...(this.suppressed.has(i) ? { suppressed: true } : {}),
      });
    }
    return out;
  }

  situational(): string[] {
    const out: string[] = [];
    for (const [qid, def] of Object.entries(this.ruleset.rules.situational)) {
      let available = false;
      try {
        available = this.test(def.available, def.pack, {});
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
      }
      if (available) out.push(qid);
    }
    return out;
  }

  /** With `unlisted`, also the available actions computeSheet leaves out (`listed: false`). */
  actions(unlisted = false): ListedAction[] {
    return this.actionList(unlisted).map((a) => a.listed);
  }

  /** The actions available now, each with its tags. */
  actionList(unlisted = false): { listed: ListedAction; tags: readonly string[] }[] {
    const out: { listed: ListedAction; tags: readonly string[] }[] = [];
    const seen = new Set<string>();
    const used = new Set<string>();
    const collectUses = (list: ActionOrUse[] | undefined) => {
      for (const a of list ?? []) if ('use' in a) used.add(a.use);
    };
    for (const t of Object.values(this.ruleset.contentTypes)) collectUses(t.actions);
    for (const item of Object.values(this.ruleset.content)) collectUses(item.actions);

    // Each item activation lists its content type's actions, then its own: a holder activation
    // those of scope `holder`, an applied entry those of scope `applied`, with the entry's ID as
    // `entry`.
    for (const a of this.activations) {
      if (!a.item) continue;
      const list: ActionOrUse[] = [
        ...(this.ruleset.contentTypes[a.item.type]?.actions ?? []),
        ...(a.item.actions ?? []),
      ];
      // Content picked or granted on the entry is named by `source`, so several picks can share one
      // action. Content with no owning copy is named by `source` alone.
      const source = ownsEntry(a) ? undefined : a.item.qid;
      const entry = entryOf(a);
      for (const action of list) {
        if ((action.scope ?? 'holder') !== a.scope) continue;
        const id = 'use' in action ? action.use : `${a.item.qid}#${action.id}`;
        const def = 'use' in action ? this.ruleset.rules.actions[action.use] : action;
        const pack =
          'use' in action ? (this.ruleset.rules.actions[action.use]?.pack ?? a.pack) : a.pack;
        const key = `${id} ${entry ?? ''} ${source ?? ''}`;
        if (!def || seen.has(key)) continue;
        if (!unlisted && (('use' in action ? action.listed : undefined) ?? def.listed) === false)
          continue;
        let available = false;
        try {
          available = this.test(def.available, pack, this.actionRoots(a));
        } catch (error) {
          if (!(error instanceof Failure)) throw error;
        }
        if (!available) continue;
        seen.add(key);
        out.push({
          listed: {
            action: id,
            ...(entry !== undefined ? { entry } : {}),
            ...(source ? { source } : {}),
          },
          tags: def.tags ?? [],
        });
      }
    }
    for (const [qid, def] of Object.entries(this.ruleset.rules.actions)) {
      if (used.has(qid) || (!unlisted && def.listed === false)) continue;
      let available = false;
      try {
        available = this.test(def.available, def.pack, {});
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
      }
      if (available) out.push({ listed: { action: qid }, tags: def.tags ?? [] });
    }
    return out;
  }

  // --- Computed values on copies -------------------------------------------------------------

  private readonly computedCache = new Map<string, Record<string, f.Value>>();

  /**
   * Each declared formula sees the copy's `item`, `self` (with the values declared before it),
   * every field, `character` and `links`. One that fails or gives the wrong type gives no value
   * and a `formula-error`. Undefined for an ID that names no copy.
   */
  computedOf(entryId: string): Record<string, f.Value> | undefined {
    const cached = this.computedCache.get(entryId);
    if (cached) return cached;
    const a = this.activations.find(
      (x) => (x.kind === 'feature' || x.kind === 'inventory') && x.entry?.id === entryId,
    );
    if (!a?.item || !a.entry) return undefined;
    const templates = this.templatesOf(a.entry)
      .map((t) => this.ruleset.content[t])
      .filter((t): t is LoadedItem => t?.type === 'template');
    const out: Record<string, f.Value> = {};
    this.computedCache.set(entryId, out);
    for (const { name, decl, pack } of computedDecls(this.ruleset, a.item, templates)) {
      const fail = (cause: string, message: string) =>
        this.errors.push({ code: 'formula-error', data: { entry: entryId, name, cause, message } });
      try {
        const earlier = Object.fromEntries(
          Object.entries(out).map(([n, v]) => [n, computedRoot(v)]),
        );
        const value = this.evaluate(decl.formula, pack, {
          item: a.roots.item,
          self: { ...(a.roots.self as Record<string, unknown>), ...earlier },
          [f.OWNER_PICKS]: a.roots[f.OWNER_PICKS],
        });
        const typed = computedValue(decl.type, value);
        if (typed) out[name] = typed;
        else fail('type-mismatch', `the computed value "${name}" must be ${decl.type}`);
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
        fail(error.error.code, error.error.message);
      }
    }
    return out;
  }

  /** The activations `activationList` lists, in its order. */
  listedActivations(): Activation[] {
    return this.activations.filter((a) => a.kind !== 'rules' && a.kind !== 'inline');
  }

  /**
   * Every content activation in instance order, with its parent: the nearest listed activation that
   * granted it, owns the choice it was picked in, or keeps the template. Rules and inline options
   * aren't listed.
   */
  activationList(): ListedActivation[] {
    const listed = this.listedActivations();
    const index = new Map(listed.map((a, i) => [a, i]));
    // A kept template's keeper: the first activation that keeps it on the copy.
    const keepers = new Map<string, Activation>();
    if (this.kept.size > 0)
      for (const k of this.keptWanted()) {
        const key = `${k.entry.id} ${k.kept.template}`;
        if (!keepers.has(key)) keepers.set(key, k.keeper);
      }
    return listed.map((a) => {
      let parent: Activation | undefined;
      if (a.kind === 'template')
        parent = listed.find(
          (c) => (c.kind === 'feature' || c.kind === 'inventory') && c.entry === a.entry,
        );
      else {
        parent = this.parentOf.get(a);
        while (parent && !index.has(parent)) parent = this.parentOf.get(parent);
      }
      const via: ListedActivation['via'] =
        a.kind === 'feature' || a.kind === 'inventory'
          ? 'copy'
          : a.scope === 'applied'
            ? 'applied'
            : (a.kind as 'template' | 'grant' | 'pick');
      const entry = entryOf(a);
      const at = parent ? index.get(parent) : undefined;
      const keeper =
        a.kind === 'template' && a.entry && this.isKept(a.entry, (a.item as LoadedItem).qid)
          ? keepers.get(`${a.entry.id} ${(a.item as LoadedItem).qid}`)
          : undefined;
      const keptBy = keeper ? index.get(keeper) : undefined;
      return {
        item: (a.item as LoadedItem).qid,
        ...(entry === undefined ? {} : { entry }),
        via,
        ...(a.scope === 'applied' ? { scope: 'applied' as const } : {}),
        ...(at === undefined ? {} : { parent: at }),
        ...(keptBy === undefined ? {} : { keptBy }),
        ...(a.kind === 'pick' ||
        (a.kind === 'grant' && a.scope === 'holder' && a.path.choice.length > 0)
          ? { path: a.path }
          : {}),
      };
    });
  }

  copies(): Record<string, Record<string, Literal>> {
    const out: Record<string, Record<string, Literal>> = {};
    for (const a of this.activations) {
      if ((a.kind !== 'feature' && a.kind !== 'inventory') || !a.entry) continue;
      const values = this.computedOf(a.entry.id) ?? {};
      if (Object.keys(values).length === 0) continue;
      out[a.entry.id] = Object.fromEntries(
        Object.entries(values).map(([name, v]) => [name, literal(v)]),
      );
    }
    return out;
  }

  /**
   * Every item the character has with templates, as merged: each copy with a saved or kept
   * template, then each content item without a copy that content keeps templates on.
   */
  templated(): TemplatedItem[] {
    const out: TemplatedItem[] = [];
    for (const a of this.activations) {
      if ((a.kind !== 'feature' && a.kind !== 'inventory') || !a.entry || !a.item) continue;
      const templates = this.templatesOf(a.entry);
      if (templates.length === 0) continue;
      const view = a.roots.item as Record<string, unknown>;
      out.push({
        entry: a.entry.id,
        item: a.item.qid,
        templates: [...templates],
        ...mergedData(view),
      });
    }
    const seen = new Set<string>();
    for (const a of this.activations) {
      if ((a.kind !== 'pick' && a.kind !== 'grant') || a.scope !== 'holder' || !a.item) continue;
      const qid = a.item.qid;
      const kept = this.keptContent.get(qid);
      if (!kept?.length || seen.has(qid)) continue;
      seen.add(qid);
      out.push({
        item: qid,
        templates: kept.map((k) => k.template),
        ...mergedData(this.contentView(a.item)),
      });
    }
    return out;
  }

  /** For each copy whose item (else content type) has `nameFrom`: the key's non-empty value. */
  copyNames(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of this.activations) {
      if ((a.kind !== 'feature' && a.kind !== 'inventory') || !a.entry || !a.item) continue;
      const key = a.item.nameFrom ?? this.ruleset.contentTypes[a.item.type]?.nameFrom;
      if (key === undefined) continue;
      const value = (a.roots.self as Record<string, unknown> | undefined)?.[key];
      if (typeof value === 'string' && value.trim() !== '') out[a.entry.id] = value;
    }
    return out;
  }

  /** The rules' roots: `picksOf` reads the rules' own choices there. */
  rulesRoots(): Record<string, unknown> {
    return (this.activations[0] as Activation).roots;
  }

  /** A holder activation's roots, with `self` also holding its copy's computed values. */
  actionRoots(a: Activation): Record<string, unknown> {
    const self = a.roots.self as Record<string, unknown> | undefined;
    if (!self || !a.entry) return a.roots;
    const computed = this.computedOf(a.entry.id) ?? {};
    if (Object.keys(computed).length === 0) return a.roots;
    const extra = Object.fromEntries(
      Object.entries(computed).map(([name, v]) => [name, computedRoot(v)]),
    );
    return { ...a.roots, self: { ...self, ...extra } };
  }
}

export function entryOf(a: Activation): string | undefined {
  return a.entry?.id ?? a.applied;
}

/** Whether the activation is its entry's own item: a copy's, or an applied entry's source. */
export function ownsEntry(a: Activation): boolean {
  return a.kind === 'feature' || a.kind === 'inventory' || a.kind === 'applied';
}

function computedValue(type: string, value: f.Value): f.Value | undefined {
  switch (type) {
    case 'integer':
      return value.kind === 'int' ? value : undefined;
    case 'decimal':
      return isNumber(value) ? { kind: 'decimal', value: f.roundDecimal(value.value) } : undefined;
    case 'boolean':
      return value.kind === 'bool' ? value : undefined;
    default:
      return value.kind === 'string' ? value : undefined;
  }
}

function choiceId(owner: Activation, choice: Choice): string {
  return `${owner.sourceId}/${choice.id}`;
}

const cachedParse = f.parseCached;

function isNumber(v: f.Value): v is { kind: 'int' | 'decimal'; value: number } {
  return v.kind === 'int' || v.kind === 'decimal';
}

/** A value of the field's type: ints become decimals for decimal fields, dice for dice fields. */
function coerce(value: f.Value, def: FieldDef): f.Value {
  if (def.type === 'decimal' && value.kind === 'int')
    return { kind: 'decimal', value: value.value };
  if (def.type === 'dice' && value.kind === 'int')
    return { kind: 'dice', value: { terms: [], flat: value.value } };
  return value;
}

export function average(v: f.Value): number {
  if (isNumber(v)) return v.value;
  if (v.kind === 'dice') {
    return v.value.terms.reduce(
      (sum, t) =>
        sum +
        t.sign * t.count * (t.sides === 'F' ? 0 : t.zero ? (t.sides - 1) / 2 : (t.sides + 1) / 2),
      v.value.flat,
    );
  }
  return 0;
}

function compareValues(a: f.Value, b: f.Value): number {
  return average(a) - average(b);
}

function addValues(a: f.Value, b: f.Value): f.Value {
  if (a.kind === 'int' && b.kind === 'int') return { kind: 'int', value: a.value + b.value };
  if (isNumber(a) && isNumber(b))
    return { kind: 'decimal', value: f.roundDecimal(a.value + b.value) };
  if (a.kind === 'dice' || b.kind === 'dice') {
    const da = a.kind === 'dice' ? a.value : { terms: [], flat: isNumber(a) ? a.value : 0 };
    const db = b.kind === 'dice' ? b.value : { terms: [], flat: isNumber(b) ? b.value : 0 };
    return { kind: 'dice', value: { terms: [...da.terms, ...db.terms], flat: da.flat + db.flat } };
  }
  throw new Failure({ code: 'type-mismatch', message: `cannot add ${b.kind} to ${a.kind}` });
}

function multiplyValues(a: f.Value, b: f.Value): f.Value {
  if (!isNumber(a) || !isNumber(b))
    throw new Failure({ code: 'type-mismatch', message: 'multiply needs numbers' });
  return a.kind === 'int' && b.kind === 'int'
    ? { kind: 'int', value: a.value * b.value }
    : { kind: 'decimal', value: f.roundDecimal(a.value * b.value) };
}

export function roundNumber(x: number, mode: 'floor' | 'ceil' | 'round' | 'truncate'): number {
  switch (mode) {
    case 'floor':
      return Math.floor(x);
    case 'ceil':
      return Math.ceil(x);
    case 'truncate':
      return Math.trunc(x);
    case 'round':
      return Math.sign(x) * Math.round(Math.abs(x));
  }
}

export { diceText, isContentOnly, localPart };

/** An owner's saved picks by choice key (a slot's `<id>-<slot>`), as `picksOf` reads them. */
function ownerPicks(
  choices: readonly Choice[],
  tree: ChoiceTree,
  prefix: string,
): Record<string, (string | number)[]> {
  const out: Record<string, (string | number)[]> = {};
  for (const declared of choices)
    for (const { choice } of expandSlots(declared))
      out[choice.id] = (tree[`${prefix}${choice.id}`] ?? []).map((p) => p.option);
  return out;
}

function pickRoots(roots: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (roots.pick !== undefined) out.pick = roots.pick;
  if (roots.slot !== undefined) out.slot = roots.slot;
  return out;
}

const itemOnlyWhere = new Map<string | number | boolean, boolean>();

function readsOnlyItem(where: string | number | boolean): boolean {
  let known = itemOnlyWhere.get(where);
  if (known === undefined) itemOnlyWhere.set(where, (known = isContentOnly(where)));
  return known;
}

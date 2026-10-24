import type { ActionNeed, ActionPolicy, Change, ChoicePath } from '@opencharacter/spec';
import * as f from '../formula/index.ts';
import { MODIFIER_ORDER } from '../formula/index.ts';
import { applyBatch, type BatchSheets } from './changes.ts';
import { offered as followUpOffered } from './follow-ups.ts';
import type { EngineError } from './load.ts';
import { openOptionsOn, pickBounds } from './options.ts';
import type {
  ActionDef,
  ActionOrUse,
  CharacterDoc,
  Destination,
  Effect,
  FollowUp,
  Formula,
  OptionValue,
  StepChanges,
  PendingSource,
  ProposedChange,
  ProposedPath,
  ProposedEntry,
  Role,
  RollModifier,
  Situational,
  Step,
  StepOption,
  ValueSource,
  TagOrFormula,
  ThenChange,
  ValueDecl,
} from './pack-types.ts';
import {
  innerSteps,
  optionQuery,
  pendingSource,
  thenRule,
  valueSource,
  writtenOptions,
} from './pack-types.ts';
import {
  admitsTag,
  evaluateTags,
  type LoadedItem,
  localPart,
  resolveContent,
  resolveField,
  resolveType,
  type Ruleset,
  unloadedPack,
} from './ruleset.ts';
import { withHomebrew } from './homebrew.ts';
import {
  type Activation,
  average,
  type EffectInstance,
  entryOf,
  Failure,
  type Links,
  ownerKey,
  ownsEntry,
  roundNumber,
  Sheet,
  type Source,
  type View,
  viewData,
} from './sheet.ts';
import { literalTree, type RollSummary, rollSummary } from './roll-summary.ts';
import { samePath } from './tree.ts';
import { expectedData, itemView, outputData, stateDecls, typedValue } from './views.ts';

/** Rolls `count` dice: faces 1..sides, 0..sides-1 when `zero`, or -1..1 for Fate dice. */
export type DiceFunction = (count: number, sides: number | 'F', zero: boolean) => number[];

/** When the engine continues by itself and when it pauses (`action-run.schema.json`). */
export type Policy = ActionPolicy;

/** The action to start, as computeSheet lists it; `followUp` is the offer the run takes up. */
export interface ActionRef {
  id: string;
  entry?: string;
  source?: string;
  followUp?: string;
}

export interface ActionInput {
  action: ActionRef;
  params?: Record<string, unknown>;
  situational?: Record<string, unknown>;
  policy?: Policy;
  /** Views of the characters filling the link slots. */
  links?: Links;
  /** Views of the other characters taking part, by role. */
  participants?: Record<string, View[]>;
  /** Answers to replay, one per pause, as continueAction takes them. */
  answers?: ActionAnswer[];
}

/** An answer to one pause: faces, an option, amounts or a handoff's outcome. */
export interface ActionAnswer {
  faces?: number[];
  option?: string;
  outcome?: Outcome;
  amounts?: Amounts;
}

/** How an action finished; also a handoff's answer. */
export interface Outcome {
  result?: string;
  data?: Record<string, unknown>;
}

export interface ParticipantRef {
  role: string;
  id: string;
}

export type Amounts = Record<string, number>;

interface Answer {
  step: string;
  kind: 'dice' | 'choice' | 'allocate' | 'handoff';
  by: 'engine' | 'app';
  faces?: number[];
  option?: string;
  amounts?: Amounts;
  outcome?: Outcome;
  participant?: ParticipantRef;
  /** A pick over pending choices: the choice it answered. */
  choice?: ChoicePath;
}

type ActionState = {
  character: CharacterDoc;
  action: ActionRef;
  params: Record<string, unknown>;
  situational: Record<string, unknown>;
  /** Link views are inputs: a paused action keeps them. */
  links?: Links;
  participants?: Record<string, View[]>;
  policy?: Policy;
  answers: Answer[];
};

export interface RollItem {
  kind: 'dice' | 'flat';
  value?: number;
  count?: number;
  sides?: number | 'F';
  zero?: boolean;
  sign?: -1;
  modifiers?: f.DiceModifier[];
  faces?: f.RolledFace[];
  source: Source;
  tags: string[];
  /** Added by an effect, or from a roll part, with `multiplied: false`. */
  multiplied?: false;
  /** The product of the `multiply` factors applied to the item's value. */
  factor?: number;
  /** The part's items a `set` roll effect replaced, unrolled. */
  replaces?: RollItem[];
  /** The die's sides before `stepDie` changed them. */
  steppedFrom?: number;
  /** Carried keyed effects that lost to a roll effect. */
  dropped?: { source: Source; value: number }[];
}

export interface LogEntry {
  step: string;
  /** The qualified ID of the action whose step this is. */
  action: string;
  kind: 'dice' | 'choice' | 'allocate' | 'handoff';
  by: 'engine' | 'app';
  /** A roll step that classified an earlier roll again: that roll's path. */
  of?: string;
  faces?: number[];
  /** A random draw on a choice or allocate step: what its one face picked among. */
  draw?: { among: string[] };
  option?: string;
  /** Repeated choice steps: which pick this is, from 0. */
  index?: number;
  /** Choice steps over pending choices: the choice the pick answered. */
  choice?: ChoicePath;
  amounts?: Amounts;
  /** Handoffs: who ran the used action, and its outcome. */
  participant?: ParticipantRef;
  outcome?: Outcome;
  items?: RollItem[];
  total?: number;
  band?: string;
  /** The band set's qualified ID, with `band`. */
  bandSet?: string;
  /** The band set's value, when it has one. */
  bandValue?: unknown;
  /** Roll steps: what the roll is rolled against, worked out before it. */
  summary?: RollSummary;
  tallies?: TallyLog[];
  /** Roll steps: each `atLeast` or `atMost` that changed the total. */
  bounds?: BoundLog[];
  /** Roll steps made more than once (`of: roll`): every whole roll, in order. */
  rolls?: RollLog[];
}

/** One whole roll of a roll step made more than once; `kept` marks the one kept. */
export interface RollLog {
  total: number;
  kept: boolean;
  items: RollItem[];
}

/** A bound on a roll's total that changed it. */
export interface BoundLog {
  source: Source;
  op: 'atLeast' | 'atMost';
  value: number;
}

/** A roll tally's value and what contributed to it. */
export interface TallyLog {
  name: string;
  value: number;
  sources: { source: Source; op: 'add' | 'atLeast' | 'atMost'; value: number }[];
}

export interface Need {
  step: string;
  /** The qualified ID of the action whose step this is. */
  action: string;
  kind: 'dice' | 'choice' | 'allocate' | 'handoff';
  dice?: { count: number; sides: number | 'F'; zero?: boolean; tags?: string[] }[];
  /** A random draw on a choice or allocate step: what the die picks among. */
  draw?: { among: string[] };
  items?: RollItem[];
  /** Dice steps: the summary of the roll the pause is for. */
  summary?: RollSummary;
  /**
   * Dice steps made more than once (`of: roll`): how many rolls, and which total is kept; with
   * `items`, only those items (indices in `items`) are rolled again.
   */
  repeat?: Repeat;
  options?: string[];
  recommended?: string;
  /** Choice steps over values: the content the action runs for, which names values first. */
  content?: string;
  /** Choice steps over pending choices: the choice being asked. */
  choice?: PendingChoice;
  allocate?: AllocateNeed;
  /** Handoffs: who runs which action with which params. */
  participant?: ParticipantRef;
  run?: {
    action: string;
    params: Record<string, unknown>;
    /** The participants a handoff passes on, by role: IDs. */
    participants?: Record<string, string[]>;
  };
}

/** A pending choice a choice step asks; a pause also gives its pick bounds and picks so far. */
export interface PendingChoice {
  path: ChoicePath;
  owner: string;
  id: string;
  slot?: { choice: string; number: number };
  min?: number;
  /** Absent when unbounded. */
  max?: number;
  /** Picks so far, on the proposed sheet. */
  picked?: number;
}

export interface AllocateNeed {
  fields: { id: string; value: number; input: number; limit?: number; costs?: number[] }[];
  budget?: number;
  spend?: 'all' | 'upTo';
  values?: number[];
  recommended?: Amounts;
}

/** A change sent to a link or role carries that character's ID. */
export interface Proposed {
  to: Destination;
  character?: string;
  step: string;
  change: Change;
}

export type ActionResult =
  | {
      status: 'finished';
      outcome: Outcome;
      proposedChanges: Proposed[];
      log: LogEntry[];
    }
  | { status: 'paused'; needs: Need; state: ActionState; log: LogEntry[] }
  | { ok: false; errors: EngineError[] };

class ActionError extends Error {
  constructor(
    readonly code: string,
    readonly data: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

class Pause extends Error {
  constructor(readonly needs: Need) {
    super('pause');
  }
}

class Finish extends Error {
  constructor(readonly outcome: Outcome) {
    super('finish');
  }
}

const MAX_STEPS = 1000;
const MAX_DEPTH = 16;
const MAX_PASSES = 100;

/** The engine's own dice function (the default). Not seeded; pass one for reproducible rolls. */
export const randomDice: DiceFunction = (count, sides, zero) =>
  Array.from({ length: count }, () => {
    if (sides === 'F') return Math.floor(Math.random() * 3) - 1;
    const face = Math.floor(Math.random() * sides);
    return zero ? face : face + 1;
  });

/** A dice function that hands out given faces in order (tests, replays). */
export function diceFrom(faces: readonly number[]): DiceFunction {
  let next = 0;
  return (count) => {
    const out = faces.slice(next, next + count);
    next += count;
    if (out.length < count)
      throw new ActionError('answer-mismatch', { reason: 'the dice function ran out of faces' });
    return out;
  };
}

export function startAction(
  ruleset: Ruleset,
  character: CharacterDoc,
  input: ActionInput,
  dice: DiceFunction = randomDice,
): ActionResult {
  const layered = withHomebrew(ruleset, character);
  if (!layered.ok) return { ok: false, errors: layered.errors };
  ruleset = layered.ruleset;
  const state: ActionState = {
    character,
    action: input.action,
    params: input.params ?? {},
    situational: input.situational ?? {},
    ...(input.links && Object.keys(input.links).length > 0 ? { links: input.links } : {}),
    ...(input.participants && Object.keys(input.participants).length > 0
      ? { participants: input.participants }
      : {}),
    ...(input.policy ? { policy: input.policy } : {}),
    answers: [],
  };
  const policy = input.policy ?? {};
  let result = run(ruleset, state, policy, dice);
  // Replays exactly as continueAction would; a misfit or leftover answer fails with its index.
  for (const [index, answer] of (input.answers ?? []).entries()) {
    if ('ok' in result) return result;
    if (result.status !== 'paused')
      return {
        ok: false,
        errors: [
          {
            code: 'answer-mismatch',
            data: { reason: 'the action finished before this answer', index },
          },
        ],
      };
    const needs = result.needs;
    result = answerPaused(ruleset, result, answer, policy, dice);
    if ('ok' in result)
      return {
        ok: false,
        errors: result.errors.map((e) =>
          e.code === 'answer-mismatch' ? { ...e, data: { ...e.data, index, needs } } : e,
        ),
      };
  }
  return result;
}

const mismatch = (reason: string): ActionResult => ({
  ok: false,
  errors: [{ code: 'answer-mismatch', data: { reason } }],
});

export function continueAction(
  ruleset: Ruleset,
  paused: { status: 'paused'; needs: ActionNeed; state: Record<string, unknown> },
  answer: ActionAnswer,
  policy?: Policy,
  dice: DiceFunction = randomDice,
): ActionResult {
  const layered = withHomebrew(ruleset, (paused.state as unknown as ActionState).character);
  if (!layered.ok) return { ok: false, errors: layered.errors };
  return answerPaused(layered.ruleset, paused, answer, policy, dice);
}

function answerPaused(
  ruleset: Ruleset,
  paused: {
    status: 'paused';
    needs: ActionNeed | Need;
    state: Record<string, unknown> | ActionState;
  },
  answer: ActionAnswer,
  policy: Policy | undefined,
  dice: DiceFunction,
): ActionResult {
  const { needs } = paused;
  if (needs.kind === 'handoff') {
    const outcome = answer.outcome;
    if (typeof outcome !== 'object' || outcome === null || Array.isArray(outcome))
      return mismatch('expected the outcome of the handed-off action');
    if (outcome.result !== undefined && typeof outcome.result !== 'string')
      return mismatch('an outcome result is a string');
    const used = needs.run ? ruleset.rules.actions[needs.run.action] : undefined;
    if (used && outcome.result !== undefined && !declaresResult(ruleset, used, outcome.result))
      return mismatch(`the handed-off action does not declare the result "${outcome.result}"`);
    const state = structuredClone(paused.state) as ActionState;
    state.answers.push({
      step: needs.step,
      kind: 'handoff',
      by: 'app',
      outcome: {
        ...(outcome.result !== undefined ? { result: outcome.result } : {}),
        ...(outcome.data !== undefined ? { data: outcome.data } : {}),
      },
      ...(needs.participant ? { participant: needs.participant } : {}),
    });
    return run(ruleset, state, policy ?? state.policy ?? {}, dice, memoOf(paused, ruleset, state));
  }
  if (needs.kind === 'allocate') {
    const amounts = answer.amounts;
    if (
      typeof amounts !== 'object' ||
      amounts === null ||
      Array.isArray(amounts) ||
      !Object.values(amounts).every((n) => Number.isInteger(n))
    )
      return mismatch('expected amounts: whole numbers by field ID');
    const state = structuredClone(paused.state) as ActionState;
    state.answers.push({ step: needs.step, kind: 'allocate', by: 'app', amounts: { ...amounts } });
    return run(ruleset, state, policy ?? state.policy ?? {}, dice, memoOf(paused, ruleset, state));
  }
  if (needs.kind === 'dice') {
    const wanted = (needs.dice ?? []).flatMap((d) => Array.from({ length: d.count }, () => d));
    const faces = answer.faces;
    if (!Array.isArray(faces) || faces.length !== wanted.length)
      return mismatch(`expected ${wanted.length} faces`);
    for (const [i, face] of faces.entries()) {
      const die = wanted[i] as { sides: number | 'F'; zero?: boolean };
      const [lo, hi] = die.sides === 'F' ? [-1, 1] : die.zero ? [0, die.sides - 1] : [1, die.sides];
      if (!Number.isInteger(face) || face < lo || face > hi)
        return mismatch(`face ${face} is not on the die`);
    }
  } else if (typeof answer.option !== 'string' || !(needs.options ?? []).includes(answer.option)) {
    return mismatch('that option is not offered');
  }
  const state = structuredClone(paused.state) as ActionState;
  state.answers.push({
    step: needs.step,
    kind: needs.kind,
    by: 'app',
    ...(needs.kind === 'dice'
      ? { faces: answer.faces as number[] }
      : { option: answer.option as string }),
    ...(needs.kind === 'choice' && needs.choice ? { choice: needs.choice.path } : {}),
  });
  return run(ruleset, state, policy ?? state.policy ?? {}, dice, memoOf(paused, ruleset, state));
}

/**
 * Every answer replays the action from its start, proposing the same changes in order, so a
 * replay reuses the last run's sheets while the ruleset, character and links stay the same.
 */
interface RunMemo {
  ruleset: Ruleset;
  given: string;
  sheets: Map<string, Sheet>;
  batch: BatchSheets;
}

const memos = new WeakMap<object, RunMemo>();

function newMemo(ruleset: Ruleset, state: ActionState): RunMemo {
  return {
    ruleset,
    given: JSON.stringify([state.character, state.links ?? {}]),
    sheets: new Map(),
    batch: new Map(),
  };
}

function memoOf(paused: object, ruleset: Ruleset, state: ActionState): RunMemo {
  const memo = memos.get(paused);
  const fresh = newMemo(ruleset, state);
  return memo && memo.ruleset === ruleset && memo.given === fresh.given ? memo : fresh;
}

interface Ctx {
  memo: RunMemo;
  sheet: Sheet;
  given: Sheet;
  cached?: { count: number; sheet: Sheet };
  ruleset: Ruleset;
  state: ActionState;
  policy: Policy;
  dice: DiceFunction;
  cursor: number;
  log: LogEntry[];
  proposed: Proposed[];
  stepsRun: number;
  rolls: Map<string, { result: Record<string, unknown>; items: BuiltItem[] }>;
  /** The effects whose `then` the run has proposed: each proposes it at most once. */
  ended: Set<string>;
  /** Changes a roll effect's `then` proposed: a record of rolls made, which `hold` leaves alone. */
  fromThen: WeakSet<Proposed>;
}

interface Frame {
  def: ActionDef;
  /** `<item id>#<action id>` for an inline action. */
  qid: string;
  pack: string;
  activation?: Activation;
  sheet: Sheet;
  entry?: string;
  source?: string;
  ownerSource: Source;
  roots: Record<string, unknown>;
  steps: Record<string, unknown>;
  flags: Record<string, unknown>;
  prefix: string;
  depth: number;
  rollItems: Map<string, BuiltItem[]>;
  eachOf: Map<string, string>;
  /** A step a group holds: the path prefix of the group's latest pass (`reroll[2]/`). */
  passOf: Map<string, string>;
  flagsEach: Map<string, string>;
  held: Map<string, Proposed[]>;
  views: Map<string, View>;
  added: string[];
  /** Content an added option or changes belong to: its follow-ups are the ones offered there. */
  adder?: Source;
  /** In an added option or changes: the pick or grant `pick: owner` and `grant: owner` name. */
  owner?: { activation?: Activation | undefined };
  situational: Record<string, unknown>;
  each?: { role: string; index: number; view: Record<string, unknown>; step: string };
}

function run(
  ruleset: Ruleset,
  state: ActionState,
  policy: Policy,
  dice: DiceFunction,
  memo: RunMemo = newMemo(ruleset, state),
): ActionResult {
  const sheet = new Sheet(ruleset, state.character, [], state.links ?? {});
  const ctx: Ctx = {
    memo,
    sheet,
    given: sheet,
    ruleset,
    state,
    policy,
    dice,
    cursor: 0,
    log: [],
    proposed: [],
    stepsRun: 0,
    rolls: new Map(),
    ended: new Set(),
    fromThen: new WeakSet(),
  };
  // An ephemeral offer is cleared by the changes of the run that takes it up.
  const takenUp = state.action.followUp;
  let clears = false;
  if (takenUp !== undefined) {
    const kind = followUpOffered(ruleset, sheet, takenUp);
    if (!kind) return { ok: false, errors: [{ code: 'unknown-follow-up', data: { id: takenUp } }] };
    clears = kind === 'ephemeral';
  }
  const finished = (outcome: Outcome): ActionResult => ({
    status: 'finished',
    outcome,
    proposedChanges: clears
      ? [
          ...ctx.proposed,
          {
            to: 'self',
            step: '',
            change: { type: 'clearFollowUp', id: takenUp } as unknown as Change,
          },
        ]
      : ctx.proposed,
    log: ctx.log,
  });
  try {
    const frame = startFrame(
      ctx,
      state.action.id,
      state.action.entry,
      state.action.source,
      state.params,
      '',
      0,
    );
    runSteps(ctx, frame, frame.def.steps);
    return finished({});
  } catch (error) {
    if (error instanceof Finish) return finished(error.outcome);
    if (error instanceof Pause) {
      const paused = { status: 'paused' as const, needs: error.needs, state, log: ctx.log };
      memos.set(paused, memo);
      return paused;
    }
    if (error instanceof ActionError)
      return { ok: false, errors: [{ code: error.code, data: error.data }] };
    const formulaError = (error as { error?: f.FormulaError }).error;
    if (formulaError?.code)
      return {
        ok: false,
        errors: [
          {
            code: formulaError.code,
            data: { message: formulaError.message, ...formulaError.data },
          },
        ],
      };
    throw error;
  }
}

function startFrame(
  ctx: Ctx,
  id: string,
  entry: string | undefined,
  source: string | undefined,
  rawParams: Record<string, unknown>,
  prefix: string,
  depth: number,
  nested: {
    participants?: Record<string, View[]>;
    added: string[];
    situational?: Record<string, unknown>;
  } = { added: [] },
): Frame {
  if (depth > MAX_DEPTH)
    throw new ActionError('safety-limit-exceeded', { limit: 'maxActionDepth' });
  const { sheet, ruleset } = ctx;
  let def: ActionDef | undefined;
  let definedBy = id;
  let pack = '';
  let activation: Activation | undefined;
  let fixed: Record<string, Formula> = {};

  if (depth === 0) {
    // A selected situational choice must be offered; one left at its default is fine.
    const offered = new Set(sheet.situational());
    for (const [qid, value] of Object.entries(ctx.state.situational)) {
      const choice = ruleset.rules.situational[qid];
      if (!choice || offered.has(qid) || value === situationalDefault(choice)) continue;
      throw new ActionError('situational-unavailable', { situational: qid });
    }
    const available = sheet
      .actions(true)
      .some((a) => a.action === id && a.entry === entry && a.source === source);
    if (!available)
      throw new ActionError('unknown-action', {
        action: id,
        ...(entry ? { entry } : {}),
        ...(source ? { source } : {}),
      });
  }
  const found = findAction(sheet, ruleset, id, entry, source);
  if (found) ({ def, definedBy, pack, activation, fixed } = found);
  if (!def) throw new ActionError('unknown-action', { action: id });

  const ownerSource: Source = activation?.item
    ? { type: 'item', id: activation.item.qid, ...(entry !== undefined ? { entry } : {}) }
    : { type: 'rules', id };
  const own = activation ? sheet.actionRoots(activation) : sheet.rulesRoots();
  const base: Record<string, unknown> = ownerRoots(own);
  const given = nested.situational ?? ctx.state.situational;
  const situational = situationalRoot(ruleset, pack, given);
  const frame: Frame = {
    def,
    qid: definedBy,
    pack,
    ...(activation ? { activation } : {}),
    sheet,
    ...(entry !== undefined ? { entry } : {}),
    ...(source !== undefined ? { source } : {}),
    ownerSource,
    roots: { ...base, situational },
    steps: {},
    flags: {},
    prefix,
    depth,
    rollItems: new Map(),
    eachOf: new Map(),
    passOf: new Map(),
    flagsEach: new Map(),
    held: new Map(),
    views: new Map(),
    added: nested.added,
    situational: given,
  };
  frame.roots.params = params(ctx, frame, rawParams, fixed);
  const roles = def.participants ?? {};
  const passed = depth === 0 ? (ctx.state.participants ?? {}) : (nested.participants ?? {});
  frame.roots.participants = participantsRoot(roles, passed);
  for (const list of Object.values(passed)) for (const view of list) frame.views.set(view.id, view);
  return frame;
}

/** An action as computeSheet lists it: its definition, the action defining it, its pack and owner. */
export interface FoundAction {
  def: ActionDef;
  /** The rules action, or `<item id>#<action id>` for an inline one. */
  definedBy: string;
  pack: string;
  activation?: Activation;
  /** The parameters a `use` fixes. */
  fixed: Record<string, Formula>;
}

export function findAction(
  sheet: Sheet,
  ruleset: Ruleset,
  id: string,
  entry: string | undefined,
  source: string | undefined,
): FoundAction | undefined {
  let def: ActionDef | undefined;
  let definedBy = id;
  let pack = '';
  let activation: Activation | undefined;
  let fixed: Record<string, Formula> = {};
  if (entry !== undefined || source !== undefined) {
    // An entry's own item is named by `entry`; content on it by `entry` and `source`; content
    // with no owning copy by `source` alone. An applied entry's source is named by the entry's ID.
    for (const a of sheet.activations) {
      if (entryOf(a) !== entry || !a.item) continue;
      const own = ownsEntry(a);
      if (source !== undefined ? own || a.item.qid !== source : !own) continue;
      const list: ActionOrUse[] = [
        ...(ruleset.contentTypes[a.item.type]?.actions ?? []),
        ...(a.item.actions ?? []),
      ];
      for (const action of list) {
        if ((action.scope ?? 'holder') !== a.scope) continue;
        if ('use' in action ? action.use === id : `${a.item.qid}#${action.id}` === id) {
          activation = a;
          if ('use' in action) {
            const used = ruleset.rules.actions[action.use];
            def = used;
            definedBy = action.use;
            pack = used?.pack ?? a.pack;
            fixed = action.params ?? {};
          } else {
            def = action;
            definedBy = `${a.item.qid}#${action.id}`;
            pack = a.item.pack;
          }
          break;
        }
      }
      if (def) break;
    }
    if (!def && ruleset.rules.actions[id]) {
      def = ruleset.rules.actions[id];
      pack = ruleset.rules.actions[id]?.pack ?? '';
      activation = sheet.activations.find((a) =>
        entry !== undefined
          ? entryOf(a) === entry &&
            (source !== undefined ? !ownsEntry(a) && a.item?.qid === source : ownsEntry(a))
          : a.scope === 'holder' && !a.entry && a.item?.qid === source,
      );
    }
  } else {
    def = ruleset.rules.actions[id];
    pack = def ? (ruleset.rules.actions[id]?.pack ?? '') : '';
  }
  if (!def) return undefined;
  return { def, definedBy, pack, ...(activation ? { activation } : {}), fixed };
}

/**
 * Unknown roles and counts outside `min`/`max` are `invalid-participants`; a wrongly typed value
 * is `invalid-link-value`, since an action has no way to report it and go on.
 */
function participantsRoot(
  roles: Record<string, Role>,
  given: Record<string, View[]>,
): Record<string, Record<string, unknown>[]> {
  for (const role of Object.keys(given))
    if (!Object.hasOwn(roles, role)) throw new ActionError('invalid-participants', { role });
  const seen = new Set<string>();
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const [role, decl] of Object.entries(roles)) {
    const list = given[role] ?? [];
    if (list.length < (decl.min ?? 0) || (decl.max !== undefined && list.length > decl.max))
      throw new ActionError('invalid-participants', { role });
    out[role] = list.map((view) => {
      if (seen.has(view.id)) throw new ActionError('duplicate-id', { id: view.id });
      seen.add(view.id);
      return viewData(decl.fields ?? {}, view, (field, _key, expected) => {
        throw new ActionError('invalid-link-value', { role, id: view.id, field, expected });
      });
    });
  }
  return out;
}

export function situationalRoot(
  ruleset: Ruleset,
  pack: string,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const scope = ruleset.packs.find((p) => p.id === pack)?.scope ?? [];
  const out: Record<string, unknown> = {};
  for (const [qid, def] of Object.entries(ruleset.rules.situational)) {
    if (!scope.includes(def.pack)) continue;
    const given = values[qid];
    out[def.id] = given !== undefined ? given : situationalDefault(def);
  }
  return out;
}

/** An action without `results` declares every result; otherwise listed, or a band of its set. */
function declaresResult(ruleset: Ruleset, def: ActionDef, result: string): boolean {
  const declared = def.results;
  if (declared === undefined) return true;
  if (Array.isArray(declared)) return declared.includes(result);
  return (ruleset.rules.bands[declared.bands]?.bands ?? []).some((band) => band.id === result);
}

function situationalDefault(def: Situational): unknown {
  return def.default ?? (def.type === 'boolean' ? false : def.type === 'integer' ? 0 : '');
}

function params(
  ctx: Ctx,
  frame: Frame,
  raw: Record<string, unknown>,
  fixed: Record<string, Formula>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const at = paramAction(frame);
  for (const [name, decl] of Object.entries(frame.def.params ?? {})) {
    let value: unknown = raw[name];
    if (fixed[name] !== undefined) {
      const evaluated = ctx.sheet.evaluate(fixed[name] as Formula, frame.pack, frame.roots);
      // A dice value has no plain data form, so a fixed dice parameter keeps the value itself.
      if (decl.type === 'dice' && evaluated.kind === 'dice') {
        out[name] = rootValue(evaluated);
        continue;
      }
      value = f.toData(evaluated);
    }
    if (value === undefined && decl.default !== undefined) value = decl.default;
    if (value === undefined) {
      if (decl.optional) continue;
      throw new ActionError('missing-param', { param: name, ...at });
    }
    if (decl.type === 'id' && decl.of === 'field') {
      value = fieldIdOf(value);
      if (typeof value !== 'string')
        throw new ActionError('wrong-type', { target: name, expected: 'a field ID', ...at });
      const qid = resolveField(ctx.ruleset, value, frame.pack);
      const field = qid ? ctx.ruleset.fields[qid] : undefined;
      if (!qid || !field)
        throw new ActionError('invalid-option', { param: name, option: value, ...at });
      if (!fieldParamTakes(ctx.sheet, ctx.ruleset, decl, frame.pack, qid))
        throw new ActionError('invalid-option', { param: name, option: value, ...at });
      out[name] = {
        id: qid,
        type: field.type,
        tags: ctx.sheet.fieldTags(qid),
        value: rootValue(ctx.sheet.fieldValue(qid)),
      };
      continue;
    }
    const typed = typedValue(decl, value);
    if (typeof typed === 'string')
      throw new ActionError('wrong-type', { target: name, ...expectedData(decl, typed), ...at });
    if (decl.type === 'id' && decl.of !== undefined && decl.of !== 'tag' && decl.of !== 'string') {
      const qid = resolveContent(ctx.ruleset, value as string, frame.pack);
      const item = qid ? ctx.ruleset.content[qid] : undefined;
      const type = resolveType(ctx.ruleset, decl.of, frame.pack);
      if (!qid || !item || item.type !== type)
        throw new ActionError('invalid-option', { param: name, option: value, ...at });
      if (!contentParamTakes(ctx.sheet, ctx.ruleset, decl, frame.pack, item, frame.roots))
        throw new ActionError('invalid-option', { param: name, option: value, ...at });
      out[name] = qid;
      continue;
    }
    if (decl.of === 'tag' && decl.members) {
      const list = Array.isArray(value) ? value : [value];
      for (const tag of list.map(String))
        if (!admitsTag(decl.members, tag))
          throw new ActionError('invalid-option', { param: name, option: tag, ...at });
    }
    paramRange(name, at, decl, typed, (bound) => {
      const v = ctx.sheet.evaluate(bound, frame.pack, frame.roots);
      return v.kind === 'int' || v.kind === 'decimal' ? v.value : undefined;
    });
    out[name] = rootValue(typed);
  }
  return out;
}

/** The action a parameter error names, and the entry and source it was started on. */
function paramAction(frame: Frame): Record<string, string> {
  return {
    action: frame.qid,
    ...(frame.entry !== undefined ? { entry: frame.entry } : {}),
    ...(frame.source !== undefined ? { source: frame.source } : {}),
  };
}

/** Whether a field parameter takes the field: its `where` over the field's `id`, `type` and `tags`. */
export function fieldParamTakes(
  sheet: Sheet,
  ruleset: Ruleset,
  decl: ValueDecl,
  pack: string,
  qid: string,
): boolean {
  const field = ruleset.fields[qid];
  if (!field) return false;
  if (decl.where === undefined) return true;
  const ok = sheet.evaluate(decl.where, pack, {
    item: { id: qid, type: field.type, tags: sheet.fieldTags(qid) },
  });
  return ok.kind === 'bool' && ok.value;
}

/** Whether a content parameter's `where` takes the item, with the action's own `item` and `self`. */
export function contentParamTakes(
  sheet: Sheet,
  ruleset: Ruleset,
  decl: ValueDecl,
  pack: string,
  item: LoadedItem,
  roots: Record<string, unknown>,
): boolean {
  if (decl.where === undefined) return true;
  const ok = sheet.evaluate(decl.where, pack, {
    item: itemView(ruleset, item, [], (field, at) => {
      const id = resolveField(ruleset, field, at);
      return id ? sheet.inputValue(id) : undefined;
    }),
    action: {
      ...(roots.item !== undefined ? { item: roots.item } : {}),
      ...(roots.self !== undefined ? { self: roots.self } : {}),
    },
  });
  return ok.kind === 'bool' && ok.value;
}

/** A number parameter outside its `min`/`max`, evaluated as the action starts, is out-of-range. */
function paramRange(
  name: string,
  at: Record<string, string>,
  decl: ValueDecl,
  value: f.Value,
  boundOf: (bound: Formula) => number | undefined,
): void {
  if (value.kind !== 'int' && value.kind !== 'decimal') return;
  const bound = (formula: Formula | undefined) =>
    formula === undefined ? undefined : boundOf(formula);
  const min = bound(decl.min);
  const max = bound(decl.max);
  if ((min !== undefined && value.value < min) || (max !== undefined && value.value > max))
    throw new ActionError('out-of-range', { target: name, min, max, ...at });
}

function fieldIdOf(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' ? id : value;
}

function rootValue(value: f.Value): unknown {
  return value.kind === 'decimal' || value.kind === 'dice' ? f.wrapValue(value) : f.toData(value);
}

/**
 * In an `each` step an earlier `each` step over the same role reads as the current participant's
 * result and the step itself as the list of its earlier runs; elsewhere each is the list.
 */
function context(frame: Frame, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const each = frame.each;
  let steps = frame.steps;
  if (each) {
    steps = { ...frame.steps };
    for (const [id, role] of frame.eachOf) {
      if (role !== each.role || !Object.hasOwn(steps, id)) continue;
      if (id === each.step) {
        if (each.index === 0) delete steps[id];
        else steps[id] = (frame.steps[id] as unknown[]).slice(0, each.index);
        continue;
      }
      const value = (frame.steps[id] as unknown[])[each.index];
      if (value === null || value === undefined) delete steps[id];
      else steps[id] = value;
    }
  }
  return {
    ...frame.roots,
    steps,
    flags: flagsOf(frame),
    ...(each ? { participant: each.view } : {}),
    ...extra,
  };
}

/** A per-participant flag reads as the current participant's value in an `each` over its role. */
function flagsOf(frame: Frame): Record<string, unknown> {
  const each = frame.each;
  if (!each || frame.flagsEach.size === 0) return frame.flags;
  const out = { ...frame.flags };
  for (const [name, role] of frame.flagsEach) {
    if (role !== each.role) continue;
    const value = (frame.flags[name] as unknown[] | undefined)?.[each.index];
    if (value === null || value === undefined) delete out[name];
    else out[name] = value;
  }
  return out;
}

function setFlag(frame: Frame, name: string, value: unknown, perParticipant = false): void {
  const each = frame.each;
  if (!perParticipant || !each) {
    frame.flagsEach.delete(name);
    frame.flags[name] = value;
    return;
  }
  const count = (frame.roots.participants as Record<string, unknown[]>)[each.role]?.length ?? 0;
  if (frame.flagsEach.get(name) !== each.role || !Array.isArray(frame.flags[name]))
    frame.flags[name] = Array.from({ length: count }, () => null);
  frame.flagsEach.set(name, each.role);
  (frame.flags[name] as unknown[])[each.index] = value;
}

/** A step's result as the current participant's in an `each` over its role; else its own. */
function resultOf(frame: Frame, id: string): unknown {
  const each = frame.each;
  if (each && frame.eachOf.get(id) === each.role)
    return (frame.steps[id] as unknown[] | undefined)?.[each.index];
  return frame.steps[id];
}

function clearResult(frame: Frame, id: string): void {
  const each = frame.each;
  if (each && frame.eachOf.get(id) === each.role) {
    const list = frame.steps[id] as unknown[] | undefined;
    if (list) list[each.index] = null;
  } else delete frame.steps[id];
}

function setResult(frame: Frame, id: string, value: unknown): void {
  const each = frame.each;
  if (each && frame.eachOf.get(id) === each.role)
    (frame.steps[id] as unknown[])[each.index] = value;
  else frame.steps[id] = value;
}

function itemsKey(frame: Frame, id: string): string {
  const each = frame.each;
  return each && frame.eachOf.get(id) === each.role ? `${id}[${each.index}]` : id;
}

function evaluate(
  ctx: Ctx,
  frame: Frame,
  formula: Formula,
  extra: Record<string, unknown> = {},
): f.Value {
  return ctx.sheet.evaluate(formula, frame.pack, context(frame, extra));
}

function test(
  ctx: Ctx,
  frame: Frame,
  formula: Formula | undefined,
  extra: Record<string, unknown> = {},
): boolean {
  if (formula === undefined) return true;
  const v = evaluate(ctx, frame, formula, extra);
  return v.kind === 'bool' && v.value;
}

function tagsOf(
  ctx: Ctx,
  list: TagOrFormula[] | undefined,
  evalFn: (formula: Formula) => f.Value,
): string[] {
  const out = evaluateTags(ctx.ruleset, list, evalFn);
  if (!out.ok) throw new ActionError(out.code, out.data);
  return out.tags;
}

function ownTags(ctx: Ctx, frame: Frame, step: Step): string[] {
  const own = tagsOf(ctx, step.tags, (fm) => evaluate(ctx, frame, fm));
  if (step.kind !== 'roll' && step.kind !== 'choice' && step.kind !== 'changes') return own;
  return [...own, ...frame.added.filter((tag) => !own.includes(tag))];
}

const matchesTag = (target: string, tags: string[]) =>
  tags.some((t) => t === target || t.startsWith(`${target}.`));

function runSteps(ctx: Ctx, frame: Frame, steps: Step[]): void {
  for (const step of steps) {
    if (++ctx.stepsRun > MAX_STEPS)
      throw new ActionError('safety-limit-exceeded', { limit: 'maxActionSteps' });
    if (step.each !== undefined) {
      eachStep(ctx, frame, step);
      continue;
    }
    // A step in an `each` branch step's case runs per participant too.
    const each = frame.each;
    if (each && frame.eachOf.get(step.id) !== each.role) {
      const count = (frame.roots.participants as Record<string, unknown[]>)[each.role]?.length ?? 0;
      frame.eachOf.set(step.id, each.role);
      frame.steps[step.id] = Array.from({ length: count }, () => null);
    }
    const path = `${frame.prefix}${step.id}`;
    onStepSheet(ctx, frame, step, path, (sub) => {
      if (test(ctx, sub, step.when)) runStep(ctx, sub, step, path);
    });
  }
}

function readsProposed(step: Step): boolean {
  return step.sheet === 'proposed' || pendingSource(step) !== undefined;
}

function onStepSheet(
  ctx: Ctx,
  frame: Frame,
  step: Step,
  path: string,
  fn: (frame: Frame) => void,
): void {
  const previous = ctx.sheet;
  ctx.sheet = readsProposed(step) ? proposedSheet(ctx, path) : ctx.given;
  try {
    fn(onSheet(ctx, frame));
  } finally {
    ctx.sheet = previous;
  }
}

/**
 * The character with every change proposed so far `to: self` applied, as one non-strict batch.
 * Follow-ups are neither listed nor applied.
 */
function proposedSheet(ctx: Ctx, path: string): Sheet {
  const count = ctx.proposed.length;
  if (ctx.cached?.count === count) return ctx.cached.sheet;
  const own = ctx.proposed
    .filter((p) => p.to === 'self' && p.character === undefined)
    .map((p) => p.change);
  let sheet = ctx.given;
  if (own.length > 0) {
    const key = JSON.stringify(own);
    const kept = ctx.memo.sheets.get(key);
    if (kept) sheet = kept;
    else {
      const links = ctx.state.links ?? {};
      const applied = applyBatch(
        ctx.ruleset,
        ctx.state.character,
        own,
        false,
        links,
        undefined,
        ctx.memo.batch,
      );
      if (!applied.ok)
        throw new ActionError('proposed-changes-failed', { step: path, error: applied.errors[0] });
      sheet = new Sheet(ctx.ruleset, applied.character, [], links);
      ctx.memo.sheets.set(key, sheet);
    }
  }
  ctx.cached = { count, sheet };
  return sheet;
}

function activationKey(a: Activation): string {
  return JSON.stringify([a.kind, a.scope, entryOf(a), a.item?.qid, a.sourceId, a.path]);
}

function onSheet(ctx: Ctx, frame: Frame): Frame {
  if (frame.sheet === ctx.sheet) return frame;
  // A rules action reads the rules' picks, which may have changed.
  if (!frame.activation)
    return { ...frame, roots: { ...frame.roots, ...ownerRoots(ctx.sheet.rulesRoots()) } };
  const key = activationKey(frame.activation);
  const found = ctx.sheet.activations.find((a) => activationKey(a) === key);
  const roots = { ...frame.roots };
  delete roots.item;
  delete roots.self;
  delete roots[f.OWNER_PICKS];
  delete roots[f.OWNER_GRANTED];
  return {
    ...frame,
    sheet: ctx.sheet,
    roots: { ...roots, ...(found ? ownerRoots(ctx.sheet.actionRoots(found)) : {}) },
  };
}

/** The roots an action takes from its owner: `item`, `self` and the picks `picksOf` reads. */
export function ownerRoots(own: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ['item', 'self', f.OWNER_PICKS, f.OWNER_GRANTED])
    if (own[key] !== undefined) out[key] = own[key];
  return out;
}

/** Its result is the list of per-participant results, null where `when` skipped one. */
function eachStep(ctx: Ctx, frame: Frame, step: Step): void {
  const role = step.each as string;
  const roots = frame.roots.participants as Record<string, Record<string, unknown>[]>;
  const list = roots[role] ?? [];
  if (list.length === 0) return;
  frame.eachOf.set(step.id, role);
  frame.steps[step.id] = list.map(() => null);
  for (const [index, view] of list.entries()) {
    if (index > 0 && ++ctx.stepsRun > MAX_STEPS)
      throw new ActionError('safety-limit-exceeded', { limit: 'maxActionSteps' });
    const sub: Frame = { ...frame, each: { role, index, view, step: step.id } };
    const path = `${frame.prefix}${step.id}[${index}]`;
    onStepSheet(ctx, sub, step, path, (current) => {
      if (test(ctx, current, step.when)) runStep(ctx, current, step, path);
    });
  }
}

function runStep(ctx: Ctx, frame: Frame, step: Step, path: string): void {
  switch (step.kind) {
    case 'roll':
      rollStep(ctx, frame, step, path);
      break;
    case 'choice':
      choiceStep(ctx, frame, step, path);
      break;
    case 'allocate':
      allocateStep(ctx, frame, step, path);
      break;
    case 'branch': {
      const arm = (step.cases ?? []).find((c) => test(ctx, frame, c.when)) ?? step.else;
      if (!arm) break;
      for (const [name, formula] of Object.entries(arm.flags ?? {}))
        setFlag(frame, name, rootValue(evaluate(ctx, frame, formula)), step.each !== undefined);
      runSteps(ctx, { ...frame, prefix: `${path}/` }, arm.steps ?? []);
      break;
    }
    case 'changes':
      changesStep(ctx, frame, step, path);
      break;
    case 'group':
      groupStep(ctx, frame, step, path);
      break;
    case 'action': {
      if (step.as === 'participant') {
        handoff(ctx, frame, step, path);
        break;
      }
      const raw = stepParams(ctx, frame, step);
      const target = nestedRun(ctx, frame, step);
      const nested = startFrame(
        ctx,
        target.action,
        target.entry,
        target.source,
        raw,
        `${path}/`,
        frame.depth + 1,
        {
          ...(step.participants !== undefined
            ? { participants: passedParticipants(ctx, frame, step) }
            : {}),
          added: [...frame.added, ...tagsOf(ctx, step.tags, (fm) => evaluate(ctx, frame, fm))],
          situational: stepSituational(ctx, frame, step),
        },
      );
      let outcome: Outcome = {};
      const first = ctx.proposed.length;
      try {
        runSteps(ctx, nested, nested.def.steps);
      } catch (error) {
        if (!(error instanceof Finish)) throw error;
        outcome = error.outcome;
      }
      if (step.hold) hold(ctx, frame, step.id, first);
      setResult(frame, step.id, {
        ...(outcome.result !== undefined ? { result: outcome.result } : {}),
        data: outcome.data ?? {},
      });
      break;
    }
    case 'outcome': {
      const result =
        step.result === undefined ? undefined : String(f.toData(evaluate(ctx, frame, step.result)));
      if (result !== undefined && !declaresResult(ctx.ruleset, frame.def, result))
        throw new ActionError('undeclared-result', { result });
      const data: Record<string, unknown> = {};
      for (const [name, formula] of Object.entries(step.data ?? {}))
        data[name] = outputData(evaluate(ctx, frame, formula));
      throw new Finish({
        ...(result !== undefined ? { result } : {}),
        ...(step.data ? { data } : {}),
      });
    }
  }
}

/**
 * Runs its steps once per pass at `<path>[<n>]/`, again while `while` holds, up to `max`. Each
 * pass starts without the inner steps' results; `steps.<group>` lists the finished passes.
 */
function groupStep(ctx: Ctx, frame: Frame, step: Step, path: string): void {
  const repeat = step.repeat as { max: Formula; while: Formula };
  const max = integer(evaluate(ctx, frame, repeat.max), 'repeat.max');
  const inner = innerSteps(step).map((s) => s.id);
  const passes: Record<string, unknown>[] = [];
  setResult(frame, step.id, []);
  for (let n = 0; n < max; n++) {
    if (n >= MAX_PASSES)
      throw new ActionError('safety-limit-exceeded', { limit: 'maxGroupPasses' });
    if (n > 0 && ++ctx.stepsRun > MAX_STEPS)
      throw new ActionError('safety-limit-exceeded', { limit: 'maxActionSteps' });
    const prefix = `${path}[${n}]/`;
    for (const id of inner) clearResult(frame, id);
    for (const own of step.steps ?? []) frame.passOf.set(own.id, prefix);
    runSteps(ctx, { ...frame, prefix }, step.steps ?? []);
    const pass: Record<string, unknown> = {};
    for (const id of inner) {
      const value = resultOf(frame, id);
      if (value !== undefined && value !== null) pass[id] = value;
    }
    passes.push(pass);
    setResult(frame, step.id, [...passes]);
    if (!test(ctx, frame, repeat.while)) break;
  }
  // Afterwards each step reads its latest run, whichever pass made it.
  for (const id of inner) {
    const last = passes.findLastIndex((pass) => Object.hasOwn(pass, id));
    if (last < 0) continue;
    setResult(frame, id, passes[last]?.[id]);
    if (frame.passOf.has(id)) frame.passOf.set(id, `${path}[${last}]/`);
  }
}

/** A formula giving `null` leaves its parameter out. */
function stepParams(ctx: Ctx, frame: Frame, step: Step): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [name, formula] of Object.entries(step.params ?? {})) {
    const value = evaluate(ctx, frame, formula);
    if (value.kind !== 'null') raw[name] = outputData(value);
  }
  return raw;
}

function stepSituational(ctx: Ctx, frame: Frame, step: Step): Record<string, unknown> {
  const out = { ...frame.situational };
  for (const [qid, formula] of Object.entries(step.situational ?? {})) {
    const def = ctx.ruleset.rules.situational[qid];
    const value = f.toData(evaluate(ctx, frame, formula));
    const ok =
      def === undefined ||
      (def.type === 'boolean'
        ? typeof value === 'boolean'
        : def.type === 'integer'
          ? Number.isInteger(value)
          : typeof value === 'string' && (def.values ?? []).includes(value));
    if (!ok) throw new ActionError('wrong-type', { target: qid, ...expectedData(def, def?.type) });
    out[qid] = value;
  }
  return out;
}

/**
 * Without `source` or `entry`, `use` runs with the parent's own entry and source; otherwise as
 * `computeSheet` lists it with those (a local `use` names `<source>#<use>`, or without `source`
 * `<entry's item>#<use>`), preferring the parent's entry.
 */
function nestedRun(
  ctx: Ctx,
  frame: Frame,
  step: Step,
): { action: string; entry?: string; source?: string } {
  const use = step.use as string;
  if (step.source === undefined && step.entry === undefined)
    return {
      action: use,
      ...(frame.entry !== undefined ? { entry: frame.entry } : {}),
      ...(frame.source !== undefined ? { source: frame.source } : {}),
    };
  let source: string | undefined;
  if (step.source !== undefined) {
    const value = evaluate(ctx, frame, step.source);
    if (value.kind !== 'string')
      throw new ActionError('type-mismatch', { message: `source evaluated to ${value.kind}` });
    source = resolveContent(ctx.ruleset, value.value, frame.pack) ?? value.value;
  }
  let entry: string | undefined;
  if (step.entry !== undefined) {
    const value = evaluate(ctx, frame, step.entry);
    if (value.kind !== 'string')
      throw new ActionError('type-mismatch', { message: `entry evaluated to ${value.kind}` });
    entry = value.value;
  }
  // A `use` no rules action has is a local action ID: the source's, else the entry's own item's.
  const owner = ctx.ruleset.rules.actions[use]
    ? undefined
    : (source ??
      ctx.sheet.activations.find((a) => a.item && ownsEntry(a) && entryOf(a) === entry)?.item?.qid);
  const action = owner === undefined ? use : `${owner}#${use}`;
  // `source` alone also names content that is a copy's own item, listed by the copy's entry.
  const owners =
    source !== undefined && entry === undefined
      ? new Set(
          ctx.sheet.activations
            .filter((a) => a.item?.qid === source && ownsEntry(a))
            .map((a) => entryOf(a)),
        )
      : undefined;
  const listed = ctx.sheet
    .actions(true)
    .filter(
      (a) =>
        a.action === action &&
        (a.source === source ||
          (a.source === undefined && a.entry !== undefined && owners?.has(a.entry) === true)) &&
        (entry === undefined || a.entry === entry),
    );
  const found = listed.find((a) => a.entry === frame.entry) ?? listed[0];
  if (!found)
    throw new ActionError('unknown-action', {
      action,
      ...(entry !== undefined ? { entry } : {}),
      ...(source !== undefined ? { source } : {}),
    });
  return found;
}

function passedParticipants(ctx: Ctx, frame: Frame, step: Step): Record<string, View[]> {
  const out: Record<string, View[]> = {};
  for (const [role, ids] of Object.entries(participantIds(ctx, frame, step))) {
    out[role] = ids.map((id) => {
      const view = frame.views.get(id);
      if (!view) throw new ActionError('invalid-participants', { role });
      return view;
    });
  }
  return out;
}

function participantIds(ctx: Ctx, frame: Frame, step: Step): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [role, formula] of Object.entries(step.participants ?? {})) {
    const value = evaluate(ctx, frame, formula);
    const ids =
      value.kind === 'list'
        ? value.value.map((v) => {
            if (v.kind === 'string') return v.value;
            const data = v.kind === 'object' ? (f.toData(v) as Record<string, unknown>) : {};
            return typeof data.id === 'string' ? data.id : undefined;
          })
        : [undefined];
    if (ids.some((id) => id === undefined))
      throw new ActionError('type-mismatch', {
        message: `participants.${role} evaluated to ${value.kind}, not a list of IDs or views`,
      });
    out[role] = ids as string[];
  }
  return out;
}

function handoffParticipants(
  ctx: Ctx,
  frame: Frame,
  step: Step,
  used: ActionDef,
): Record<string, string[]> | undefined {
  if (step.participants === undefined) return undefined;
  const given = participantIds(ctx, frame, step);
  const roles = used.participants ?? {};
  const self = ctx.state.character.id;
  const seen = new Set<string>();
  for (const [role, ids] of Object.entries(given)) {
    if (!Object.hasOwn(roles, role)) throw new ActionError('invalid-participants', { role });
    for (const id of ids) {
      if (id !== self && !frame.views.has(id))
        throw new ActionError('invalid-participants', { role });
      if (seen.has(id)) throw new ActionError('duplicate-id', { id });
      seen.add(id);
    }
  }
  for (const [role, decl] of Object.entries(roles)) {
    const count = given[role]?.length ?? 0;
    if (count < (decl.min ?? 0) || (decl.max !== undefined && count > decl.max))
      throw new ActionError('invalid-participants', { role });
  }
  return given;
}

/** The participant runs the used action on its own character; the policy doesn't apply. */
function handoff(ctx: Ctx, frame: Frame, step: Step, path: string): void {
  const each = frame.each;
  if (!each) throw new ActionError('unknown-role', { step: step.id, pack: frame.pack });
  const qid = step.use as string;
  const used = ctx.ruleset.rules.actions[qid];
  if (!used) throw new ActionError('unknown-action', { action: qid });
  const given = stepParams(ctx, frame, step);
  for (const [name, decl] of Object.entries(used.params ?? {})) {
    if (decl.type === 'id' && decl.of === 'field' && name in given)
      given[name] = fieldIdOf(given[name]);
    const value = given[name];
    if (value === undefined) {
      if (decl.optional || decl.default !== undefined) continue;
      throw new ActionError('missing-param', { param: name, action: qid });
    }
    const typed = decl.type === 'id' && decl.of === 'field' ? undefined : typedValue(decl, value);
    if (typeof typed === 'string')
      throw new ActionError('wrong-type', {
        target: name,
        ...expectedData(decl, typed),
        action: qid,
      });
    // A bound that reads the participant's character is checked when its action starts.
    if (typed)
      paramRange(name, { action: qid }, decl, typed, (bound) =>
        typeof bound === 'number' ? bound : undefined,
      );
  }
  const passed = handoffParticipants(ctx, frame, step, used);
  const participant = { role: each.role, id: each.view.id as string };
  const [answer] = takeAnswers(ctx, path, 'handoff');
  if (!answer?.outcome)
    throw new Pause({
      step: path,
      action: frame.qid,
      kind: 'handoff',
      participant,
      run: { action: qid, params: given, ...(passed ? { participants: passed } : {}) },
    });
  const outcome = answer.outcome;
  if (outcome.result !== undefined && !declaresResult(ctx.ruleset, used, outcome.result))
    throw new ActionError('answer-mismatch', { reason: 'the result is not declared' });
  ctx.log.push({ step: path, action: frame.qid, kind: 'handoff', by: 'app', participant, outcome });
  setResult(frame, step.id, {
    ...(outcome.result !== undefined ? { result: outcome.result } : {}),
    data: outcome.data ?? {},
  });
}

interface BuiltItem {
  kind: 'dice' | 'flat';
  term?: f.DiceTerm;
  flat?: number;
  source: Source;
  tags: string[];
  part?: string;
  pool: { source: Source; count: number }[];
  baseCount?: number;
  rolled?: f.RolledTerm;
  unmultiplied?: true;
  factor?: number;
  multipliedValue?: number;
  field?: string;
  dropped?: { source: Source; value: number }[];
  replaces?: RollItem[];
  steppedFrom?: number;
  preset?: number[];
}

function itemValue(i: BuiltItem): number {
  if (i.multipliedValue !== undefined) return i.multipliedValue;
  return i.kind === 'flat'
    ? (i.flat as number)
    : (i.term as f.DiceTerm).sign * ((i.rolled?.value as number) ?? 0);
}

function readsField(added: BuiltItem[], value: f.Value, qid: string): BuiltItem[] {
  if ((value.kind === 'int' || value.kind === 'decimal') && added.length === 1)
    (added[0] as BuiltItem).field = qid;
  return added;
}

function itemsFromValue(
  value: f.Value,
  source: Source,
  tags: string[],
  part?: string,
): BuiltItem[] {
  const out: BuiltItem[] = [];
  if (value.kind === 'dice') {
    for (const term of value.value.terms)
      out.push({
        kind: 'dice',
        term: { ...term, modifiers: [...term.modifiers] },
        source,
        tags,
        ...(part ? { part } : {}),
        pool: [],
      });
    if (value.value.flat !== 0)
      out.push({
        kind: 'flat',
        flat: value.value.flat,
        source,
        tags,
        ...(part ? { part } : {}),
        pool: [],
      });
  } else if (value.kind === 'int' || value.kind === 'decimal') {
    out.push({
      kind: 'flat',
      flat: value.value,
      source,
      tags,
      ...(part ? { part } : {}),
      pool: [],
    });
  } else {
    throw new ActionError('type-mismatch', { message: `a roll part evaluated to ${value.kind}` });
  }
  return out;
}

interface CarriedCandidate {
  on: BuiltItem;
  value: f.Value;
}

const groupOf = (c: { instance: EffectInstance; effect: Effect }) =>
  c.effect.stackKey === 'source' ? c.instance.sourceId : c.effect.stackKey;

const targets = (e: Effect) =>
  typeof e.target === 'object' && 'rolls' in e.target ? e.target : undefined;

const DIE_LADDER: readonly number[] = [4, 6, 8, 10, 12];

type Repeat = { times: number; keep: 'high' | 'low'; items?: number[] };

/** How opposing advantage and disadvantage sources combine: the extras and their kind. */
function netAdvantage(
  ctx: Ctx,
  advantage: number,
  disadvantage: number,
  path: string,
): { extra: number; kind: 'advantage' | 'disadvantage' } {
  const mode = ctx.ruleset.rules.settings.rollModifiers?.advantage ?? 'cancel';
  if (mode === 'cancel')
    return advantage > 0 && disadvantage > 0
      ? { extra: 0, kind: 'advantage' }
      : { extra: 1, kind: advantage > 0 ? 'advantage' : 'disadvantage' };
  if (mode === 'net')
    return {
      extra: Math.abs(advantage - disadvantage),
      kind: advantage >= disadvantage ? 'advantage' : 'disadvantage',
    };
  if (advantage > 0 && disadvantage > 0)
    throw new ActionError('conflicting-roll-modifiers', { step: path });
  return { extra: advantage + disadvantage, kind: advantage > 0 ? 'advantage' : 'disadvantage' };
}

function rollStep(ctx: Ctx, frame: Frame, step: Step, path: string): void {
  if (step.of !== undefined) {
    classifyAgain(ctx, frame, step, path, step.of);
    return;
  }
  const { sheet, ruleset } = ctx;
  const stepTags = ownTags(ctx, frame, step);
  let items: BuiltItem[] = [];
  const parts = step.parts ?? [];

  // 1. Parts.
  parts.forEach((part, index) => {
    if (!test(ctx, frame, part.when)) return;
    const partId = part.id ?? `#${index}`;
    const tags = tagsOf(ctx, part.tags, (fm) => evaluate(ctx, frame, fm));
    if (part.field !== undefined) {
      const ref = String(f.toData(evaluate(ctx, frame, part.field)));
      const qid = resolveField(ruleset, ref, frame.pack);
      if (!qid) throw new ActionError('unknown-field', { field: ref });
      const value = sheet.fieldValue(qid);
      items.push(
        ...readsField(itemsFromValue(value, { type: 'field', id: qid }, tags, partId), value, qid),
      );
    } else if (part.dice !== undefined) {
      items.push(
        ...itemsFromValue(evaluate(ctx, frame, part.dice), frame.ownerSource, tags, partId),
      );
    } else if (part.value !== undefined) {
      const tree = typeof part.value === 'string' ? f.parse(part.value) : undefined;
      const fieldRef =
        tree?.ok && tree.value.type === 'name'
          ? resolveField(ruleset, tree.value.path.join('.'), frame.pack)
          : undefined;
      const source: Source =
        (part.source as Source | undefined) ??
        (fieldRef ? { type: 'field', id: fieldRef } : frame.ownerSource);
      const value = evaluate(ctx, frame, part.value);
      const added = itemsFromValue(value, source, tags, partId);
      items.push(...(fieldRef ? readsField(added, value, fieldRef) : added));
    }
    if (part.multiplied === false)
      for (const item of items) if (item.part === partId) item.unmultiplied = true;
  });

  // 2. Roll effects. Their `roll.self` has no computed values.
  const rollRoot = {
    item: frame.roots.item,
    self: frame.activation ? frame.activation.roots.self : frame.roots.self,
    tags: stepTags,
  };
  const candidates: {
    instance: EffectInstance;
    effect: Effect;
    pack: string;
    roots: Record<string, unknown>;
  }[] = [];
  for (const instance of sheet.instances) {
    const t = targets(instance.effect);
    if (!t || !t.rolls.some((tag) => matchesTag(tag, stepTags))) continue;
    if (t.from === 'self' && instance.source.entry !== frame.entry) continue;
    candidates.push({
      instance,
      effect: instance.effect,
      pack: instance.pack,
      roots: instance.roots,
    });
  }
  const situational = frame.roots.situational as Record<string, unknown>;
  for (const [qid, def] of Object.entries(ruleset.rules.situational)) {
    const value = situational[def.id];
    if (value === undefined) continue;
    const selected =
      def.type === 'boolean'
        ? value === true
        : value !== (def.default ?? (def.type === 'integer' ? 0 : ''));
    if (!selected) continue;
    (def.effects ?? []).forEach((effect, index) => {
      const t = targets(effect);
      if (!t || !t.rolls.some((tag) => matchesTag(tag, stepTags))) return;
      const instance: EffectInstance = {
        effect,
        pack: def.pack,
        roots: {},
        source: { type: 'situational', id: qid },
        optionId: `${qid}#${index}`,
        sourceId: qid,
        order: -1,
      };
      candidates.push({ instance, effect, pack: def.pack, roots: {} });
    });
  }
  // `item` and `self` are the effect's content, the action's own item and copy are `action`.
  const { item: _item, self: _self, ...actionContext } = context(frame);
  const action = actionRoot(ctx, frame, step);
  const effectCtx = (c: (typeof candidates)[number]) => ({
    ...actionContext,
    ...c.roots,
    action,
    roll: rollRoot,
  });
  const active = candidates.filter((c) => {
    if (c.effect.when === undefined) return true;
    const v = sheet.evaluate(c.effect.when, c.pack, effectCtx(c));
    return v.kind === 'bool' && v.value;
  });
  const onPart = (c: (typeof active)[number], tags: string[]) =>
    (targets(c.effect)?.parts ?? []).some((t) => matchesTag(t, tags));
  // The effects that changed the roll, whose `then` is proposed after it.
  const changed = new Set<(typeof active)[number]>();
  // 2a. Replaced parts: matching `set` effects replace a part's items before anything reads them.
  const sets = active.filter((c) => c.effect.op === 'set' && targets(c.effect)?.parts);
  if (sets.length > 0) {
    const partIds = [...new Set(items.flatMap((i) => (i.part === undefined ? [] : [i.part])))];
    for (const partId of partIds) {
      const own = items.filter((i) => i.part === partId);
      const tags = own[0]?.tags ?? [];
      const kept = stack(
        ctx,
        sets.filter((c) => onPart(c, tags)),
        effectCtx,
      );
      if (kept.length === 0) continue;
      const valued = kept.map((c) => ({
        c,
        value: sheet.evaluate(c.effect.value as Formula, c.pack, effectCtx(c)),
      }));
      const policy = ruleset.rules.settings.competing?.recommend ?? 'highest';
      let chosen = valued[0] as (typeof valued)[number];
      if (policy === 'last') chosen = valued.at(-1) as typeof chosen;
      else if (policy === 'highest' || policy === 'lowest')
        for (const o of valued) {
          const d = average(o.value) - average(chosen.value);
          if (policy === 'highest' ? d > 0 : d < 0) chosen = o;
        }
      const { c, value } = chosen;
      changed.add(c);
      const tree = typeof c.effect.value === 'string' ? f.parse(c.effect.value) : undefined;
      const fieldRef =
        tree?.ok && tree.value.type === 'name'
          ? resolveField(ruleset, tree.value.path.join('.'), c.pack)
          : undefined;
      const source: Source = fieldRef ? { type: 'field', id: fieldRef } : c.instance.source;
      let replacement = itemsFromValue(value, source, tags, partId);
      if (fieldRef) replacement = readsField(replacement, value, fieldRef);
      if (replacement.length === 0)
        replacement = [{ kind: 'flat', flat: 0, source, tags, part: partId, pool: [] }];
      if (own.some((i) => i.unmultiplied)) for (const r of replacement) r.unmultiplied = true;
      (replacement[0] as BuiltItem).replaces = output(own);
      const at = items.indexOf(own[0] as BuiltItem);
      items = [
        ...items.slice(0, at),
        ...replacement,
        ...items.slice(at).filter((i) => i.part !== partId),
      ];
    }
  }
  // 2b. Die steps.
  const steppers = stack(
    ctx,
    active.filter(
      (c) => c.effect.op === 'rollModifier' && (c.effect.value as RollModifier).kind === 'stepDie',
    ),
    effectCtx,
    (c) => (c.effect.value as RollModifier).steps as Formula,
  );
  if (steppers.length > 0)
    for (const item of items) {
      const term = item.term;
      if (!term || item.part === undefined || term.sides === 'F' || term.zero) continue;
      let steps = 0;
      const reaching: (typeof active)[number][] = [];
      for (const c of steppers) {
        if (targets(c.effect)?.parts && !onPart(c, item.tags)) continue;
        const formula = (c.effect.value as RollModifier).steps as Formula;
        const by = integer(sheet.evaluate(formula, c.pack, effectCtx(c)), 'steps');
        steps += by;
        if (by !== 0) reaching.push(c);
      }
      const at = DIE_LADDER.indexOf(term.sides);
      if (steps === 0 || at < 0) continue;
      const sides = DIE_LADDER[Math.max(0, Math.min(DIE_LADDER.length - 1, at + steps))] as number;
      if (sides === term.sides) continue;
      for (const c of reaching) changed.add(c);
      item.steppedFrom = term.sides;
      term.sides = sides;
    }
  const modifiers: { modifier: RollModifier; c: (typeof active)[number] }[] = [];
  const adds = active.filter(
    (x) => x.effect.op === 'add' && targets(x.effect)?.tally === undefined,
  );
  // A part reading a field carries the field's keyed `add`s into the roll's stacking; one that
  // loses comes off its part's item.
  const keys = new Set(adds.map(groupOf).filter((k) => k !== undefined));
  const carried: (CarriedCandidate & (typeof active)[number])[] = [];
  if (keys.size > 0)
    for (const item of items) {
      if (item.field === undefined) continue;
      for (const { instance, value } of sheet.carried(item.field))
        if (keys.has(groupOf({ instance, effect: instance.effect }) as string))
          carried.push({
            instance,
            effect: instance.effect,
            pack: instance.pack,
            roots: instance.roots,
            on: item,
            value,
          });
    }
  const counted = stack(ctx, [...adds, ...carried], effectCtx);
  for (const c of carried) {
    if (counted.includes(c)) continue;
    const amount = c.value.kind === 'int' || c.value.kind === 'decimal' ? c.value.value : 0;
    c.on.flat = f.roundDecimal((c.on.flat ?? 0) - amount);
    (c.on.dropped ??= []).push({ source: c.instance.source, value: amount });
  }
  for (const c of counted) {
    if ((carried as unknown[]).includes(c)) continue;
    changed.add(c);
    const value = sheet.evaluate(c.effect.value as Formula, c.pack, effectCtx(c));
    const tags = tagsOf(ctx, c.effect.tags, (fm) => sheet.evaluate(fm, c.pack, effectCtx(c)));
    const added = itemsFromValue(value, c.instance.source, tags);
    if (c.effect.multiplied === false) for (const item of added) item.unmultiplied = true;
    items.push(...added);
  }
  const multiplies = stack(
    ctx,
    active.filter(
      (x) => x.effect.op === 'rollModifier' && (x.effect.value as RollModifier).kind === 'multiply',
    ),
    effectCtx,
    (c) => (c.effect.value as RollModifier).factor as Formula,
  );
  for (const c of active)
    if (
      c.effect.op === 'rollModifier' &&
      ((c.effect.value as RollModifier).kind !== 'multiply' || multiplies.includes(c))
    )
      modifiers.push({ modifier: c.effect.value as RollModifier, c });

  const num = (formula: Formula | undefined, c: (typeof active)[number], fallback: number) => {
    if (formula === undefined) return fallback;
    const v = sheet.evaluate(formula, c.pack, effectCtx(c));
    return v.kind === 'int' || v.kind === 'decimal' ? v.value : fallback;
  };
  for (const item of items) if (item.term) item.baseCount = item.term.count;

  // 3. Pool dice.
  for (const { modifier, c } of modifiers) {
    if (modifier.kind !== 'poolDice') continue;
    const partId =
      modifier.part ?? items.find((i) => i.kind === 'dice' && i.part !== undefined)?.part;
    const target = items.find((i) => i.kind === 'dice' && i.part === partId);
    if (!target?.term) continue;
    const count = num(modifier.count, c, 0);
    if (count !== 0) changed.add(c);
    target.term.count += count;
    target.pool.push({ source: c.instance.source, count });
  }
  // 4. Empty pools.
  let empty = false;
  for (const [index, part] of parts.entries()) {
    if (part.ifEmpty === undefined) continue;
    const partId = part.id ?? `#${index}`;
    const first = items.find((i) => i.kind === 'dice' && i.part === partId);
    if (!first?.term || first.term.count > 0) continue;
    const replacement = itemsFromValue(
      evaluate(ctx, frame, part.ifEmpty),
      first.source,
      first.tags,
      partId,
    );
    items = [
      ...items.filter((i) => i.part !== partId || i.kind !== 'dice' || i !== first),
      ...replacement,
    ].filter((i) => !(i.part === partId && i === first));
    for (const item of replacement) {
      if (item.term) item.baseCount = item.term.count;
      if (first.unmultiplied) item.unmultiplied = true;
    }
    empty = true;
  }
  // 5. Advantage and disadvantage; `noAdvantage`/`noDisadvantage` remove every counted source.
  // Sources on the roll's parts (`of: roll`) are counted apart and roll those parts again.
  let repeat: Repeat | undefined;
  let again: Set<BuiltItem> | undefined;
  const has = (kind: string) => modifiers.some((m) => m.modifier.kind === kind);
  const sources = (kind: string, onParts: boolean) =>
    has(kind === 'advantage' ? 'noAdvantage' : 'noDisadvantage')
      ? []
      : modifiers.filter(
          (m) => m.modifier.kind === kind && (targets(m.c.effect)?.parts !== undefined) === onParts,
        );
  for (const [no, kind] of [
    ['noAdvantage', 'advantage'],
    ['noDisadvantage', 'disadvantage'],
  ] as const)
    if (modifiers.some((m) => m.modifier.kind === kind))
      for (const m of modifiers) if (m.modifier.kind === no) changed.add(m.c);
  const highBetter = (step.better ?? 'high') === 'high';
  const keepOf = (kind: 'advantage' | 'disadvantage') =>
    (kind === 'advantage') === highBetter ? 'high' : 'low';
  const advantage = sources('advantage', false);
  const disadvantage = sources('disadvantage', false);
  if (advantage.length + disadvantage.length > 0) {
    const { extra, kind } = netAdvantage(ctx, advantage.length, disadvantage.length, path);
    // One source of the kind that applies with `of: roll` makes the extras whole rolls.
    const whole = (kind === 'advantage' ? advantage : disadvantage).some(
      (m) => m.modifier.of === 'roll',
    );
    const main = items.find((i) => i.kind === 'dice');
    if (extra > 0 && main?.term)
      for (const m of kind === 'advantage' ? advantage : disadvantage) changed.add(m.c);
    if (extra > 0 && whole) {
      if (main) repeat = { times: extra + 1, keep: keepOf(kind) };
    } else if (extra > 0 && main?.term) {
      const hasKeep = main.term.modifiers.some((m) =>
        ['keepHighest', 'keepLowest', 'dropHighest', 'dropLowest'].includes(m.type),
      );
      if (!hasKeep) {
        const keepHigh = kind === 'advantage' ? highBetter : !highBetter;
        main.term.modifiers.push({
          type: keepHigh ? 'keepHighest' : 'keepLowest',
          count: main.term.count,
        });
      }
      main.term.count += extra;
    }
  }
  const partAdvantage = sources('advantage', true);
  const partDisadvantage = sources('disadvantage', true);
  // A roll made again whole already rolls its parts again.
  if (!repeat && partAdvantage.length + partDisadvantage.length > 0) {
    const { extra, kind } = netAdvantage(ctx, partAdvantage.length, partDisadvantage.length, path);
    const reaching = kind === 'advantage' ? partAdvantage : partDisadvantage;
    const group = items.filter(
      (i) => i.kind === 'dice' && i.part !== undefined && reaching.some((m) => onPart(m.c, i.tags)),
    );
    if (extra > 0 && group.length > 0) {
      for (const m of reaching) if (group.some((i) => onPart(m.c, i.tags))) changed.add(m.c);
      again = new Set(group);
      repeat = {
        times: extra + 1,
        keep: keepOf(kind),
        items: group.map((i) => items.indexOf(i)),
      };
    }
  }
  // 6. Multiply dice. 7. Reroll, minimum face, explode.
  for (const { modifier, c } of modifiers) {
    if (modifier.kind === 'multiplyDice') {
      const factor = num(modifier.factor, c, 1);
      for (const item of items)
        if (item.term && !item.unmultiplied) {
          if (factor !== 1 && item.term.count > 0) changed.add(c);
          item.term.count *= factor;
        }
    }
  }
  for (const { modifier, c } of modifiers) {
    let add: f.DiceModifier | undefined;
    if (modifier.kind === 'reroll')
      add = {
        type: 'rerollOnce',
        compare: '<=',
        target: num(modifier.below, c, 1),
        ...(modifier.count === undefined
          ? {}
          : { count: Math.max(0, Math.trunc(num(modifier.count, c, 0))) }),
      };
    if (modifier.kind === 'minimumFace')
      add = { type: 'minimum', target: num(modifier.value, c, 1) };
    if (modifier.kind === 'explode')
      add =
        modifier.at === undefined
          ? { type: 'explode' }
          : { type: 'explode', compare: '>=', target: num(modifier.at, c, 1) };
    if (!add) continue;
    for (const item of items) {
      if (!item.term || item.term.modifiers.some((m) => m.type === add.type)) continue;
      changed.add(c);
      item.term.modifiers = [...item.term.modifiers, add].toSorted(
        (a, b) => MODIFIER_ORDER.indexOf(a.type) - MODIFIER_ORDER.indexOf(b.type),
      );
    }
  }
  for (const item of items) {
    if (item.term && item.term.count > 1000)
      throw new ActionError('safety-limit-exceeded', { limit: 'maxDicePerItem' });
  }
  // 8. Set faces.
  for (const { modifier, c } of modifiers) {
    if (modifier.kind !== 'setFaces') continue;
    const byPart = targets(c.effect)?.parts !== undefined;
    const item = items.find(
      (i) => i.kind === 'dice' && (!byPart || (i.part !== undefined && onPart(c, i.tags))),
    );
    const term = item?.term;
    if (!item || !term || item.preset) continue;
    changed.add(c);
    const [lo, hi] =
      term.sides === 'F' ? [-1, 1] : term.zero ? [0, term.sides - 1] : [1, term.sides];
    item.preset = (modifier.faces ?? []).slice(0, term.count).map((formula) => {
      const face = integer(sheet.evaluate(formula, c.pack, effectCtx(c)), 'a set face');
      if (face < lo || face > hi)
        throw new ActionError('invalid-face', {
          message: `face ${face} is not on a d${term.sides}${term.zero ? 'z' : ''}`,
        });
      return face;
    });
  }

  // A roll with no dice items is not a checkpoint: it never pauses and records no answer.
  // A roll made again (`of: roll`) is a copy of the built items, without given faces; on parts,
  // only the parts' items are copied and the others are shared, rolled once.
  const rolls: BuiltItem[][] = [items];
  for (let k = 1; k < (repeat?.times ?? 1); k++)
    rolls.push(
      items.map((item) => {
        if (again && !again.has(item)) return item;
        const { preset: _preset, ...i } = item;
        return structuredClone(i);
      }),
    );
  const diceOf = (list: BuiltItem[]) => list.filter((i) => i.term && i.term.count >= 0);
  const allDice = [...new Set(rolls.flatMap(diceOf))];
  const checkpoint = items.some((i) => i.kind === 'dice');
  const asked = (i: BuiltItem) =>
    Math.max(0, (i.term as f.DiceTerm).count - (i.preset?.length ?? 0));
  const needs: Need['dice'] = allDice.map((i) => {
    const t = i.term as f.DiceTerm;
    return {
      count: asked(i),
      sides: t.sides,
      ...(t.zero ? { zero: true } : {}),
      ...(i.tags.length ? { tags: i.tags } : {}),
    };
  });
  // The summary is built before any face is rolled.
  const summarySet = step.bands ? ruleset.rules.bands[step.bands] : undefined;
  const summary = rollSummary(step.bands, summarySet, flagsOf(frame), (node) =>
    ctx.sheet.evaluate(f.print(node), summarySet?.pack ?? frame.pack, context(frame)),
  );
  const auto = !checkpoint || decide(ctx.policy, 'roll', stepTags, path) === 'auto';
  const answers = checkpoint ? takeAnswers(ctx, path, 'dice') : [];
  const consumed: number[] = [];
  let by: 'engine' | 'app' = 'engine';
  if (checkpoint && answers.length === 0 && needs.some((n) => n.count > 0)) {
    if (!auto)
      throw new Pause({
        step: path,
        action: frame.qid,
        kind: 'dice',
        dice: needs,
        items: output(items),
        summary,
        ...(repeat ? { repeat } : {}),
      });
    const faces = allDice.flatMap((i) =>
      ctx.dice(asked(i), (i.term as f.DiceTerm).sides, (i.term as f.DiceTerm).zero === true),
    );
    recordAnswer(ctx, { step: path, kind: 'dice', by: 'engine', faces });
    answers.push({ step: path, kind: 'dice', by: 'engine', faces });
  }
  const queue: number[] = answers.flatMap((a) => a.faces ?? []);
  if (answers.some((a) => a.by === 'app')) by = 'app';
  const source: f.FaceSource = (sides, zero) => {
    if (queue.length === 0) {
      const more = takeAnswers(ctx, path, 'dice');
      if (more.length > 0) {
        queue.push(...more.flatMap((a) => a.faces ?? []));
        if (more.some((a) => a.by === 'app')) by = 'app';
      } else if (auto) {
        const faces = ctx.dice(1, sides, zero);
        recordAnswer(ctx, { step: path, kind: 'dice', by: 'engine', faces });
        queue.push(...faces);
      } else {
        throw new Pause({
          step: path,
          action: frame.qid,
          kind: 'dice',
          dice: [{ count: 1, sides, ...(zero ? { zero: true } : {}) }],
          items: output(items),
          summary,
          ...(repeat ? { repeat } : {}),
        });
      }
    }
    const face = queue.shift() as number;
    consumed.push(face);
    return face;
  };
  for (const item of allDice) {
    const preset = [...(item.preset ?? [])];
    const faceSource: f.FaceSource = (sides, zero) =>
      preset.length > 0 ? (preset.shift() as number) : source(sides, zero);
    const rolled = f.roll(
      { terms: [{ ...(item.term as f.DiceTerm), sign: 1 }], flat: 0 },
      faceSource,
    );
    if (!rolled.ok) {
      if (rolled.error.code === 'invalid-face')
        throw new ActionError('answer-mismatch', { reason: rolled.error.message });
      throw new ActionError(rolled.error.code, {
        message: rolled.error.message,
        ...rolled.error.data,
      });
    }
    item.rolled = rolled.value.terms[0] as f.RolledTerm;
    for (let k = 0; k < (item.preset?.length ?? 0); k++) {
      const face = item.rolled.faces[k];
      if (face) face.set = true;
    }
    let index = item.baseCount ?? 0;
    for (const p of item.pool) {
      for (let k = 0; k < p.count; k++) {
        const face = item.rolled?.faces[index++];
        if (face) face.source = p.source;
      }
    }
  }
  // Integer results are rounded after each factor.
  for (const { modifier, c } of modifiers) {
    if (modifier.kind !== 'multiply') continue;
    const factor = num(modifier.factor, c, 1);
    const mode = c.effect.rounding ?? ruleset.rules.settings.rounding ?? 'floor';
    for (const item of new Set(rolls.flat())) {
      if (item.unmultiplied) continue;
      if (factor !== 1) changed.add(c);
      const before = itemValue(item);
      const raw = before * factor;
      let value = Number.isInteger(before) ? roundNumber(raw, mode) : raw;
      if (Object.is(value, -0)) value = 0;
      item.multipliedValue = value;
      item.factor = (item.factor ?? 1) * factor;
    }
  }
  // The better (or worse) whole roll is kept; the first among equal totals.
  const totals = rolls.map((list) => list.reduce((sum, i) => sum + itemValue(i), 0));
  let chosen = 0;
  totals.forEach((t, k) => {
    const best = totals[chosen] as number;
    if (repeat?.keep === 'low' ? t < best : t > best) chosen = k;
  });
  items = rolls[chosen] as BuiltItem[];
  const diceItems = diceOf(items);
  const unbounded = totals[chosen] as number;
  const bounds = rollBounds(
    ctx,
    active.filter((c) => targets(c.effect)?.tally === undefined),
    effectCtx,
    unbounded,
    changed,
  );
  const total = bounds.at(-1)?.value ?? unbounded;
  const allFaces = diceItems.flatMap((i) => (i.rolled?.faces ?? []).map((face) => face.value));
  const kept = diceItems.flatMap((i) =>
    (i.rolled?.faces ?? []).filter((face) => face.kept && !face.rerolled).map((face) => face.value),
  );
  const tallies = rollTallies(ctx, frame, active, effectCtx, changed);
  const result: Record<string, unknown> = {
    total,
    faces: allFaces,
    kept,
    empty,
    tallies: Object.fromEntries(tallies.map((t) => [t.name, t.value])),
    bounds,
    unbounded,
  };
  if (rolls.length > 1)
    result.rolls = rolls.map((list, k) => ({
      total: totals[k],
      kept: k === chosen,
      items: output(list),
    }));
  const bandValue = classify(ctx, frame, step.bands, result);
  const out = output(items);
  result.items = out;
  setResult(frame, step.id, result);
  frame.rollItems.set(itemsKey(frame, step.id), items);
  ctx.rolls.set(path, { result, items });
  ctx.log.push({
    step: path,
    action: frame.qid,
    kind: 'dice',
    by,
    ...(checkpoint ? { faces: consumed } : {}),
    items: out,
    total,
    ...(result.band ? { band: result.band as string, bandSet: step.bands } : {}),
    ...(bandValue !== undefined ? { bandValue: outputData(bandValue) } : {}),
    summary,
    ...(tallies.some((t) => t.value !== 0)
      ? { tallies: tallies.filter((t) => t.value !== 0) }
      : {}),
    ...(bounds.length ? { bounds } : {}),
    ...(result.rolls ? { rolls: result.rolls as RollLog[] } : {}),
  });
  // Each effect that changed the roll (or, `when: applied`, was in play on it) proposes its
  // `then`, in effect order, once per run (or, `once: roll`, per roll step run).
  const inPlay = (c: (typeof active)[number]) =>
    !targets(c.effect)?.parts || items.some((i) => i.part !== undefined && onPart(c, i.tags));
  const fired = active.filter((c) => {
    const rule = thenRule(c.effect);
    return rule !== undefined && (rule.when === 'applied' ? inPlay(c) : changed.has(c));
  });
  for (const c of fired.toSorted((a, b) => a.instance.order - b.instance.order)) {
    const i = c.instance;
    const rule = thenRule(c.effect) as NonNullable<ReturnType<typeof thenRule>>;
    const key = JSON.stringify([
      i.optionId,
      i.applied ?? null,
      i.source.entry ?? null,
      rule.once === 'roll' ? path : null,
    ]);
    if (ctx.ended.has(key)) continue;
    ctx.ended.add(key);
    const first = ctx.proposed.length;
    if (rule.to !== 'self')
      proposeChanges(
        ctx,
        optionFrame(frame, i),
        step,
        path,
        rule.to,
        rule.changes as ProposedChange[],
        { action, roll: rollRoot },
      );
    else
      for (const then of rule.changes as ThenChange[]) {
        const change = rollThen(ruleset, i, then, (formula) =>
          outputData(sheet.evaluate(formula, c.pack, effectCtx(c))),
        );
        if (change) ctx.proposed.push({ to: 'self', step: path, change });
      }
    for (const p of ctx.proposed.slice(first)) ctx.fromThen.add(p);
  }
}

/**
 * A roll effect's `then` change, aimed at what it names: `entry: self` the state its `self`
 * reads the key from (its pick's or grant's for picked or held granted content declaring it, else
 * its applied entry or copy); `pick: owner` and `grant: owner` the pick or holder grant that
 * activated its content. Undefined when `entry: self` names nothing.
 */
function rollThen(
  ruleset: Ruleset,
  i: EffectInstance,
  then: ThenChange,
  value: (formula: Formula) => unknown,
): Change | undefined {
  const entry = i.applied ?? i.source.entry;
  if (then.type === 'removeEffect')
    return i.applied === undefined
      ? undefined
      : ({ type: 'removeEffect', id: i.applied } as Change);
  const out: Record<string, unknown> = { type: then.type, key: then.key };
  const a = i.own;
  const pick = () => {
    const option = a?.kind === 'pick' ? a.path.choice.at(-1) : undefined;
    if (!a || option === undefined) return undefined;
    return { path: { ...a.path, choice: a.path.choice.slice(0, -1) }, option };
  };
  const grant = () => {
    if (!a?.item || a.kind !== 'grant' || a.scope !== 'holder' || a.node === undefined)
      return undefined;
    const node =
      a.path.choice.length === 0
        ? { entry: a.path.entry }
        : { path: { ...a.path, choice: a.path.choice.slice(0, -1) }, option: a.path.choice.at(-1) };
    return { ...node, grant: a.item.qid };
  };
  if (then.pick === 'owner') {
    const at = pick();
    if (!at) throw new ActionError('unknown-reference', { kind: 'pick', id: 'owner' });
    Object.assign(out, at);
  } else if (then.grant === 'owner') {
    const at = grant();
    if (!at) throw new ActionError('unknown-reference', { kind: 'grant', id: 'owner' });
    Object.assign(out, at);
  } else {
    const declares = a?.item !== undefined && then.key in stateDecls(ruleset, a.item, []);
    const own = declares ? (pick() ?? grant()) : undefined;
    if (own) Object.assign(out, own);
    else if (entry !== undefined) out.entry = entry;
    else return undefined;
  }
  if (then.value !== undefined) out.value = value(then.value);
  if (then.by !== undefined) out.by = value(then.by);
  return out as Change;
}

/** A set's `value` is evaluated once, before its bands, which read it as `roll.value`. */
function classify(
  ctx: Ctx,
  frame: Frame,
  bands: string | undefined,
  result: Record<string, unknown>,
): f.Value | undefined {
  if (!bands) return undefined;
  const bandSet = ctx.ruleset.rules.bands[bands];
  const pack = bandSet?.pack ?? frame.pack;
  let bandValue: f.Value | undefined;
  let roll: Record<string, unknown> = result;
  if (bandSet?.value !== undefined) {
    bandValue = ctx.sheet.evaluate(bandSet.value, pack, { ...context(frame), roll: result });
    result.bandValue = rootValue(bandValue);
    roll = { ...result, value: result.bandValue };
  }
  for (const band of bandSet?.bands ?? []) {
    const v = ctx.sheet.evaluate(band.when, pack, { ...context(frame), roll });
    if (v.kind === 'bool' && v.value) {
      result.band = band.id;
      result.bandSet = bands;
      break;
    }
  }
  return bandValue;
}

/**
 * A roll step with `of` rolls nothing and classifies the earlier roll its path names by its own
 * `bands`. A roll that didn't run leaves the step without a result, as a false `when` does.
 */
function classifyAgain(ctx: Ctx, frame: Frame, step: Step, path: string, of: string): void {
  const [first, ...rest] = of.split('/');
  const each = frame.each;
  const index = each && frame.eachOf.get(first as string) === each.role ? `[${each.index}]` : '';
  // A group's inner step names its latest pass's run.
  const prefix = frame.passOf.get(first as string) ?? frame.prefix;
  const named = `${prefix}${first}${index}${rest.length ? `/${rest.join('/')}` : ''}`;
  const earlier = ctx.rolls.get(named);
  if (!earlier) return;
  const { band: _band, bandSet: _set, bandValue: _value, ...rolled } = earlier.result;
  const result: Record<string, unknown> = { ...rolled };
  const summarySet = step.bands ? ctx.ruleset.rules.bands[step.bands] : undefined;
  const summary = rollSummary(step.bands, summarySet, flagsOf(frame), (node) =>
    ctx.sheet.evaluate(f.print(node), summarySet?.pack ?? frame.pack, context(frame)),
  );
  const bandValue = classify(ctx, frame, step.bands, result);
  setResult(frame, step.id, result);
  frame.rollItems.set(itemsKey(frame, step.id), earlier.items);
  ctx.rolls.set(path, { result, items: earlier.items });
  ctx.log.push({
    step: path,
    action: frame.qid,
    kind: 'dice',
    by: 'engine',
    of: named,
    items: result.items as RollItem[],
    total: result.total as number,
    ...(result.band ? { band: result.band as string, bandSet: step.bands } : {}),
    ...(bandValue !== undefined ? { bandValue: outputData(bandValue) } : {}),
    summary,
  });
}

/** Highest `atLeast` first, then lowest `atMost`; stacking applies per op. */
function rollBounds<T extends { instance: EffectInstance; effect: Effect; pack: string }>(
  ctx: Ctx,
  active: T[],
  roots: (c: T) => Record<string, unknown>,
  total: number,
  changed?: Set<T>,
): BoundLog[] {
  const out: BoundLog[] = [];
  let value = total;
  for (const op of ['atLeast', 'atMost'] as const) {
    let bound: { c: T; v: number } | undefined;
    for (const c of stack(
      ctx,
      active.filter((x) => x.effect.op === op),
      roots,
    )) {
      const r = ctx.sheet.evaluate(c.effect.value as Formula, c.pack, roots(c));
      if (r.kind !== 'int' && r.kind !== 'decimal') continue;
      const v = Math.trunc(r.value);
      if (!bound || (op === 'atLeast' ? v > bound.v : v < bound.v)) bound = { c, v };
    }
    if (bound && (op === 'atLeast' ? bound.v > value : bound.v < value)) {
      value = bound.v;
      changed?.add(bound.c);
      out.push({ source: bound.c.instance.source, op, value: bound.v });
    }
  }
  return out;
}

/** From 0, every matching `add`, then the highest `atLeast`, then the lowest `atMost`. */
function rollTallies<T extends { instance: EffectInstance; effect: Effect; pack: string }>(
  ctx: Ctx,
  frame: Frame,
  active: T[],
  roots: (c: T) => Record<string, unknown>,
  changed?: Set<T>,
): TallyLog[] {
  const scope = ctx.ruleset.packs.find((p) => p.id === frame.pack)?.scope ?? [frame.pack];
  const out: TallyLog[] = [];
  const seen = new Set<string>();
  for (const pid of scope) {
    for (const [qid, def] of Object.entries(ctx.ruleset.rules.tallies)) {
      if (def.pack !== pid || seen.has(def.name)) continue;
      seen.add(def.name);
      const mine = active.filter((c) => targets(c.effect)?.tally === qid);
      const log: TallyLog = { name: def.name, value: 0, sources: [] };
      const amount = (c: T) => {
        const v = ctx.sheet.evaluate(c.effect.value as Formula, c.pack, roots(c));
        return v.kind === 'int' || v.kind === 'decimal' ? Math.trunc(v.value) : 0;
      };
      for (const c of stack(
        ctx,
        mine.filter((x) => x.effect.op === 'add'),
        roots,
      )) {
        const v = amount(c);
        log.value += v;
        if (v !== 0) changed?.add(c);
        log.sources.push({ source: c.instance.source, op: 'add', value: v });
      }
      for (const op of ['atLeast', 'atMost'] as const) {
        let bound: { c: T; v: number } | undefined;
        for (const c of stack(
          ctx,
          mine.filter((x) => x.effect.op === op),
          roots,
        )) {
          const v = amount(c);
          if (!bound || (op === 'atLeast' ? v > bound.v : v < bound.v)) bound = { c, v };
        }
        if (bound && (op === 'atLeast' ? bound.v > log.value : bound.v < log.value)) {
          log.value = bound.v;
          changed?.add(bound.c);
          log.sources.push({ source: bound.c.instance.source, op, value: bound.v });
        }
      }
      out.push(log);
    }
  }
  return out;
}

/** Same keys and policies as the sheet; `playerChooses` acts as `highestOnly`. */
function stack<T extends { instance: EffectInstance; effect: Effect; pack: string }>(
  ctx: Ctx,
  list: T[],
  roots: (c: T) => Record<string, unknown>,
  valueOf: (c: T) => Formula = (c) => c.effect.value as Formula,
): T[] {
  const out: T[] = [];
  const groups = new Map<string, T[]>();
  for (const c of list) {
    const key = c.effect.stackKey;
    if (key === undefined) out.push(c);
    else {
      const group = key === 'source' ? c.instance.sourceId : key;
      groups.set(group, [...(groups.get(group) ?? []), c]);
    }
  }
  const settings = ctx.ruleset.rules.settings.stacking;
  for (const group of groups.values()) {
    const key = group[0]?.effect.stackKey as string;
    const policy = settings?.keys?.[key] ?? settings?.default ?? 'addAll';
    if (policy === 'addAll' || group.length === 1) {
      out.push(...group);
      continue;
    }
    let best = group[0] as T;
    let bestValue = average(ctx.sheet.evaluate(valueOf(best), best.pack, roots(best)));
    for (const c of group.slice(1)) {
      const v = average(ctx.sheet.evaluate(valueOf(c), c.pack, roots(c)));
      if (policy === 'lowestOnly' ? v < bestValue : v > bestValue) {
        best = c;
        bestValue = v;
      }
    }
    out.push(best);
  }
  return list.filter((c) => out.includes(c));
}

function output(items: BuiltItem[]): RollItem[] {
  return items.map((i): RollItem => {
    const multiplied = {
      ...(i.unmultiplied ? { multiplied: false as const } : {}),
      ...(i.factor !== undefined ? { factor: i.factor } : {}),
      ...(i.replaces ? { replaces: i.replaces } : {}),
    };
    if (i.kind === 'flat')
      return {
        kind: 'flat',
        value: itemValue(i),
        source: i.source,
        tags: i.tags,
        ...(i.dropped ? { dropped: i.dropped } : {}),
        ...multiplied,
      };
    const t = i.term as f.DiceTerm;
    return {
      kind: 'dice',
      count: t.count,
      sides: t.sides,
      ...(t.zero ? { zero: true } : {}),
      ...(t.sign === -1 ? { sign: -1 as const } : {}),
      ...(i.steppedFrom !== undefined ? { steppedFrom: i.steppedFrom } : {}),
      modifiers: t.modifiers,
      ...(i.rolled ? { faces: i.rolled.faces, value: itemValue(i) } : {}),
      source: i.source,
      tags: i.tags,
      ...multiplied,
    };
  });
}

function decide(
  policy: Policy,
  kind: 'roll' | 'choice' | 'allocate',
  tags: string[],
  step: string,
): 'auto' | 'pause' {
  for (const rule of policy.rules ?? []) {
    if (rule.kind && rule.kind !== kind) continue;
    if (rule.step && rule.step !== step) continue;
    if (rule.tags && !rule.tags.some((t) => matchesTag(t, tags))) continue;
    return rule.then;
  }
  const fallback =
    kind === 'roll' ? policy.dice : kind === 'choice' ? policy.choices : policy.allocations;
  return fallback ?? 'auto';
}

function takeAnswers(ctx: Ctx, path: string, kind: Answer['kind']): Answer[] {
  const out: Answer[] = [];
  const next = ctx.state.answers[ctx.cursor];
  if (next && next.step === path && next.kind === kind) {
    out.push(next);
    ctx.cursor++;
  }
  return out;
}

function recordAnswer(ctx: Ctx, answer: Answer): void {
  ctx.state.answers.splice(ctx.cursor, 0, answer);
  ctx.cursor++;
}

/**
 * One die with as many sides as `among`, a dice checkpoint like any roll's. Returns the index
 * drawn; with one candidate or none, nothing is drawn.
 */
function draw(
  ctx: Ctx,
  frame: Frame,
  path: string,
  tags: string[],
  among: string[],
  named: Pick<Need, 'choice' | 'content'> = {},
): number {
  if (among.length <= 1) return 0;
  const sides = among.length;
  const [answer] = takeAnswers(ctx, path, 'dice');
  let face: number;
  let by: 'engine' | 'app' = 'engine';
  if (answer?.faces !== undefined) {
    if (answer.faces.length !== 1)
      throw new ActionError('answer-mismatch', { reason: 'a draw takes one face' });
    face = answer.faces[0] as number;
    by = answer.by;
  } else if (decide(ctx.policy, 'roll', tags, path) === 'auto') {
    face = ctx.dice(1, sides, false)[0] as number;
    recordAnswer(ctx, { step: path, kind: 'dice', by: 'engine', faces: [face] });
  } else {
    throw new Pause({
      step: path,
      action: frame.qid,
      kind: 'dice',
      dice: [{ count: 1, sides }],
      draw: { among: [...among] },
      ...named,
    });
  }
  if (!Number.isInteger(face) || face < 1 || face > sides)
    throw new ActionError('answer-mismatch', { reason: `face ${face} is not on the d${sides}` });
  ctx.log.push({
    step: path,
    action: frame.qid,
    kind: 'dice',
    by,
    faces: [face],
    draw: { among: [...among] },
  });
  return face - 1;
}

function randomHolds(
  ctx: Ctx,
  frame: Frame,
  step: Step,
  extra: Record<string, unknown> = {},
): boolean {
  if (step.random === undefined) return false;
  const v = evaluate(ctx, frame, step.random as Formula, extra);
  if (v.kind !== 'bool')
    throw new ActionError('type-mismatch', { message: `random evaluated to ${v.kind}` });
  return v.value;
}

const DONE = '#done';

interface Candidate {
  id: string;
  item?: Record<string, unknown>;
  self?: Record<string, unknown>;
  /** A value source's candidate: the value itself, its string form the ID. */
  value?: string | number;
  option?: StepOption;
  added?: { instance: EffectInstance; value: OptionValue };
}

/** The action's own item and copy, and the current step's `{ id, tags }`. */
function actionRoot(
  ctx: Ctx,
  frame: Frame,
  step: Step,
): { item?: unknown; self?: unknown; step: { id: string; tags: string[] } } {
  return {
    ...(frame.roots.item !== undefined ? { item: frame.roots.item } : {}),
    ...(frame.roots.self !== undefined ? { self: frame.roots.self } : {}),
    step: { id: step.id, tags: ownTags(ctx, frame, step) },
  };
}

/** The action's frame with `item`, `self` and pack of the content carrying the effect. */
function optionFrame(frame: Frame, instance: EffectInstance): Frame {
  const roots = { ...frame.roots };
  delete roots.item;
  delete roots.self;
  const { entry: _entry, ...rest } = frame;
  return {
    ...rest,
    pack: instance.pack,
    roots: { ...roots, ...instance.roots },
    ...(instance.source.entry !== undefined ? { entry: instance.source.entry } : {}),
    adder: instance.source,
    owner: { activation: instance.own },
  };
}

/**
 * Content items, templates and the rules add options and changes to steps; `from: self`, only a
 * copy's to its own actions.
 */
function addsToSteps(instance: EffectInstance, frame: Frame, from: string | undefined): boolean {
  const { type, id, entry } = instance.source;
  if (type === 'rules') return from !== 'self' && id !== undefined;
  if (type !== 'item' && type !== 'template') return false;
  return id !== undefined && (from !== 'self' || entry === frame.entry);
}

/** Of instances sharing a `stackKey` or an ID, only the first is offered. */
function addedOptions(
  ctx: Ctx,
  frame: Frame,
  tags: string[],
  counts: ReadonlyMap<string, number>,
  action: Record<string, unknown>,
): Candidate[] {
  if (tags.length === 0) return [];
  const out: Candidate[] = [];
  const keys = new Set<string>();
  for (const instance of ctx.sheet.instances) {
    const effect = instance.effect;
    const target = effect.target;
    if (effect.op !== 'option' || typeof target !== 'object' || !('choices' in target)) continue;
    if (!target.choices.some((tag) => matchesTag(tag, tags))) continue;
    if (!addsToSteps(instance, frame, target.from)) continue;
    const value = effect.value as OptionValue;
    const id = `${instance.source.id}#${value.id}`;
    if (out.some((c) => c.id === id)) continue;
    if (effect.when !== undefined) {
      const v = ctx.sheet.evaluate(
        effect.when,
        instance.pack,
        context(optionFrame(frame, instance), { picks: counts.get(id) ?? 0, action }),
      );
      if (v.kind !== 'bool' || !v.value) continue;
    }
    const key = effect.stackKey === 'source' ? `#source ${instance.sourceId}` : effect.stackKey;
    if (key !== undefined) {
      if (keys.has(key)) continue;
      keys.add(key);
    }
    out.push({ id, added: { instance, value } });
  }
  return out;
}

function candidateRoots(
  frame: Frame,
  candidate: Candidate,
  picks: number,
  action: Record<string, unknown>,
): Record<string, unknown> {
  const roots = context(frame, { picks, action });
  delete roots.item;
  delete roots.self;
  if (candidate.item !== undefined) roots.item = candidate.item;
  if (candidate.self !== undefined) roots.self = candidate.self;
  return roots;
}

function integer(value: f.Value, what: string): number {
  if (value.kind !== 'int')
    throw new ActionError('type-mismatch', { message: `${what} evaluated to ${value.kind}` });
  return value.value;
}

const contentOrder = new WeakMap<Ruleset['content'], LoadedItem[]>();

function contentInOrder(ruleset: Ruleset): LoadedItem[] {
  let items = contentOrder.get(ruleset.content);
  if (!items) {
    items = Object.values(ruleset.content);
    contentOrder.set(ruleset.content, items);
  }
  return items;
}

function offeredOptions(
  ctx: Ctx,
  frame: Frame,
  step: Step,
  counts: ReadonlyMap<string, number>,
  action: Record<string, unknown>,
): Candidate[] {
  const values = valueSource(step);
  if (values) return valueOptions(ctx, frame, values, counts, action);
  const query = optionQuery(step);
  if (!query)
    return writtenOptions(step)
      .filter((o) => test(ctx, frame, o.when, { picks: counts.get(o.id) ?? 0 }))
      .map((o) => ({ id: o.id, option: o }));
  const { ruleset, sheet } = ctx;
  const all: Candidate[] = [];
  if (query.source === 'content') {
    for (const item of contentInOrder(ruleset)) {
      if (item.hidden || item.type !== query.type) continue;
      all.push({
        id: item.qid,
        item: itemView(ruleset, item, [], (name, pack) => {
          const qid = resolveField(ruleset, name, pack);
          return qid ? sheet.inputValue(qid) : undefined;
        }),
      });
    }
  } else {
    const { character } = sheet;
    for (const entry of [...(character.inventory ?? []), ...(character.features ?? [])]) {
      const a = sheet.activations.find(
        (x) => x.entry?.id === entry.id && (x.kind === 'feature' || x.kind === 'inventory'),
      );
      if (!a?.item || a.item.type !== query.type) continue;
      all.push({
        id: entry.id,
        item: a.roots.item as Record<string, unknown>,
        self: a.roots.self as Record<string, unknown>,
      });
    }
  }
  if (query.where === undefined) return all;
  return all.filter((c) => {
    const roots = candidateRoots(frame, c, counts.get(c.id) ?? 0, action);
    const v = sheet.evaluate(query.where as Formula, frame.pack, roots);
    return v.kind === 'bool' && v.value;
  });
}

/** The written values or the formula's, each once by its string form, that pass `where`. */
function valueOptions(
  ctx: Ctx,
  frame: Frame,
  source: ValueSource,
  counts: ReadonlyMap<string, number>,
  action: Record<string, unknown>,
): Candidate[] {
  let list: unknown = source.values;
  if (!Array.isArray(list))
    list = f.toData(evaluate(ctx, frame, (source.values as { formula: Formula }).formula));
  if (!Array.isArray(list))
    throw new ActionError('type-mismatch', { message: 'values evaluated to a non-list' });
  const out: Candidate[] = [];
  for (const value of list) {
    if (typeof value !== 'string' && typeof value !== 'number')
      throw new ActionError('type-mismatch', { message: 'values must be strings or numbers' });
    const id = String(value);
    if (out.some((c) => c.id === id)) continue;
    if (source.where !== undefined) {
      const roots = { value, picks: counts.get(id) ?? 0, action };
      if (!test(ctx, frame, source.where, roots)) continue;
    }
    out.push({ id, value });
  }
  return out;
}

/** A candidate's `prefer`: content and copies bind it as `item` (and `self`), values as `value`. */
function preferRoots(
  frame: Frame,
  candidate: Candidate,
  picks: number,
  action: Record<string, unknown>,
): Record<string, unknown> {
  if (candidate.value !== undefined)
    return context(frame, { value: candidate.value, picks, action });
  return candidateRoots(frame, candidate, picks, action);
}

/** Without `recommend`, the highest `prefer` (ties to the earlier), else nothing; never `#done`. */
function recommendation(
  ctx: Ctx,
  frame: Frame,
  step: Step,
  candidates: Candidate[],
  counts: ReadonlyMap<string, number>,
  action: Record<string, unknown>,
): string | undefined {
  const ids = candidates.map((c) => c.id);
  if (step.recommend !== undefined) {
    const v = f.toData(evaluate(ctx, frame, step.recommend as Formula, { options: ids }));
    return typeof v === 'string' && ids.includes(v) ? v : undefined;
  }
  if ((!optionQuery(step) && !valueSource(step)) || step.prefer === undefined) return undefined;
  let best: { id: string; score: number } | undefined;
  for (const c of candidates) {
    const roots = preferRoots(frame, c, counts.get(c.id) ?? 0, action);
    const v = ctx.sheet.evaluate(step.prefer, frame.pack, roots);
    if (v.kind !== 'int' && v.kind !== 'decimal')
      throw new ActionError('type-mismatch', { message: `prefer evaluated to ${v.kind}` });
    if (!best || v.value > best.score) best = { id: c.id, score: v.value };
  }
  return best?.id;
}

/**
 * Each pick is a checkpoint; with `repeat` it picks again until `max`, nothing is offered, or
 * `#done`. After each pick the option's `flags` are set, then its `changes`, then the step's.
 */
function choiceStep(ctx: Ctx, given: Frame, step: Step, path: string): void {
  if (pendingSource(step)) {
    pendingStep(ctx, given, step, path);
    return;
  }
  let frame = given;
  let action = actionRoot(ctx, frame, step);
  const tags = action.step.tags;
  const repeat = step.repeat;
  const max = repeat ? integer(evaluate(ctx, frame, repeat.max), 'repeat.max') : 1;
  const min =
    repeat?.min !== undefined ? integer(evaluate(ctx, frame, repeat.min), 'repeat.min') : 0;
  // Values are named by the content the action runs for first.
  const content = valueSource(step) ? frame.activation?.item?.qid : undefined;
  const named = content !== undefined ? { content } : {};
  const counts = new Map<string, number>();
  const picks: string[] = [];
  // A repeated value step lists its picked values too, a number staying a number.
  const values: unknown[] | undefined = repeat && valueSource(step) ? [] : undefined;
  const first = ctx.proposed.length;
  if (repeat)
    setResult(frame, step.id, { picked: [], ...(values ? { values: [] } : {}), added: [] });
  for (let index = 0; picks.length < max; index++) {
    // Each pick proposes its changes at once, so the proposed sheet is read afresh per pick.
    if (index > 0 && readsProposed(step)) {
      ctx.sheet = proposedSheet(ctx, path);
      frame = onSheet(ctx, frame);
      action = actionRoot(ctx, frame, step);
    }
    const own = offeredOptions(ctx, frame, step, counts, action);
    const candidates = [...own, ...addedOptions(ctx, frame, tags, counts, action)];
    if (candidates.length === 0) break;
    const options = candidates.map((c) => c.id);
    if (repeat && picks.length >= min) options.push(DONE);
    // Added options are never recommended, only drawn among by a random step.
    const ownIds = own.map((c) => c.id);
    const recommended =
      own.length > 0 && randomHolds(ctx, frame, step, { options: ownIds })
        ? ownIds[draw(ctx, frame, path, tags, ownIds, named)]
        : recommendation(ctx, frame, step, own, counts, action);
    const [answer] = takeAnswers(ctx, path, 'choice');
    let pick: string;
    let by: 'engine' | 'app' = 'engine';
    if (answer?.option !== undefined) {
      if (!options.includes(answer.option))
        throw new ActionError('answer-mismatch', { reason: 'that option is not offered' });
      pick = answer.option;
      by = answer.by;
    } else if (decide(ctx.policy, 'choice', tags, path) === 'auto' && recommended !== undefined) {
      pick = recommended;
      recordAnswer(ctx, { step: path, kind: 'choice', by: 'engine', option: pick });
    } else {
      throw new Pause({
        step: path,
        action: frame.qid,
        kind: 'choice',
        options,
        ...(recommended !== undefined ? { recommended } : {}),
        ...named,
      });
    }
    ctx.log.push({
      step: path,
      action: frame.qid,
      kind: 'choice',
      by,
      option: pick,
      ...(repeat ? { index } : {}),
    });
    if (pick === DONE) break;
    const candidate = candidates.find((c) => c.id === pick) as Candidate;
    picks.push(pick);
    if (values && candidate.value !== undefined) values.push(candidate.value);
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
    const result: Record<string, unknown> = repeat
      ? { picked: [...picks], ...(values ? { values: [...values] } : {}) }
      : {
          picked: pick,
          ...(candidate.item !== undefined ? { item: candidate.item } : {}),
          ...(candidate.self !== undefined ? { self: candidate.self } : {}),
          ...(candidate.value !== undefined ? { value: candidate.value } : {}),
        };
    result.added = addedIds(ctx, first, path);
    setResult(frame, step.id, result);
    const picked = {
      id: pick,
      ...(candidate.item !== undefined ? { item: candidate.item } : {}),
      ...(candidate.self !== undefined ? { self: candidate.self } : {}),
      ...(candidate.value !== undefined ? { value: candidate.value } : {}),
    };
    const entries = { picked: candidate.self !== undefined ? pick : undefined };
    for (const [name, formula] of Object.entries(candidate.option?.flags ?? {}))
      frame.flags[name] = rootValue(evaluate(ctx, frame, formula, { picked }));
    if (candidate.added) {
      const added = optionFrame(frame, candidate.added.instance);
      for (const [name, formula] of Object.entries(candidate.added.value.flags ?? {}))
        frame.flags[name] = rootValue(evaluate(ctx, added, formula, { picked, action }));
    }
    if (candidate.option?.changes)
      proposeChanges(
        ctx,
        frame,
        step,
        path,
        candidate.option.to ?? 'self',
        candidate.option.changes,
        { picked },
        entries,
      );
    if (candidate.added)
      proposeChanges(
        ctx,
        optionFrame(frame, candidate.added.instance),
        step,
        path,
        candidate.added.value.to ?? 'self',
        candidate.added.value.changes ?? [],
        { picked, action },
        entries,
      );
    if (step.changes)
      proposeChanges(ctx, frame, step, path, 'self', step.changes, { picked }, entries);
    result.added = addedIds(ctx, first, path);
  }
}

interface Asked {
  choice: PendingChoice;
  options: { id: string; option: string | number; recommended: boolean }[];
}

/** A pending choice at or under `under`: the same entry, and a choice path it starts with. */
function under(path: ChoicePath, prefix: ChoicePath): boolean {
  return (
    path.entry === prefix.entry &&
    prefix.choice.length <= path.choice.length &&
    prefix.choice.every((segment, i) => path.choice[i] === segment)
  );
}

function nextPending(
  ctx: Ctx,
  entry: string | undefined,
  prefix: ChoicePath | undefined,
): Asked | undefined {
  const { sheet } = ctx;
  const links = ctx.state.links ?? {};
  for (const { path } of sheet.pending().pending) {
    if (entry !== undefined && path.entry !== entry) continue;
    if (prefix !== undefined && !under(path, prefix)) continue;
    const listed = openOptionsOn(ctx.ruleset, sheet, path, links);
    if ('errors' in listed) continue;
    const open = listed.options.filter((o) => o.eligible && !o.picked);
    if (open.length === 0) continue;
    const record = sheet.choices.find((r) => samePath(r.path, path));
    if (!record) continue;
    return {
      choice: {
        path,
        owner: ownerKey(record.choice, record.owner),
        id: record.choice.id,
        ...(record.slot ? { slot: { ...record.slot } } : {}),
        ...pickBounds(sheet, record),
        picked: record.picks.length,
      },
      options: open.map((o) => ({
        id: String(o.option),
        option: o.option,
        recommended: o.recommended,
      })),
    };
  }
  return undefined;
}

/**
 * Before each pick reads the proposed sheet and asks the first pending choice with an eligible
 * option not picked yet; ends when nothing more can be asked or `#done` is picked.
 */
function pendingStep(ctx: Ctx, given: Frame, step: Step, path: string): void {
  let frame = given;
  const source = pendingSource(step) as PendingSource;
  const tags = ownTags(ctx, frame, step);
  const entry =
    source.entry === undefined ? undefined : String(f.toData(evaluate(ctx, frame, source.entry)));
  const prefix = source.path && resolvePath(ctx, frame, source.path, {});
  const picks: string[] = [];
  const paths: ChoicePath[] = [];
  const first = ctx.proposed.length;
  setResult(frame, step.id, { picked: [], paths: [], added: [] });
  for (let index = 0; ; index++) {
    if (index > 0) {
      if (++ctx.stepsRun > MAX_STEPS)
        throw new ActionError('safety-limit-exceeded', { limit: 'maxActionSteps' });
      ctx.sheet = proposedSheet(ctx, path);
      frame = onSheet(ctx, frame);
    }
    const asked = nextPending(ctx, entry, prefix);
    if (!asked) break;
    const { choice } = asked;
    const ids = asked.options.map((o) => o.id);
    // During creation every pending choice must be picked before `finishCreation`.
    const options = ctx.sheet.character.creating === true ? ids : [...ids, DONE];
    let recommended: string | undefined;
    const bound = {
      options: ids,
      choice: {
        path: { ...choice.path },
        owner: choice.owner,
        id: choice.id,
        ...(choice.slot ? { slot: { ...choice.slot } } : {}),
      },
    };
    if (randomHolds(ctx, frame, step, bound))
      recommended = ids[draw(ctx, frame, path, tags, ids, { choice })];
    else if (step.recommend !== undefined) {
      const v = f.toData(evaluate(ctx, frame, step.recommend as Formula, bound));
      recommended = typeof v === 'string' && ids.includes(v) ? v : undefined;
    } else recommended = asked.options.find((o) => o.recommended)?.id;
    const [answer] = takeAnswers(ctx, path, 'choice');
    let pick: string;
    let by: 'engine' | 'app' = 'engine';
    if (answer?.option !== undefined) {
      if (answer.choice !== undefined && !samePath(answer.choice, choice.path))
        throw new ActionError('answer-mismatch', { reason: 'that choice is no longer asked' });
      if (!options.includes(answer.option))
        throw new ActionError('answer-mismatch', { reason: 'that option is not offered' });
      pick = answer.option;
      by = answer.by;
    } else if (decide(ctx.policy, 'choice', tags, path) === 'auto' && recommended !== undefined) {
      pick = recommended;
      recordAnswer(ctx, {
        step: path,
        kind: 'choice',
        by: 'engine',
        option: pick,
        choice: choice.path,
      });
    } else {
      throw new Pause({
        step: path,
        action: frame.qid,
        kind: 'choice',
        options,
        ...(recommended !== undefined ? { recommended } : {}),
        choice,
      });
    }
    ctx.log.push({
      step: path,
      action: frame.qid,
      kind: 'choice',
      by,
      option: pick,
      index,
      choice: choice.path,
    });
    if (pick === DONE) break;
    const option = asked.options.find((o) => o.id === pick)?.option as string | number;
    picks.push(pick);
    paths.push(choice.path);
    const result = { picked: [...picks], paths: [...paths], added: addedIds(ctx, first, path) };
    setResult(frame, step.id, result);
    ctx.proposed.push({
      to: 'self',
      step: path,
      change: { type: 'choose', path: choice.path, option } as Change,
    });
    if (step.changes)
      proposeChanges(ctx, frame, step, path, 'self', step.changes, {
        picked: { id: pick, path: choice.path },
      });
    result.added = addedIds(ctx, first, path);
  }
}

interface Offered {
  id: string;
  value: number;
  input: number;
  limit?: number;
  costs?: number[];
}

const MAX_COSTS = 100;

/**
 * Spends a budget across fields, or gives each of a list of values to a different field: one
 * `adjust` per non-zero amount, or one `set` per value. With no offered fields it is skipped.
 */
function allocateStep(ctx: Ctx, frame: Frame, step: Step, path: string): void {
  const { sheet, ruleset } = ctx;
  const tags = tagsOf(ctx, step.tags, (fm) => evaluate(ctx, frame, fm));
  const where = step.fields?.where;
  const action = where !== undefined ? actionRoot(ctx, frame, step) : undefined;
  const offered: Offered[] = [];
  for (const [qid, def] of Object.entries(ruleset.fields)) {
    if (!def.input || def.type !== 'integer') continue;
    if (where !== undefined) {
      const item = { id: qid, type: def.type, tags: sheet.fieldTags(qid) };
      if (!test(ctx, frame, where, { item, action })) continue;
    }
    const computed = sheet.fieldValue(qid);
    const value = computed.kind === 'int' || computed.kind === 'decimal' ? computed.value : 0;
    const raw = sheet.inputValue(qid);
    const input = raw?.kind === 'int' ? raw.value : 0;
    let limit: number | undefined;
    if (step.values === undefined) {
      // A field's `max` always bounds its amount; `limit` may only narrow it.
      if (def.max !== undefined) {
        const max = sheet.evaluate(def.max, def.pack, {});
        if ((max.kind === 'int' || max.kind === 'decimal') && raw?.kind === 'int')
          limit = Math.max(0, Math.floor(max.value - input));
      }
      if (step.limit !== undefined) {
        const own = integer(
          evaluate(ctx, frame, step.limit, { field: { id: qid, value } }),
          'limit',
        );
        limit = limit === undefined ? own : Math.min(limit, own);
      }
    }
    offered.push({ id: qid, value, input, ...(limit !== undefined ? { limit } : {}) });
  }
  if (offered.length === 0) return;

  const values = step.values?.map((v) => integer(evaluate(ctx, frame, v), 'a value'));
  const budget =
    values === undefined && step.budget !== undefined
      ? integer(evaluate(ctx, frame, step.budget), 'budget')
      : undefined;
  const spend = step.spend ?? 'all';
  const costOf = (field: Offered, amount: number): number =>
    amount === 0
      ? 0
      : step.cost === undefined
        ? amount
        : integer(
            evaluate(ctx, frame, step.cost, {
              field: { id: field.id, value: field.value },
              amount,
            }),
            'cost',
          );
  // Each amount's cost, for an app's running total, up to MAX_COSTS.
  if (budget !== undefined)
    for (const field of offered) {
      const top = Math.min(field.limit ?? Math.max(0, budget), MAX_COSTS);
      const costs: number[] = [];
      for (let amount = 0; amount <= top; amount++) {
        try {
          costs.push(costOf(field, amount));
        } catch {
          break;
        }
      }
      field.costs = costs;
    }
  const ids = new Set(offered.map((o) => o.id));
  const misfit = (amounts: Amounts): string | undefined => {
    for (const [id, amount] of Object.entries(amounts)) {
      if (!ids.has(id)) return `"${id}" is not offered`;
      if (!Number.isInteger(amount)) return `the amount for "${id}" is not a whole number`;
    }
    if (values !== undefined) {
      const left = [...values];
      for (const amount of Object.values(amounts)) {
        const at = left.indexOf(amount);
        if (at < 0) return `${amount} is not one of the values left to give`;
        left.splice(at, 1);
      }
      return left.length > 0 ? `the values ${left.join(', ')} are not given` : undefined;
    }
    let total = 0;
    for (const field of offered) {
      const amount = amounts[field.id] ?? 0;
      if (amount < 0) return `the amount for "${field.id}" is negative`;
      if (field.limit !== undefined && amount > field.limit)
        return `the amount for "${field.id}" is over its limit of ${field.limit}`;
      total += field.costs?.[amount] ?? costOf(field, amount);
    }
    if (budget !== undefined && (spend === 'all' ? total !== budget : total > budget))
      return `the amounts cost ${total}, and the budget is ${spend === 'all' ? '' : 'at most '}${budget}`;
    return undefined;
  };
  const normalize = (amounts: Amounts): Amounts =>
    Object.fromEntries(
      offered
        .filter((o) =>
          values !== undefined ? amounts[o.id] !== undefined : (amounts[o.id] ?? 0) !== 0,
        )
        .map((o) => [o.id, amounts[o.id] as number]),
    );
  let recommended: Amounts | undefined;
  if (randomHolds(ctx, frame, step)) {
    const amounts = randomAmounts(ctx, frame, path, tags, offered, values, budget, costOf);
    if (amounts && misfit(amounts) === undefined) recommended = normalize(amounts);
  } else if (step.recommend !== undefined && typeof step.recommend === 'object') {
    const amounts: Amounts = {};
    for (const [id, formula] of Object.entries(step.recommend))
      amounts[id] = integer(evaluate(ctx, frame, formula), 'a recommended amount');
    if (misfit(amounts) === undefined) recommended = normalize(amounts);
  }

  const [answer] = takeAnswers(ctx, path, 'allocate');
  let amounts: Amounts;
  let by: 'engine' | 'app' = 'engine';
  if (answer?.amounts !== undefined) {
    const reason = misfit(answer.amounts);
    if (reason !== undefined) throw new ActionError('answer-mismatch', { reason });
    amounts = normalize(answer.amounts);
    by = answer.by;
  } else if (decide(ctx.policy, 'allocate', tags, path) === 'auto' && recommended) {
    amounts = recommended;
    recordAnswer(ctx, { step: path, kind: 'allocate', by: 'engine', amounts });
  } else {
    throw new Pause({
      step: path,
      action: frame.qid,
      kind: 'allocate',
      allocate: {
        fields: offered,
        ...(values !== undefined ? { values } : { budget: budget as number, spend }),
        ...(recommended ? { recommended } : {}),
      },
    });
  }
  ctx.log.push({ step: path, action: frame.qid, kind: 'allocate', by, amounts });
  setResult(frame, step.id, { amounts });
  for (const [field, amount] of Object.entries(amounts)) {
    const change =
      values !== undefined
        ? { type: 'set' as const, field, value: amount }
        : { type: 'adjust' as const, field, by: amount };
    ctx.proposed.push({ to: 'self', step: path, change: change as Change });
  }
}

/**
 * Values go in order to a field drawn among those not given one yet; a budget goes one unit at a
 * time to a field drawn among those that can take one more.
 */
function randomAmounts(
  ctx: Ctx,
  frame: Frame,
  path: string,
  tags: string[],
  offered: Offered[],
  values: number[] | undefined,
  budget: number | undefined,
  costOf: (field: Offered, amount: number) => number,
): Amounts | undefined {
  const amounts: Amounts = {};
  if (values !== undefined) {
    const left = [...offered];
    for (const value of values) {
      if (left.length === 0) return undefined;
      const at = draw(
        ctx,
        frame,
        path,
        tags,
        left.map((o) => o.id),
      );
      const [field] = left.splice(at, 1) as [Offered];
      amounts[field.id] = value;
    }
    return amounts;
  }
  let remaining = budget ?? 0;
  for (;;) {
    if (++ctx.stepsRun > MAX_STEPS)
      throw new ActionError('safety-limit-exceeded', { limit: 'maxActionSteps' });
    const open: { field: Offered; step: number }[] = [];
    for (const field of offered) {
      const amount = amounts[field.id] ?? 0;
      if (field.limit !== undefined && amount + 1 > field.limit) continue;
      let next: number;
      let now: number;
      try {
        now = field.costs?.[amount] ?? costOf(field, amount);
        next = field.costs?.[amount + 1] ?? costOf(field, amount + 1);
      } catch {
        continue;
      }
      const step = next - now;
      if (step > 0 && step <= remaining) open.push({ field, step });
    }
    if (open.length === 0) break;
    const picked = open[
      draw(
        ctx,
        frame,
        path,
        tags,
        open.map((o) => o.field.id),
      )
    ] as { field: Offered; step: number };
    amounts[picked.field.id] = (amounts[picked.field.id] ?? 0) + 1;
    remaining -= picked.step;
    if (remaining === 0) break;
  }
  return amounts;
}

function changesStep(ctx: Ctx, frame: Frame, step: Step, path: string): void {
  const first = ctx.proposed.length;
  if (step.release) release(ctx, frame, step.release);
  if (step.changes) proposeChanges(ctx, frame, step, path, step.to ?? 'self', step.changes);
  if (step.tags !== undefined || frame.added.length > 0) addedChanges(ctx, frame, step, path);
  setResult(frame, step.id, { added: addedIds(ctx, first, path) });
}

/** The instance IDs of the copies the step's own `addItem`s add to the actor, in order. */
function addedIds(ctx: Ctx, first: number, path: string): string[] {
  return ctx.proposed
    .slice(first)
    .flatMap((p) =>
      p.to === 'self' && p.step === path && p.change.type === 'addItem' ? [p.change.entry.id] : [],
    );
}

/** Each proposes its changes after the step's own, with the content as `item` and `self`. */
function addedChanges(ctx: Ctx, frame: Frame, step: Step, path: string): void {
  const action = actionRoot(ctx, frame, step);
  const tags = action.step.tags;
  if (tags.length === 0) return;
  for (const instance of ctx.sheet.instances) {
    const effect = instance.effect;
    const target = effect.target;
    if (effect.op !== 'changes' || typeof target !== 'object' || !('steps' in target)) continue;
    if (!target.steps.some((tag) => matchesTag(tag, tags))) continue;
    if (!addsToSteps(instance, frame, target.from)) continue;
    const added = optionFrame(frame, instance);
    if (effect.when !== undefined) {
      const v = ctx.sheet.evaluate(effect.when, instance.pack, context(added, { action }));
      if (v.kind !== 'bool' || !v.value) continue;
    }
    const value = effect.value as StepChanges;
    proposeChanges(ctx, added, step, path, value.to ?? step.to ?? 'self', value.changes, {
      action,
    });
  }
}

/**
 * The nested action's own steps saw the changes from `first` on; the parent's later steps don't
 * until they are released.
 */
function hold(ctx: Ctx, frame: Frame, id: string, first: number): void {
  const after = ctx.proposed.splice(first);
  const taken = after.filter((p) => !ctx.fromThen.has(p));
  ctx.proposed.push(...after.filter((p) => ctx.fromThen.has(p)));
  // The proposed sheet is cached by the count of changes; taking some back invalidates it.
  delete ctx.cached;
  const list = frame.held.get(id);
  if (list) list.push(...taken);
  else frame.held.set(id, taken);
}

/** Changes `where` leaves out stay held; `combine` merges `adjust`s equal in all but `by`. */
function release(ctx: Ctx, frame: Frame, def: NonNullable<Step['release']>): void {
  const out: Proposed[] = [];
  for (const id of def.steps) {
    const list = frame.held.get(id) ?? [];
    const kept: Proposed[] = [];
    for (const p of list) {
      const change = { ...(p.change as Record<string, unknown>) };
      change.tags ??= [];
      if (def.where === undefined || test(ctx, frame, def.where, { change })) out.push(p);
      else kept.push(p);
    }
    frame.held.set(id, kept);
  }
  ctx.proposed.push(...(def.combine ? combined(out) : out));
}

function combined(list: Proposed[]): Proposed[] {
  const out: Proposed[] = [];
  const byKey = new Map<string, Proposed>();
  for (const p of list) {
    const change = p.change as Record<string, unknown>;
    if (change.type !== 'adjust' || typeof change.by !== 'number') {
      out.push(p);
      continue;
    }
    const rest = { ...change };
    delete rest.by;
    const key = JSON.stringify([p.to, p.character ?? null, canonical(rest)]);
    const first = byKey.get(key);
    if (!first) {
      const copy = { ...p, change: { ...change } as Change };
      byKey.set(key, copy);
      out.push(copy);
      continue;
    }
    const target = first.change as Record<string, unknown>;
    target.by = f.roundDecimal((target.by as number) + (change.by as number));
  }
  return out;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .toSorted()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  return value;
}

type Route = { to: Destination; character?: string };

/** In an `each` step over a role, only the current participant; else each in order, else none. */
function routes(ctx: Ctx, frame: Frame, to: Destination): Route[] {
  if (typeof to === 'object') {
    const character = ctx.sheet.linkedId(to.link);
    return [{ to, ...(character !== undefined ? { character } : {}) }];
  }
  if (to === 'self') return [{ to }];
  if (frame.each?.role === to) return [{ to, character: frame.each.view.id as string }];
  const list = (frame.roots.participants as Record<string, Record<string, unknown>[]>)[to] ?? [];
  return list.length > 0 ? list.map((view) => ({ to, character: view.id as string })) : [{ to }];
}

/** Changes for several participants are resolved once and proposed to each in turn. */
function proposeChanges(
  ctx: Ctx,
  frame: Frame,
  step: Step,
  path: string,
  to: Destination,
  changes: ProposedChange[],
  outer: Record<string, unknown> = {},
  entries: { picked?: string | undefined } = {},
): void {
  const linked = typeof to === 'object';
  const other = to !== 'self';
  const [route, ...others] = routes(ctx, frame, to) as [Route, ...Route[]];
  const first = ctx.proposed.length;
  const offers: Proposed[] = [];
  for (const change of changes)
    for (const own of repeated(ctx, frame, change, outer)) {
      if (change.type === 'offerFollowUp') {
        const offer = offerFollowUp(ctx, frame, change, own);
        if (offer) offers.push({ to: 'self', step: path, change: offer });
        continue;
      }
      proposeOne(ctx, frame, step, path, change, own, entries, linked, route, other);
    }
  const proposed = ctx.proposed.slice(first);
  for (const next of others)
    for (const p of proposed) ctx.proposed.push({ ...next, step: p.step, change: p.change });
  ctx.proposed.push(...offers);
}

/**
 * The follow-up of the content whose added option or changes propose it, else of the content
 * defining the action, else of the rules.
 */
function offerFollowUp(
  ctx: Ctx,
  frame: Frame,
  change: ProposedChange,
  bound: Record<string, unknown>,
): Change | undefined {
  if (!test(ctx, frame, change.when, bound)) return undefined;
  const ref = change.followUp ?? '';
  const owner: Source | undefined =
    frame.adder ?? (frame.qid.includes('#') ? frame.activation?.source : undefined);
  let id: string | undefined;
  let def: FollowUp | undefined;
  if (owner && owner.type !== 'rules' && owner.id !== undefined) {
    const item = ctx.ruleset.content[owner.id];
    def = item?.followUps?.find((fu: FollowUp) => fu.id === ref);
    if (item && def) id = `${item.qid}#${ref}`;
    else if (item) {
      const type = ctx.ruleset.contentTypes[item.type];
      def = type?.followUps?.find((fu: FollowUp) => fu.id === ref);
      if (type && def) id = `${type.pack}:${type.name}#${ref}`;
    }
  } else {
    const qid = ref.includes(':') ? ref : `${frame.pack}:${ref}`;
    def = ctx.ruleset.rules.followUps.find((fu) => `${fu.pack}:${fu.id}` === qid);
    if (def) id = qid;
  }
  if (!id || !def || def.while !== undefined)
    throw new ActionError('unknown-reference', { kind: 'follow-up', id: ref });
  const values = Object.fromEntries(
    Object.entries(change.params ?? {}).flatMap(([name, formula]) => {
      const value = evaluate(ctx, frame, formula, bound);
      return value.kind === 'null' ? [] : [[name, outputData(value)]];
    }),
  );
  return {
    type: 'offerFollowUp',
    followUp: id,
    ...(owner && owner.type !== 'rules' && owner.id !== undefined ? { source: owner } : {}),
    ...(change.params ? { params: values } : {}),
  } as Change;
}

/** With `forEach`, once per element with `x` bound, each counting toward `maxActionSteps`. */
function repeated(
  ctx: Ctx,
  frame: Frame,
  change: ProposedChange,
  bound: Record<string, unknown>,
): Record<string, unknown>[] {
  if (change.forEach === undefined) return [bound];
  const list = evaluate(ctx, frame, change.forEach, bound);
  if (list.kind !== 'list')
    throw new ActionError('type-mismatch', { message: 'forEach needs a list' });
  return list.value.map((element) => {
    if (++ctx.stepsRun > MAX_STEPS)
      throw new ActionError('safety-limit-exceeded', { limit: 'maxActionSteps' });
    return { ...bound, x: rootValue(element) };
  });
}

/** For a link, a qualified ID passed on unchecked; a role or target's may name an unloaded pack. */
function computedField(
  ctx: Ctx,
  frame: Frame,
  formula: Formula,
  bound: Record<string, unknown>,
  linked: boolean,
  other = false,
): string {
  const value = evaluate(ctx, frame, formula, bound);
  if (value.kind !== 'string')
    throw new ActionError('type-mismatch', { message: 'a computed field is a string' });
  const ref = value.value;
  if (linked) {
    if (!ref.includes(':')) throw new ActionError('unknown-field', { field: ref });
    return ref;
  }
  if (other && unloadedPack(ctx.ruleset, ref)) return ref;
  const qid = resolveField(ctx.ruleset, ref, frame.pack);
  if (!qid) throw new ActionError('unknown-field', { field: ref });
  if (!ctx.ruleset.fields[qid]?.input) throw new ActionError('not-input-field', { field: qid });
  return qid;
}

function proposeOne(
  ctx: Ctx,
  frame: Frame,
  step: Step,
  path: string,
  change: ProposedChange,
  bound: Record<string, unknown>,
  entries: { picked?: string | undefined },
  linked: boolean,
  route: Route,
  other = false,
): void {
  if (!test(ctx, frame, change.when, bound)) return;
  const tags = tagsOf(ctx, change.tags, (fm) => evaluate(ctx, frame, fm, bound));
  const resolve = (part: Record<string, unknown>, extraTags: string[]): Change => {
    const extra = { ...bound, ...part };
    const out: Record<string, unknown> = { type: change.type };
    if (typeof change.field === 'object')
      out.field = computedField(ctx, frame, change.field.formula, extra, linked, other);
    else if (change.field) out.field = change.field;
    if (typeof change.entry === 'object' && 'formula' in change.entry)
      out.entry = computedEntry(ctx, frame, change.entry.formula, extra);
    else if (typeof change.entry === 'object')
      out.entry = proposedEntry(ctx, frame, change.entry, bound, linked, other);
    else if (change.entry === 'self') out.entry = frame.entry;
    else if (change.entry === 'picked' && entries.picked !== undefined) out.entry = entries.picked;
    else if (change.entry !== undefined) out.entry = change.entry;
    if (change.key !== undefined) out.key = change.key;
    if (change.id !== undefined) out.id = change.id;
    if (change.source !== undefined)
      out.source = contentRef(ctx, frame, change.source, extra, linked, other);
    if (change.active !== undefined) {
      const active = evaluate(ctx, frame, change.active, extra);
      if (active.kind !== 'bool')
        throw new ActionError('type-mismatch', { message: '`active` is a boolean' });
      out.active = active.value;
    }
    if (change.equipped !== undefined) {
      const equipped = evaluate(ctx, frame, change.equipped, extra);
      if (equipped.kind !== 'bool')
        throw new ActionError('type-mismatch', { message: '`equipped` is a boolean' });
      out.equipped = equipped.value;
    }
    if (change.template !== undefined)
      out.template = contentRef(ctx, frame, change.template, extra, linked, other, true);
    // A state value reading `batch` is passed on as `{ formula }` for applyChanges to evaluate.
    if (change.state)
      out.state = Object.fromEntries(
        Object.entries(change.state).map(([k, v]) => [
          k,
          reads(v, ['batch'])
            ? {
                formula: passOn(ctx, frame, v, {
                  ...extra,
                  action: bound.action ?? actionRoot(ctx, frame, step),
                }),
              }
            : outputData(evaluate(ctx, frame, v, extra)),
        ]),
      );
    if (change.path) out.path = resolvePath(ctx, frame, change.path, extra, entries.picked);
    if (change.option !== undefined)
      out.option = outputData(evaluate(ctx, frame, change.option, extra));
    // `self` is the action's content; `owner` the content the change is written on, which in an
    // added option or changes is the effect's.
    const activationOf = (ref: 'self' | 'owner') =>
      ref === 'owner' && frame.owner ? frame.owner.activation : frame.activation;
    if (change.pick !== undefined) {
      const a = activationOf(change.pick);
      const option = a?.kind === 'pick' ? a.path.choice.at(-1) : undefined;
      if (!a || option === undefined)
        throw new ActionError('unknown-reference', { kind: 'pick', id: change.pick });
      out.path = { ...a.path, choice: a.path.choice.slice(0, -1) };
      out.option = option;
    }
    if (change.grant !== undefined) {
      // The holder grant that activated the content: its node (the copy, or the pick its path
      // ends at) and the granted item.
      const a = activationOf(change.grant);
      if (!a?.item || a.kind !== 'grant' || a.scope !== 'holder')
        throw new ActionError('unknown-reference', { kind: 'grant', id: change.grant });
      if (a.path.choice.length === 0) out.entry = a.path.entry;
      else {
        out.path = { ...a.path, choice: a.path.choice.slice(0, -1) };
        out.option = a.path.choice.at(-1);
      }
      out.grant = a.item.qid;
    }
    if (change.copies || change.applied || change.picks || change.grants) {
      // applyChanges resolves the query on the receiving character and evaluates per-copy
      // formulas for each match; other formulas are evaluated now.
      const passed = { ...extra, action: bound.action ?? actionRoot(ctx, frame, step) };
      if (change.copies) {
        const type = change.copies.type;
        out.copies = {
          ...change.copies,
          type:
            other && unloadedPack(ctx.ruleset, type)
              ? type
              : (resolveType(ctx.ruleset, type, frame.pack) ?? type),
          ...(change.copies.where !== undefined
            ? { where: passOn(ctx, frame, change.copies.where, passed) }
            : {}),
        };
        if (change.limit !== undefined) out.limit = change.limit;
      }
      if (change.applied)
        out.applied = {
          where: passOn(ctx, frame, change.applied.where, passed),
          ...(change.applied.limit !== undefined ? { limit: change.applied.limit } : {}),
        };
      if (change.picks)
        out.picks = {
          where: passOn(ctx, frame, change.picks.where, passed),
          ...(change.picks.limit !== undefined ? { limit: change.picks.limit } : {}),
        };
      if (change.grants)
        out.grants = {
          where: passOn(ctx, frame, change.grants.where, passed),
          ...(change.grants.limit !== undefined ? { limit: change.grants.limit } : {}),
        };

      if (change.value !== undefined)
        out.value = perCopy(change.value)
          ? passOn(ctx, frame, change.value, passed)
          : literal(evaluate(ctx, frame, change.value, extra));
      if (change.by !== undefined)
        out.by = perCopy(change.by)
          ? passOn(ctx, frame, change.by, passed)
          : f.toData(evaluate(ctx, frame, change.by, extra));
    } else {
      if (change.value !== undefined)
        out.value = outputData(evaluate(ctx, frame, change.value, extra));
      if (change.by !== undefined) out.by = f.toData(evaluate(ctx, frame, change.by, extra));
    }
    const all = [...tags, ...extraTags];
    if (all.length > 0) out.tags = all;
    return out as unknown as Change;
  };
  if (change.split) {
    const items = frame.rollItems.get(itemsKey(frame, change.split.roll)) ?? [];
    const prefix = change.split.by;
    const groups = new Map<string | null, number>();
    for (const item of items) {
      const tag = item.tags.find((t) => t.startsWith(`${prefix}.`)) ?? null;
      groups.set(tag, (groups.get(tag) ?? 0) + itemValue(item));
    }
    for (const [tag, total] of groups) {
      ctx.proposed.push({
        ...route,
        step: path,
        change: resolve({ part: { total, tag } }, tag ? [tag] : []),
      });
    }
  } else {
    ctx.proposed.push({ ...route, step: path, change: resolve({}, []) });
  }
}

/** `entry` as a change's (`self`, `picked`, an instance ID or `{ formula }`); `choice` a list. */
function resolvePath(
  ctx: Ctx,
  frame: Frame,
  path: ProposedPath,
  extra: Record<string, unknown>,
  picked?: string,
): ChoicePath {
  const at = path.entry;
  const owner =
    typeof at === 'object'
      ? computedEntry(ctx, frame, at.formula, extra)
      : at === 'self'
        ? frame.entry
        : at === 'picked'
          ? (picked ?? at)
          : at;
  const choice = Array.isArray(path.choice)
    ? path.choice
    : f.toData(evaluate(ctx, frame, path.choice, extra));
  if (!Array.isArray(choice) || choice.some((c) => typeof c !== 'string'))
    throw new ActionError('type-mismatch', { message: 'a choice path is a list of strings' });
  return { ...(owner !== undefined ? { entry: owner } : {}), choice: choice as string[] };
}

/** Formulas only applyChanges can evaluate (per copy, or reading `batch`) are passed on. */
function perCopy(formula: Formula): boolean {
  return reads(formula, ['self', 'item', 'batch']);
}

function reads(formula: Formula, roots: string[]): boolean {
  if (typeof formula !== 'string') return false;
  const tree = f.parse(formula);
  if (!tree.ok) return false;
  return [...f.references(tree.value, new Set())].some((name) =>
    roots.includes(name.split('.')[0] as string),
  );
}

const ACTION_ROOTS: ReadonlySet<string> = new Set([
  'steps',
  'flags',
  'params',
  'action',
  'participants',
  'participant',
]);

/**
 * Paths rooted at `steps`, `flags`, `params` or `action` are replaced by their values as
 * literals, and each `has()` of one by `true` or `false`.
 */
function passOn(ctx: Ctx, frame: Frame, formula: Formula, bound: Record<string, unknown>): Formula {
  if (typeof formula !== 'string') return formula;
  const tree = f.parse(formula);
  if (!tree.ok) return formula;
  let changed = false;
  // A path that fails is an error unless a `has()` guards it: the failure is held at its place
  // in the tree and dropped with the operand that a substituted guard skips.
  const failed = new Map<f.Node, Failure>();
  const out = f.replaceRooted(tree.value, ACTION_ROOTS, {
    path: (path) => {
      changed = true;
      try {
        return literalTree(evaluate(ctx, frame, f.print(path), bound));
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
        const hole: f.Node = { type: 'null' };
        failed.set(hole, error);
        return hole;
      }
    },
    has: (path) => {
      changed = true;
      return { type: 'bool', value: test(ctx, frame, `has(${f.print(path)})`, bound) };
    },
    ref: (id) => {
      changed = true;
      return literalTree(evaluate(ctx, frame, `@${id}`, bound));
    },
  });
  if (!changed) return formula;
  const settled = failed.size > 0 ? skipGuarded(out, failed) : out;
  for (const [hole, error] of failed) if (contains(settled, hole)) throw error;
  return f.print(settled);
}

function contains(tree: f.Node, part: f.Node): boolean {
  if (tree === part) return true;
  return f.children(tree).some((child) => contains(child, part));
}

/** Drops the operands a literal guard skips when they hold a failed path, as evaluation would. */
function skipGuarded(node: f.Node, failed: ReadonlyMap<f.Node, Failure>): f.Node {
  const holds = (n: f.Node) => [...failed.keys()].some((hole) => contains(n, hole));
  const visit = (n: f.Node): f.Node => {
    switch (n.type) {
      case 'binary': {
        const left = visit(n.left);
        if (
          (n.op === '&&' || n.op === '||') &&
          left.type === 'bool' &&
          left.value === (n.op === '||') &&
          holds(n.right)
        )
          return left;
        return { ...n, left, right: visit(n.right) };
      }
      case 'conditional': {
        const testNode = visit(n.test);
        if (testNode.type === 'bool' && holds(testNode.value ? n.else : n.then))
          return visit(testNode.value ? n.then : n.else);
        // oxlint-disable-next-line unicorn/no-thenable
        return { ...n, test: testNode, then: visit(n.then), else: visit(n.else) };
      }
      case 'unary': {
        // `!has(...)` as a guard: a negated literal is a literal.
        const operand = visit(n.operand);
        if (n.op === '!' && operand.type === 'bool') return { type: 'bool', value: !operand.value };
        return { ...n, operand };
      }
      case 'list':
        return { ...n, items: n.items.map(visit) };
      case 'call':
        return { ...n, args: n.args.map(visit) };
      case 'member':
        return { ...n, object: visit(n.object) };
      case 'index':
        return { ...n, object: visit(n.object), index: visit(n.index) };
      case 'dice':
        return typeof n.count === 'number' ? n : { ...n, count: visit(n.count) };
      default:
        return n;
    }
  };
  return visit(node);
}

/** Strings are quoted so applyChanges reads them back as text; lists are printed. */
function literal(value: f.Value): unknown {
  const data = outputData(value);
  if (typeof data === 'string') return f.print({ type: 'string', value: data });
  return Array.isArray(data) ? f.print(literalTree(value)) : data;
}

/**
 * Qualified against the action's pack; a link's (and a role's or target's from an unloaded
 * pack) is kept as is. No content, or the wrong kind for `template`, is `unknown-reference`.
 */
function contentRef(
  ctx: Ctx,
  frame: Frame,
  formula: Formula,
  bound: Record<string, unknown>,
  linked: boolean,
  other: boolean,
  template = false,
): string {
  const ref = evaluate(ctx, frame, formula, bound);
  const text = ref.kind === 'string' ? ref.value : '';
  const passed = text.includes(':') && (linked || (other && unloadedPack(ctx.ruleset, text)));
  const qid = passed
    ? text
    : linked || !text
      ? undefined
      : resolveContent(ctx.ruleset, text, frame.pack);
  if (!qid || (!passed && (ctx.ruleset.content[qid]?.type === 'template') !== template))
    throw new ActionError('unknown-reference', { id: text });
  return qid;
}

/** The receiving character checks it; anything but a non-empty string is `type-mismatch`. */
function computedEntry(
  ctx: Ctx,
  frame: Frame,
  formula: Formula,
  extra: Record<string, unknown>,
): string {
  const value = evaluate(ctx, frame, formula, extra);
  if (value.kind !== 'string' || value.value === '')
    throw new ActionError('type-mismatch', { message: `entry evaluated to ${value.kind}` });
  return value.value;
}

/** Picks an unused copy ID when none is given; a link's item is kept as given. */
function proposedEntry(
  ctx: Ctx,
  frame: Frame,
  decl: ProposedEntry,
  bound: Record<string, unknown>,
  linked = false,
  other = false,
): Record<string, unknown> {
  const qid = contentRef(ctx, frame, decl.item, bound, linked, other);
  const foreign = linked || unloadedPack(ctx.ruleset, qid);
  if (!foreign && ctx.ruleset.content[qid]?.grantOnly)
    throw new ActionError('not-addable', { item: qid });
  let id = decl.id;
  if (id === undefined) {
    const used = new Set(
      [...(ctx.state.character.inventory ?? []), ...(ctx.state.character.features ?? [])].map(
        (e) => e.id,
      ),
    );
    for (const p of ctx.proposed) if (p.change.type === 'addItem') used.add(p.change.entry.id);
    const stem = localPart(qid).replaceAll('.', '-');
    let n = 1;
    while (used.has(`${stem}-${n}`)) n++;
    id = `${stem}-${n}`;
  }
  const out: Record<string, unknown> = { id, item: qid };
  if (decl.templates)
    out.templates = foreign
      ? decl.templates
      : decl.templates.map((t) => resolveContent(ctx.ruleset, t, frame.pack) ?? t);
  if (decl.equipped !== undefined)
    out.equipped = f.toData(evaluate(ctx, frame, decl.equipped, bound));
  if (decl.quantity !== undefined)
    out.quantity = f.toData(evaluate(ctx, frame, decl.quantity, bound));
  if (decl.state)
    out.state = Object.fromEntries(
      Object.entries(decl.state).map(([k, v]) => [k, outputData(evaluate(ctx, frame, v, bound))]),
    );
  if (decl.choices) out.choices = proposedPicks(ctx, frame, decl.choices, bound);
  return out;
}

/** An `option` given as `{ formula }` is evaluated; the keys stay as written. */
function proposedPicks(
  ctx: Ctx,
  frame: Frame,
  tree: Record<string, unknown>,
  bound: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, picks] of Object.entries(tree)) {
    out[key] = (picks as { option: unknown; choices?: Record<string, unknown> }[]).map((pick) => {
      let option = pick.option;
      if (option !== null && typeof option === 'object') {
        const value = evaluate(ctx, frame, (option as { formula: Formula }).formula, bound);
        if (value.kind !== 'string' && value.kind !== 'int' && value.kind !== 'decimal')
          throw new ActionError('type-mismatch', {
            message: `a pick's option is a string or number, not ${value.kind}`,
          });
        option = value.value;
      }
      return {
        option,
        ...(pick.choices ? { choices: proposedPicks(ctx, frame, pick.choices, bound) } : {}),
      };
    });
  }
  return out;
}

export { localPart };

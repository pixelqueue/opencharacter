import {
  assignable,
  type CheckContext,
  check,
  fieldFormulaType,
  type FType,
  type Node,
  type ObjectType,
  parse,
  parseCached,
  typeName,
} from '../formula/index.ts';
import type {
  ComputedDecl,
  ContentTypeDef,
  DeclaredField,
  Formula,
  Role,
  Situational,
  Step,
  ValueDecl,
} from '../core/pack-types.ts';
import { pendingSource, writtenOptions } from '../core/pack-types.ts';

/** Where a formula appears, which decides the context roots bound there. */
export type Place =
  | 'field' // field formulas, min/max, constraints, display hints, rules-level effects and choices
  | 'query' // a template's appliesTo
  | 'itemField' // item field values
  | 'content' // effects, grants, prerequisites and choices on content
  | 'template' // the same, on a template
  | 'action'
  | 'candidate' // a choice step's `where` and `prefer` over content or copies
  | 'situational'
  | 'band';

// `links` is bound wherever the character's own fields are read; item fields, state key bounds
// and queries see input fields and the item only. `participants` is bound in actions, and `dyn`
// in roll effects and bands; `participant` is added inside `each` steps (`dyn` in the same two).
const ROOTS: Record<Place, string[]> = {
  field: ['character', 'links'],
  query: ['character'],
  itemField: ['item', 'character'],
  content: ['item', 'self', 'character', 'links'],
  template: ['item', 'base', 'self', 'character', 'links'],
  action: [
    'item',
    'self',
    'character',
    'links',
    'steps',
    'flags',
    'params',
    'situational',
    'participants',
  ],
  candidate: [
    'item',
    'character',
    'links',
    'steps',
    'flags',
    'params',
    'situational',
    'picks',
    'action',
    'participants',
  ],
  situational: [
    'character',
    'links',
    'roll',
    'steps',
    'flags',
    'params',
    'situational',
    'participants',
    'participant',
  ],
  band: ['character', 'links', 'roll', 'steps', 'flags', 'params', 'participants', 'participant'],
};

/** Every context root name; field IDs may not start with one. */
export const ALL_ROOTS = new Set([
  'item',
  'base',
  'prior',
  'self',
  'pick',
  'slot',
  'steps',
  'flags',
  'params',
  'situational',
  'roll',
  'character',
  'links',
  'copy',
  'entry',
  'action',
  'picks',
  'picked',
  'options',
  'choice',
  'incoming',
  'participants',
  'participant',
  'change',
  'batch',
  'field',
  'amount',
  'f',
  'x',
]);

export function rootsFor(place: Place): string[] {
  return ROOTS[place];
}

/** The types a place accepts, or a test returning the expected type's name when it fails. */
export type Expect = FType[] | 'any' | ((type: FType) => string | undefined);
export const ANY: Expect = 'any';
export const BOOL: Expect = ['bool'];
export const NUMBER: Expect = ['decimal'];
export const DICE: Expect = ['dice'];
/** A list of participant IDs or views (objects with an `id`), possibly mixed. */
export const PARTICIPANT_LIST: Expect = (type) => {
  const ok =
    type === 'dyn' ||
    (typeof type === 'object' &&
      'list' in type &&
      (type.list === 'dyn' ||
        type.list === 'string' ||
        (typeof type.list === 'object' && 'object' in type.list && 'id' in type.list.object)));
  return ok ? undefined : 'a list of participant IDs or views';
};

/** Parses a formula from a pack file. Plain numbers and booleans become literal trees. */
export function formulaTree(formula: Formula): ReturnType<typeof parse> {
  if (typeof formula === 'boolean') return { ok: true, value: { type: 'bool', value: formula } };
  if (typeof formula === 'number') {
    const node: Node = Number.isInteger(formula)
      ? { type: 'int', value: Math.abs(formula) }
      : { type: 'decimal', value: Math.abs(formula) };
    return { ok: true, value: formula < 0 ? { type: 'unary', op: '-', operand: node } : node };
  }
  return parseCached(formula);
}

export function checkFormula(
  formula: Formula,
  ctx: CheckContext,
  expect: Expect,
): { code: string; message: string } | undefined {
  const tree = formulaTree(formula);
  if (!tree.ok) return { code: tree.error.code, message: tree.error.message };
  const type = check(tree.value, ctx);
  if (!type.ok) return { code: type.error.code, message: type.error.message };
  if (typeof expect === 'function') {
    const expected = expect(type.value);
    if (expected !== undefined)
      return { code: 'type-mismatch', message: `is ${typeName(type.value)}, expected ${expected}` };
    return undefined;
  }
  if (expect !== 'any' && !expect.some((e) => assignable(type.value, e))) {
    return {
      code: 'type-mismatch',
      message: `is ${typeName(type.value)}, expected ${expect.map(typeName).join(' or ')}`,
    };
  }
  return undefined;
}

// Context root types, so the checker catches paths that can't exist (`item.damge`).

const declTypes = (decls: Record<string, ValueDecl> | undefined): Record<string, FType> =>
  Object.fromEntries(Object.entries(decls ?? {}).map(([k, d]) => [k, fieldFormulaType(d.type)]));

/** Closed, so unknown fields are errors; the type's own fields win over template fields. */
export function itemType(
  type: ContentTypeDef | undefined,
  templateFields?: Record<string, ValueDecl>,
): FType {
  if (!type) return 'dyn';
  return {
    object: {
      id: 'string',
      type: 'string',
      tags: { list: 'string' },
      ...declTypes(templateFields),
      ...declTypes(type.fields),
    },
  };
}

export const FIELD_ITEM: ObjectType = {
  object: { id: 'string', type: 'string', tags: { list: 'string' } },
};

/** An action as computeSheet lists it; `entry` and `source` may be absent. */
export const ACTION_ITEM: ObjectType = {
  object: { id: 'string', tags: { list: 'string' }, entry: 'string', source: 'string' },
};

export const PENDING_CHOICE: ObjectType = {
  object: {
    path: 'dyn',
    owner: 'string',
    id: 'string',
    slot: { object: { choice: 'string', number: 'int' } },
  },
};

export const ALLOCATED_FIELD: ObjectType = { object: { id: 'string', value: 'int' } };

/**
 * Open: picked or granted content sees its owner's copy, which may have more state. Computed
 * values stay hidden until `revealComputed`.
 */
export function selfType(
  type: ContentTypeDef | undefined,
  ...extra: (Record<string, ValueDecl> | undefined)[]
): FType {
  return {
    open: true,
    object: {
      id: 'string',
      equipped: 'bool',
      quantity: 'int',
      templates: { list: 'string' },
      ...declTypes(type?.state),
      ...Object.assign({}, ...extra.map(declTypes)),
    },
    hidden: computedTypes(type?.computed),
  };
}

function computedTypes(computed: Record<string, ComputedDecl> | undefined): Record<string, FType> {
  return Object.fromEntries(
    Object.entries(computed ?? {}).map(([name, decl]) => [name, fieldFormulaType(decl.type)]),
  );
}

export function withComputed(
  self: FType,
  computed: Record<string, ComputedDecl> | undefined,
): FType {
  if (typeof self !== 'object' || !('object' in self) || !computed) return self;
  return { ...self, hidden: { ...self.hidden, ...computedTypes(computed) } };
}

/** With `names`, only those (a computed value reads the ones declared before it). */
export function revealComputed(self: FType | undefined, names?: string[]): FType | undefined {
  if (self === undefined || typeof self !== 'object' || !('object' in self) || !self.hidden)
    return self;
  const { hidden, ...rest } = self;
  if (names === undefined) return { ...rest, object: { ...rest.object, ...hidden } };
  const shown = Object.fromEntries(Object.entries(hidden).filter(([n]) => names.includes(n)));
  const kept = Object.fromEntries(Object.entries(hidden).filter(([n]) => !names.includes(n)));
  return { ...rest, object: { ...rest.object, ...shown }, hidden: kept };
}

/** `character.applied`: the saved entries, raw; `state` is `dyn`. */
export const APPLIED_ENTRY: ObjectType = {
  object: { id: 'string', source: 'string', active: 'bool', state: 'dyn' },
};

export const CHARACTER: ObjectType = {
  object: {
    id: 'string',
    inventory: { list: 'dyn' },
    features: { list: 'dyn' },
    creating: 'bool',
    applied: { list: APPLIED_ENTRY },
  },
};

/** Open: an item may declare more state keys than its type. */
export function entryType(type: ContentTypeDef | undefined): FType {
  return { open: true, object: { id: 'string', ...declTypes(type?.state) } };
}
export const OWN_CHOICE: ObjectType = {
  object: { ...PENDING_CHOICE.object, picks: { list: 'dyn' } },
};
export const PICK: ObjectType = { object: { id: 'dyn', value: 'dyn' } };
export const INCOMING: ObjectType = {
  object: { amount: 'decimal', field: 'string', tags: { list: 'string' } },
};
/** The field entries of the batch's earlier changes on the character. */
export const BATCH: ObjectType = {
  object: {
    adjustments: {
      list: {
        object: {
          field: 'string',
          by: 'decimal',
          requested: 'decimal',
          reason: 'string',
          clamped: 'bool',
          tags: { list: 'string' },
        },
      },
    },
  },
};
export const CHANGE: ObjectType = {
  object: {
    by: 'decimal',
    requested: 'decimal',
    taken: 'decimal',
    reason: 'string',
    clamped: 'bool',
    tags: { list: 'string' },
  },
};
export const PART: ObjectType = { object: { total: 'int', tag: 'dyn' } };
export function talliesType(names: Iterable<string>): ObjectType {
  return { object: Object.fromEntries([...names].map((n) => [n, 'int' as FType])) };
}
const NO_TALLIES = talliesType([]);
// A roll made more than once (`of: roll`): every whole roll, the kept one marked.
const ROLLS: FType = { list: { object: { total: 'int', kept: 'bool', items: 'dyn' } } };
function rollResult(tallies: FType): ObjectType {
  return {
    object: {
      total: 'int',
      faces: { list: 'int' },
      kept: { list: 'int' },
      empty: 'bool',
      band: 'string',
      bandSet: 'string',
      bandValue: 'dyn',
      dice: 'dyn',
      tallies,
      // Each bound that changed the total, and the total before them.
      bounds: { list: { object: { source: 'dyn', op: 'string', value: 'int' } } },
      unbounded: 'int',
      rolls: ROLLS,
    },
  };
}
export function bandRoll(tallies: FType = NO_TALLIES, value?: FType): ObjectType {
  return {
    object: {
      total: 'int',
      faces: { list: 'int' },
      kept: { list: 'int' },
      empty: 'bool',
      tallies,
      rolls: ROLLS,
      ...(value !== undefined ? { value } : {}),
    },
  };
}
export const EFFECT_ROLL: ObjectType = {
  open: true,
  object: {
    item: 'dyn',
    self: 'dyn',
    tags: { list: 'string' },
    total: 'int',
    faces: { list: 'int' },
    kept: { list: 'int' },
    empty: 'bool',
  },
};

export function paramsType(params: Record<string, ValueDecl> | undefined): FType {
  return { object: declTypes(params) };
}

export type ChoiceViews = (step: Step) => { item?: FType; self?: FType; value?: FType };

export function actionType(item: FType, self: FType): ObjectType {
  return {
    object: { item, self, step: { object: { id: 'string', tags: { list: 'string' } } } },
  };
}

export function pickedType(views: { item?: FType; self?: FType; value?: FType }): ObjectType {
  return { object: { id: 'string', ...views } };
}

/** The instance IDs of the copies a step's own `addItem`s add to the actor. */
const ADDED: FType = { list: 'string' };

/**
 * An `each` step's result is a list of per-participant results; one of them inside an `each`
 * step over `eachRole`; the list of its earlier runs inside step `own` itself.
 */
export function stepsAndFlags(
  steps: Step[],
  tallies: FType = NO_TALLIES,
  views: ChoiceViews = () => ({}),
  eachRole?: string,
  own?: string,
): { steps: FType; flags: FType } {
  const stepTypes: Record<string, FType> = {};
  const flags: Record<string, FType> = {};
  const walk = (list: Step[], inherited?: string) => {
    for (const step of list) {
      const role = step.each ?? inherited;
      let type: FType = 'dyn';
      if (step.kind === 'roll') type = rollResult(tallies);
      else if (step.kind === 'choice')
        type = pendingSource(step)
          ? { object: { picked: { list: 'string' }, paths: { list: 'dyn' }, added: ADDED } }
          : step.repeat
            ? { object: { picked: { list: 'string' }, added: ADDED } }
            : { object: { picked: 'string', ...views(step), added: ADDED } };
      else if (step.kind === 'changes') type = { object: { added: ADDED } };
      else if (step.kind === 'action') type = { object: { result: 'string', data: 'dyn' } };
      // An allocate step's amounts are by qualified field ID, which no path can name.
      else if (step.kind === 'allocate') type = { object: { amounts: 'dyn' } };
      stepTypes[step.id] =
        role === undefined || (role === eachRole && step.id !== own) ? type : { list: type };
      if (step.kind === 'choice')
        for (const option of writtenOptions(step))
          for (const name of Object.keys(option.flags ?? {})) flags[name] = 'dyn';
      for (const arm of [...(step.cases ?? []), ...(step.else ? [step.else] : [])]) {
        for (const name of Object.keys(arm.flags ?? {})) flags[name] = 'dyn';
        walk(arm.steps ?? [], step.kind === 'branch' ? role : inherited);
      }
    }
  };
  walk(steps);
  return { steps: { object: stepTypes }, flags: { object: flags } };
}

/** One closed view per link slot, the pack's own first; field IDs nest at the dots. */
export function linksType(slots: [string, Record<string, DeclaredField>][]): ObjectType {
  const out: Record<string, FType> = {};
  for (const [name, fields] of slots) {
    if (name in out) continue;
    out[name] = viewType(fields);
  }
  return { object: out };
}

export function participantsType(roles: Record<string, Role> | undefined): ObjectType {
  return {
    object: Object.fromEntries(
      Object.entries(roles ?? {}).map(([role, decl]) => [
        role,
        { list: viewType(decl.fields ?? {}) } as FType,
      ]),
    ),
  };
}

export function viewType(fields: Record<string, DeclaredField>): ObjectType {
  const view: ObjectType = { object: { id: 'string' } };
  for (const [id, decl] of Object.entries(fields)) {
    const parts = id.split('.');
    let node = view;
    for (const part of parts.slice(0, -1)) {
      const next = node.object[part];
      if (typeof next === 'object' && 'object' in next) node = next;
      else {
        const created: ObjectType = { object: {} };
        node.object[part] = created;
        node = created;
      }
    }
    node.object[parts.at(-1) as string] = fieldFormulaType(decl.type);
  }
  return view;
}

export function situationalType(choices: Situational[]): FType {
  const types: Record<string, FType> = {};
  for (const c of choices)
    types[c.id] = c.type === 'boolean' ? 'bool' : c.type === 'integer' ? 'int' : 'string';
  return { object: types };
}

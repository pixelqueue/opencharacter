import { appliesQueries, stepArms } from '../core/pack-types.ts';
import {
  type CheckContext,
  check,
  children,
  evaluate,
  fieldFormulaType,
  type FType,
  type Node,
  print,
  references,
  replaceRooted,
} from '../formula/index.ts';
import type {
  ActionDef,
  ActionOrUse,
  Choice,
  ComputedDecl,
  ContentItem,
  ContentTypeDef,
  DisplayGroup,
  Effect,
  FollowUp,
  FieldDef,
  Formula,
  Grant,
  PresetTree,
  GrantValue,
  Immunity,
  InlineOption,
  KeptTemplate,
  OptionValue,
  StepChanges,
  ProposedChange,
  Query,
  RollModifier,
  Step,
  ValueDecl,
  ValueOptions,
} from '../core/pack-types.ts';
import {
  keptQuery,
  optionQuery,
  pendingSource,
  valueSource,
  writtenOptions,
} from '../core/pack-types.ts';
import { isContentOnly, readsOnlyRoots } from '../core/load.ts';
import type { PackSet } from './packset.ts';
import {
  actionType,
  ANY,
  bandRoll,
  BOOL,
  CHANGE,
  CHARACTER,
  checkFormula,
  DICE,
  EFFECT_ROLL,
  entryType,
  type Expect,
  ACTION_ITEM,
  ALLOCATED_FIELD,
  BATCH,
  FIELD_ITEM,
  PARTICIPANT_LIST,
  PENDING_CHOICE,
  OWN_CHOICE,
  formulaTree,
  INCOMING,
  itemType,
  KEPT_OWNER,
  linksType,
  NUMBER,
  PART,
  PICK,
  participantsType,
  pickedType,
  type Place,
  paramsType,
  revealComputed,
  rootsFor,
  selfType,
  situationalType,
  stepsAndFlags,
  talliesType,
  viewType,
  withComputed,
} from './roots.ts';

// Every formula in a pack must parse and type-check against the visible fields and the context
// roots bound where it appears (packages/spec/docs/formulas.md).

/** A formula that doesn't parse or type-check. */
export interface FormulaProblem<L> {
  at: L;
  /** What the formula belongs to, for people (`field hp.max`, `weapons.longsword effect`). */
  where: string;
  formula: Formula;
  code: string;
  message: string;
}

export interface CheckOptions<L = unknown> {
  /** Called with every formula written as text, with where it is and what it belongs to. */
  onFormula?: (text: string, at: L, where: string) => void;
}

/** Checks the formulas of one pack in a pack set; returns the problems found. */
export function checkPackFormulas<L>(
  set: PackSet<L>,
  packId: string,
  options: CheckOptions<L> = {},
): FormulaProblem<L>[] {
  const checker = new FormulaChecker(set, packId, options);
  checker.run();
  return checker.problems;
}

function readsCopy(formula: Formula): boolean {
  return readsRoot(formula, ['self', 'item', 'batch']);
}

function readsRoot(formula: Formula, roots: string[]): boolean {
  const tree = formulaTree(formula);
  return (
    tree.ok &&
    [...references(tree.value, new Set())].some((n) => roots.includes(n.split('.')[0] as string))
  );
}

function targetKind(target: Effect['target']): 'field' | 'roll' | 'incoming' | 'choice' | 'step' {
  if (typeof target === 'string' || 'fields' in target || 'formula' in target) return 'field';
  if ('choices' in target) return 'choice';
  if ('steps' in target) return 'step';
  return 'rolls' in target ? 'roll' : 'incoming';
}

const ROLL_ROOTS = [
  'roll',
  'action',
  'steps',
  'flags',
  'params',
  'situational',
  'participants',
  'participant',
];

const OPTION_ROOTS = ['steps', 'flags', 'params', 'situational', 'action', 'picks'];

const STEP_ROOTS = [
  'steps',
  'flags',
  'params',
  'situational',
  'action',
  'participants',
  'participant',
];

const PASSED_ROOTS = ['steps', 'flags', 'params', 'action', 'participants'];

function hasLiteral(type: FType): boolean {
  if (typeof type === 'string') return true;
  if ('list' in type) return hasLiteral(type.list);
  return false;
}

interface ActionTarget<L> {
  def: ActionDef;
  pack: string;
  at: L;
  key: string;
  ownerType?: string;
}

function reachesChoice(steps: Step[], tags: string[]): boolean {
  return steps.some((step) => {
    const own = (step.tags ?? []).filter((t): t is string => typeof t === 'string');
    if (
      step.kind === 'choice' &&
      tags.some((target) => own.some((t) => t === target || t.startsWith(`${target}.`)))
    )
      return true;
    return stepArms(step).some((arm) => reachesChoice(arm.steps ?? [], tags));
  });
}

const actionKey = (action: ActionOrUse) => ('use' in action ? action.use : action.id);

const FLAG_TYPES = new WeakMap<ActionDef, Map<string, FType[]>>();

function actionFlagTypes<L>(set: PackSet<L>, target: ActionTarget<L>): Map<string, FType[]> {
  let types = FLAG_TYPES.get(target.def);
  if (!types) {
    types = FormulaChecker.flagTypesOf(set, target);
    FLAG_TYPES.set(target.def, types);
  }
  return types;
}

/** An owner whose choices are known only when the formula runs (a content type's, the rules'). */
const ANY_CHOICE = Symbol('any choice');

/** The keys of an owner's choices: each choice's ID, a slotted one's `<id>-<slot>` per slot. */
function choiceKeys(choices: readonly Choice[] | undefined): string[] {
  return (choices ?? []).flatMap((c) => (c.slots ? c.slots.map((n) => `${c.id}-${n}`) : [c.id]));
}

class FormulaChecker<L> {
  readonly problems: FormulaProblem<L>[] = [];
  private readonly scope: string[];
  private readonly targetsByTags = new Map<string, ActionTarget<L>[]>();

  constructor(
    private readonly set: PackSet<L>,
    private readonly packId: string,
    private readonly options: CheckOptions<L>,
  ) {
    this.scope = set.scope(packId);
    this.types = { character: CHARACTER, links: this.linksRoot() };
  }

  run(): void {
    const rules = this.set.rules.get(this.packId);
    if (!rules) return;

    for (const [id, { def, at }] of rules.fields) {
      const where = `field ${id}`;
      this.formula(def.formula, at, where, [fieldFormulaType(def.type)]);
      this.formula(def.min, at, where, NUMBER);
      this.formula(def.max, at, where, NUMBER);
      this.formula(def.limits?.min, at, `${where} limits`, NUMBER);
      this.formula(def.limits?.max, at, `${where} limits`, NUMBER);
      this.tagList(def.tags, at, where);
      for (const overflow of def.overflow ?? []) {
        this.formula(overflow.by, at, `${where} overflow`, ['int']);
        this.formula(overflow.reset, at, `${where} overflow`, NUMBER);
        this.tagList(overflow.tags, at, `${where} overflow`);
      }
    }

    for (const [name, { def, at }] of rules.templateFields)
      if (
        typeof def.default === 'string' &&
        ['integer', 'decimal', 'boolean', 'dice'].includes(def.type)
      )
        this.at('itemField', () =>
          this.formula(def.default as string, at, `template field ${name} default`, [
            fieldFormulaType(def.type),
          ]),
        );

    for (const [name, { def, at }] of rules.contentTypes) {
      const where = `content type ${name}`;
      for (const key of ['max', 'perItem'] as const)
        if (typeof def.copies?.[key] === 'string')
          this.formula(def.copies[key] as string, at, `${where} copies ${key}`, ['int']);
      for (const [key, decl] of Object.entries(def.state ?? {}))
        this.stateDefault(decl, def, at, `${where} state ${key}`);
      this.typed({ item: this.itemOf(def), self: selfType(def) }, () =>
        this.at('content', () => {
          for (const [field, decl] of Object.entries(def.fields ?? {}))
            if (
              typeof decl.default === 'string' &&
              ['integer', 'decimal', 'boolean', 'dice'].includes(decl.type)
            )
              this.at('itemField', () =>
                this.formula(decl.default as string, at, `${where} field ${field} default`, [
                  fieldFormulaType(decl.type),
                ]),
              );
          // Run for each item of the type: its choices, known only then.
          this.owned(ANY_CHOICE, () => {
            this.computed(def.computed, at, where);
            for (const effect of def.effects ?? []) this.effect(effect, at, where);
            for (const fu of def.followUps ?? [])
              this.followUp(fu, at, `${where} follow-up ${fu.id}`);
            for (const grant of def.grants ?? []) this.grant(grant, at, `${where} grant`);
          });
        }),
      );
      for (const action of def.actions ?? [])
        this.owned(ANY_CHOICE, () =>
          this.at('action', () => this.actionOrUse(action, at, `types.${name}`, name)),
        );
    }

    for (const [id, { def, at }] of rules.situational) {
      this.tagList(def.rolls, at, `situational ${id}`);
      this.tagList(def.incoming?.tags, at, `situational ${id}`);
      this.formula(def.available, at, `situational ${id}`, BOOL);
      for (const effect of def.effects ?? []) {
        // An incoming-change effect sees the receiving character, not a roll.
        if (targetKind(effect.target) === 'incoming')
          this.at('field', () => this.effect(effect, at, `situational ${id}`));
        else
          this.typed(this.rollTypes(), () =>
            this.at('situational', () => this.effect(effect, at, `situational ${id}`)),
          );
      }
    }

    for (const [set, { def, at }] of rules.bands) {
      let value: FType | undefined;
      if (def.value !== undefined)
        this.typed({ roll: bandRoll(this.talliesRoot()), participants: 'dyn' }, () =>
          this.at('band', () =>
            this.formula(def.value, at, `band set ${set} value`, (type) => {
              value = type;
              return undefined;
            }),
          ),
        );
      const roll = bandRoll(
        this.talliesRoot(),
        def.value !== undefined ? (value ?? 'dyn') : undefined,
      );
      for (const band of def.bands) {
        this.typed({ roll, participants: 'dyn' }, () =>
          this.at('band', () => this.formula(band.when, at, `band ${set}.${band.id}`, BOOL)),
        );
      }
    }

    // A rules action reads the choices of the copy that uses it, else the rules'; the rules'
    // effects, follow-ups and choices read the rules' choices, from every loaded pack.
    this.owned(ANY_CHOICE, () => {
      for (const [, { def, at }] of rules.actions)
        this.at('action', () => this.action(def, at, `actions.${def.id}`));
      for (const { def, at } of rules.effects) this.effect(def, at, 'rules effect');
      for (const { def, at } of rules.followUps) this.followUp(def, at, `follow-up ${def.id}`);
    });
    for (const { def, at } of rules.immuneTo) this.immunity(def, at, 'rules');
    for (const { def, at } of rules.standardCopies)
      this.standardQuery(def, at, 'rules standardCopies');
    for (const { def, at } of rules.choices.values())
      this.owned(ANY_CHOICE, () => this.choices([def], at, 'rules'));
    // Options added to a dependency's choices read what that choice's own options do: the owning
    // item and its copy, or the rules'.
    for (const [target, { def, at }] of rules.extendChoices) {
      const local = target.slice(target.indexOf(':') + 1);
      const owner = local === 'rules' ? undefined : this.set.item(target, this.scope);
      const typeDef = owner ? this.contentTypeDef(this.set.typeOf(owner)) : undefined;
      const options = () =>
        this.owned(ANY_CHOICE, () => {
          for (const [path, addition] of Object.entries(def))
            if ('options' in addition)
              this.inlineOptions(addition.options, at, `${local}.choices.${path}`);
        });
      if (local === 'rules') options();
      else
        this.typed({ item: this.itemOf(typeDef), self: selfType(typeDef) }, () =>
          this.at('content', options),
        );
    }

    for (const [id, { def, at }] of rules.constraints) {
      const constraintFormulas = () => {
        this.formula(def.check, at, `constraint ${id}`, BOOL);
        for (const value of Object.values(def.data ?? {}))
          this.formula(value, at, `constraint ${id}`, ANY);
      };
      const typeDef = def.copies ? this.contentTypeDef(def.copies.type) : undefined;
      if (!def.copies) constraintFormulas();
      else
        this.typed({ item: this.itemOf(typeDef), self: selfType(typeDef) }, () =>
          this.at('content', () => {
            this.formula(def.copies?.where, at, `constraint ${id} copies`, BOOL);
            constraintFormulas();
          }),
        );
    }

    for (const [id, { def, at }] of rules.groups) this.group(def, at, `group ${id}`);
    for (const [id, { def, at }] of rules.fieldHints)
      this.showWhen(def.showWhen, at, `display hints for ${id}`);
    for (const [type, { def, at }] of rules.typeHints) {
      const typeDef = this.contentTypeDef(type);
      this.typed({ item: this.itemOf(typeDef), self: selfType(typeDef) }, () =>
        this.at('content', () => {
          for (const [key, hints] of Object.entries(def.state ?? {}))
            this.showWhen(hints.showWhen, at, `display hints for ${type} state ${key}`);
        }),
      );
    }

    for (const { at, doc } of this.set.packContent.get(this.packId) ?? []) {
      const ownType =
        doc.type === 'template'
          ? appliesQueries(doc)[0]?.type
          : (doc.type ?? this.typeOfParent(doc));
      const typeDef = this.contentTypeDef(ownType);
      const item = this.itemOf(typeDef);
      const self = withComputed(selfType(typeDef, doc.state), doc.computed);
      const types: Record<string, FType> = { item, self };
      if (doc.type === 'template') types.base = types.prior = item;
      this.typed(types, () =>
        this.at(doc.type === 'template' ? 'template' : 'content', () => this.item(doc, at)),
      );
    }
  }

  private item(item: ContentItem, at: L): void {
    // An override or extension may take its choices from the item it replaces.
    const own = item.override || item.extends ? ANY_CHOICE : choiceKeys(item.choices);
    this.owned(own, () => this.ownedItem(item, at));
  }

  private ownedItem(item: ContentItem, at: L): void {
    const owner = item.id ?? item.override ?? '?';
    this.tagList(item.tags, at, owner);
    // A template's formulas see the base item as `base`.
    const template = item.type === 'template';
    const type = this.contentTypeDef(template ? appliesQueries(item)[0]?.type : item.type);
    for (const [name, value] of Object.entries(item.fields ?? {})) {
      const decl = type?.fields?.[name] ?? (template ? this.templateFields[name] : undefined);
      if (!decl || value === null || Array.isArray(value)) continue;
      // A template's string, enum or id value may be `{ formula }`, a string formula.
      const formula = typeof value === 'object' ? value.formula : value;
      const numeric = ['integer', 'decimal', 'boolean', 'dice'].includes(decl.type);
      if (typeof value === 'object' ? !['string', 'enum', 'id'].includes(decl.type) : !numeric)
        continue;
      this.at('itemField', () =>
        this.typed(template && item.params ? { params: paramsType(item.params) } : {}, () =>
          this.withRoots(
            template ? ['base', 'prior', ...(item.params ? ['params'] : [])] : [],
            () =>
              this.formula(formula, at, `${owner}.fields.${name}`, [
                numeric ? fieldFormulaType(decl.type) : 'string',
              ]),
          ),
        ),
      );
    }
    for (const query of appliesQueries(item))
      this.at('query', () => this.query(query, at, `${owner} appliesTo`));
    const ownType = this.contentTypeDef(
      item.type === 'template'
        ? appliesQueries(item)[0]?.type
        : (item.type ?? this.typeOfParent(item)),
    );
    for (const [key, decl] of Object.entries(item.state ?? {}))
      this.stateDefault(decl, ownType, at, `${owner} state ${key}`);
    this.computed(item.computed, at, owner, ownType?.computed);
    for (const effect of item.effects ?? []) this.effect(effect, at, owner);
    for (const fu of item.followUps ?? []) this.followUp(fu, at, `${owner} follow-up ${fu.id}`);
    for (const action of item.actions ?? [])
      this.at('action', () =>
        this.actionOrUse(
          action,
          at,
          `${owner}.actions`,
          item.type ?? this.typeOfParent(item),
          item.computed,
        ),
      );
    this.choices(item.choices ?? [], at, owner);
    for (const grant of item.grants ?? []) this.grant(grant, at, `${owner} grant`);
    for (const immunity of item.immuneTo ?? []) this.immunity(immunity, at, owner);
    for (const query of item.standardCopies ?? [])
      this.standardQuery(query, at, `${owner} standardCopies`);
    // Kept templates: the copies or content query reads only `item` (resolved at load) or is an
    // activation condition with the candidate as `item`; `when` and `params` are activation
    // formulas.
    for (const kept of item.keepsTemplates ?? []) this.keptTemplate(kept, at, owner);
    for (const prerequisite of item.prerequisites ?? [])
      this.formula(prerequisite.when, at, `${owner} prerequisite ${prerequisite.id}`, BOOL);
  }

  private keptTemplate(kept: KeptTemplate, at: L, owner: string): void {
    const where = `${owner} keepsTemplates`;
    const query = keptQuery(kept);
    if (isContentOnly(query.where)) this.standardQuery(query, at, where);
    // On content without a copy, the candidate activation's `owner` too.
    else if (kept.content)
      this.activation(() =>
        this.typed({ owner: KEPT_OWNER }, () =>
          this.withRoots(['owner'], () => this.query(query, at, where)),
        ),
      );
    else this.activation(() => this.query(query, at, where));
    this.activation(() => this.formula(kept.when, at, where, BOOL));
    if (!kept.params) return;
    const template = this.set.item(kept.template, this.scope)?.item;
    const declared = template?.type === 'template' ? (template.params ?? {}) : undefined;
    for (const [name, formula] of Object.entries(kept.params)) {
      const decl = declared?.[name];
      if (declared && !decl) {
        this.problems.push({
          at,
          where: `${where} params ${name}`,
          formula,
          code: 'unknown-name',
          message: `the template declares no param "${name}" (${Object.keys(declared).join(', ') || 'none'})`,
        });
        continue;
      }
      this.activation(() =>
        this.formula(
          formula,
          at,
          `${where} params ${name}`,
          decl ? [fieldFormulaType(decl.type)] : ANY,
        ),
      );
    }
  }

  /** A state key's `default`, `min` and `max` see only `item` and input fields. */
  private stateDefault(
    decl: ValueDecl,
    type: ContentTypeDef | undefined,
    at: L,
    where: string,
  ): void {
    const formulaDefault =
      typeof decl.default === 'string' &&
      ['integer', 'decimal', 'boolean', 'dice'].includes(decl.type)
        ? decl.default
        : undefined;
    this.typed({ item: this.itemOf(type) }, () =>
      this.at('itemField', () =>
        this.activation(() => {
          this.formula(formulaDefault, at, `${where} default`, [fieldFormulaType(decl.type)]);
          this.formula(decl.min, at, `${where} min`, NUMBER);
          this.formula(decl.max, at, `${where} max`, NUMBER);
        }),
      ),
    );
  }

  private tagList(
    tags: readonly (string | { formula: Formula })[] | undefined,
    at: L,
    where: string,
  ): void {
    for (const tag of tags ?? [])
      if (typeof tag !== 'string')
        this.formula(tag.formula, at, where, ['string', { list: 'string' }]);
  }

  private group(def: DisplayGroup, at: L, where: string): void {
    this.showWhen(def.showWhen, at, where);
    const members = def.members;
    if (def.kind === 'actions') {
      if (members)
        this.typed({ item: ACTION_ITEM }, () =>
          this.withRoots(['item'], () => this.formula(members.where, at, where, BOOL)),
        );
    } else if (def.kind === 'content') {
      const typeDef = this.contentTypeDef(members?.type);
      const self = members?.from === 'applied' ? entryType(typeDef) : selfType(typeDef);
      this.typed({ item: this.itemOf(typeDef), self }, () =>
        this.at('content', () =>
          this.onlyRoots([], () => {
            this.formula(members?.where, at, where, BOOL);
            this.formula(def.sectionBy, at, `${where} sectionBy`, ['int', 'string']);
            this.formula(def.sortBy, at, `${where} sortBy`, ['decimal', 'string']);
          }),
        ),
      );
    } else if (members) this.query(members, at, where);
  }

  private query(query: Query, at: L, where: string): void {
    const item = query.type === 'field' ? FIELD_ITEM : this.itemOf(this.contentTypeDef(query.type));
    this.typed({ item }, () =>
      this.withRoots(['item'], () => this.formula(query.where, at, where, BOOL)),
    );
  }

  /** Resolved by loadRuleset, so `where` may read only `item`, the field's view. */
  private fieldSet(where: Formula, at: L, label: string): void {
    const before = this.problems.length;
    const roots = ['item', ...this.extraRoots.filter((r) => r === 'pick' || r === 'slot')];
    this.typed({ item: FIELD_ITEM }, () =>
      this.at('query', () =>
        this.onlyRoots(roots, () => this.formula(where, at, `${label} fields`, BOOL)),
      ),
    );
    if (this.problems.length > before || readsOnlyRoots(where, new Set(roots))) return;
    this.problems.push({
      at,
      where: `${label} fields`,
      formula: where,
      code: 'unknown-name',
      message:
        "a set of fields is chosen by the field's view alone: it reads only `item` (and a choice effect's `pick` and `slot`)",
    });
  }

  /** Resolved by loadRuleset, so `where` may read only `item`. */
  private standardQuery(query: Query, at: L, where: string): void {
    const before = this.problems.length;
    this.at('query', () => this.query(query, at, where));
    if (this.problems.length > before || isContentOnly(query.where)) return;
    this.problems.push({
      at,
      where,
      formula: query.where as Formula,
      code: 'unknown-name',
      message: `${where.endsWith('keepsTemplates') ? "a kept template's query" : 'a standard copies query'} reads only \`item\``,
    });
  }

  /** Activation conditions: input fields only; in `where`, `item` is the candidate. */
  private immunity(def: Immunity, at: L, owner: string): void {
    const where = `${owner} immunity ${def.id}`;
    this.activation(() => {
      this.formula(def.when, at, where, BOOL);
      const query = def.query;
      if (!query) return;
      const type = this.contentTypeDef(query.type);
      this.typed({ item: this.itemOf(type), entry: entryType(type) }, () =>
        this.withRoots(['item', 'entry'], () =>
          this.formula(query.where, at, `${where} query`, BOOL),
        ),
      );
    });
  }

  private rollTypes(): Record<string, FType> {
    return {
      roll: EFFECT_ROLL,
      steps: 'dyn',
      flags: 'dyn',
      params: 'dyn',
      situational: this.situationalRoot(),
      participants: 'dyn',
      participant: 'dyn',
      action: actionType('dyn', 'dyn'),
    };
  }

  private effect(effect: Effect, at: L, where: string): void {
    const kind = targetKind(effect.target);
    if (kind === 'roll') {
      this.typed(this.rollTypes(), () =>
        this.withRoots(ROLL_ROOTS, () => this.effectBody(effect, at, where, kind)),
      );
    } else if (kind === 'choice') {
      // An option effect sees the action context, with the content's `item` and `self`, and the
      // action's as `action`; its `when` sees `picks` too.
      this.typed(this.optionTypes(), () =>
        this.withRoots(OPTION_ROOTS, () => this.effectBody(effect, at, where, kind)),
      );
    } else if (kind === 'step') {
      this.typed(
        {
          steps: 'dyn',
          flags: 'dyn',
          params: 'dyn',
          situational: this.situationalRoot(),
          action: actionType('dyn', 'dyn'),
          participants: 'dyn',
          participant: 'dyn',
        },
        () => this.withRoots(STEP_ROOTS, () => this.effectBody(effect, at, where, kind)),
      );
    } else if (kind === 'incoming') {
      this.typed({ incoming: INCOMING, situational: this.situationalRoot() }, () =>
        this.withRoots(['incoming', 'situational'], () => this.effectBody(effect, at, where, kind)),
      );
    } else {
      this.effectBody(effect, at, where, kind);
    }
  }

  private optionTypes(): Record<string, FType> {
    return {
      steps: 'dyn',
      flags: 'dyn',
      params: 'dyn',
      situational: this.situationalRoot(),
      action: actionType('dyn', 'dyn'),
      picks: 'int',
    };
  }

  private effectBody(
    effect: Effect,
    at: L,
    where: string,
    kind: 'field' | 'roll' | 'incoming' | 'choice' | 'step',
  ): void {
    const label = `${where} effect${effect.id ? ` ${effect.id}` : ''}`;
    if (typeof effect.target === 'string') {
      if (effect.op === 'grant') this.grantValue(effect.value as GrantValue, at, label);
    } else if ('fields' in effect.target) {
      this.fieldSet(effect.target.fields.where, at, label);
      if (effect.op === 'grant') this.grantValue(effect.value as GrantValue, at, label);
    } else if ('formula' in effect.target) {
      const formula = effect.target.formula as Formula;
      this.activation(() => this.formula(formula, at, `${label} target`, ['string']));
      if (effect.op === 'grant') this.grantValue(effect.value as GrantValue, at, label);
    } else if ('rolls' in effect.target) {
      this.tagList(effect.target.rolls, at, label);
      this.tagList(effect.target.parts, at, label);
    } else if ('incoming' in effect.target) {
      this.tagList(effect.target.incoming.tags, at, label);
    }
    if (effect.op === 'option') {
      // An added option's flags and changes see the pick as `picked` (`{ id }`), not `picks`.
      const value = effect.value as OptionValue;
      const target = effect.target;
      const tags = typeof target === 'object' && 'choices' in target ? target.choices : [];
      this.typed({ picked: pickedType({}) }, () =>
        this.onlyRoots([...this.extraRoots.filter((r) => r !== 'picks'), 'picked'], () => {
          for (const [name, formula] of Object.entries(value.flags ?? {}))
            this.optionFlag(tags, name, formula, at, label);
          for (const change of value.changes ?? []) this.proposedChange(change, at, label);
        }),
      );
    } else if (effect.op === 'changes') {
      for (const change of (effect.value as StepChanges).changes ?? [])
        this.proposedChange(change, at, label);
    } else if (effect.op === 'rollModifier') {
      const modifier = effect.value as RollModifier;
      for (const value of [modifier.below, modifier.factor, modifier.value, modifier.at])
        this.formula(value, at, label, NUMBER);
      this.formula(modifier.count, at, label, ['int']);
      this.formula(modifier.steps, at, label, ['int']);
      for (const face of modifier.faces ?? []) this.formula(face, at, label, ['int']);
    } else if (effect.op !== 'grant') {
      this.formula(effect.value as Formula, at, label, this.effectValueType(effect));
    }
    if (effect.tags && kind === 'roll') this.tagList(effect.tags, at, label);
    this.formula(effect.when, at, label, BOOL);
    this.formula(effect.duration?.amount, at, label, NUMBER);
    for (const then of effect.then ?? []) {
      this.formula(then.value, at, `${label} then`, ANY);
      this.formula(then.by, at, `${label} then`, NUMBER);
    }
  }

  private grantValue(value: GrantValue, at: L, where: string): void {
    if (value.query) this.query(value.query, at, where);
    this.formula(value.formula, at, where, ['string']);
  }

  private choices(choices: Choice[], at: L, owner: string): void {
    for (const choice of choices) {
      if (choice.slots)
        this.typed({ slot: 'int' }, () =>
          this.withRoots(['slot'], () => this.choice(choice, at, owner)),
        );
      else this.choice(choice, at, owner);
    }
  }

  private choice(choice: Choice, at: L, owner: string): void {
    const key = `${owner}.choices.${choice.id}`;
    const where = `choice ${key}`;
    this.activation(() => this.formula(choice.when, at, where, BOOL));
    this.ownChoice(() => this.formula(choice.recommend, at, where, ['string']));
    if (typeof choice.pick === 'object') {
      this.formula(choice.pick.min, at, where, ['int']);
      this.formula(choice.pick.max, at, where, ['int']);
    } else {
      this.formula(choice.pick, at, where, ['int']);
    }
    this.typed({ pick: PICK }, () =>
      this.withRoots(['pick'], () => {
        for (const effect of choice.effects ?? []) this.effect(effect, at, where);
      }),
    );
    const from = choice.from;
    if ('options' in from) this.inlineOptions(from.options, at, key);
    else if ('type' in from) {
      this.ownChoice(() => this.query(from, at, where));
      this.ownChoice(() =>
        this.typed({ item: this.itemOf(this.contentTypeDef(from.type)) }, () =>
          this.withRoots(['item'], () =>
            this.formula(choice.eligible, at, `${where} eligible`, BOOL),
          ),
        ),
      );
    } else if ('values' in from) this.ownChoice(() => this.valueOptions(from, at, where, choice));
    else
      this.ownChoice(() =>
        this.typed({ item: 'dyn' }, () =>
          this.withRoots(['item'], () =>
            this.formula(choice.eligible, at, `${where} eligible`, BOOL),
          ),
        ),
      );
  }

  private ownChoice<T>(fn: () => T): T {
    return this.typed({ choice: OWN_CHOICE }, () => this.withRoots(['choice'], fn));
  }

  private valueOptions(from: ValueOptions, at: L, where: string, choice?: Choice): void {
    let value: FType = 'dyn';
    if (Array.isArray(from.values)) value = writtenType(from.values);
    else {
      const formula = from.values.formula;
      this.formula(formula, at, `${where} values`, [{ list: 'string' }, { list: 'decimal' }]);
      const tree = formulaTree(formula);
      const type = tree.ok ? check(tree.value, this.checkContext()) : undefined;
      if (type?.ok && typeof type.value === 'object' && 'list' in type.value)
        value = type.value.list;
    }
    this.typed({ value }, () =>
      this.withRoots(['value'], () => {
        this.formula(from.where, at, `${where} where`, BOOL);
        this.formula(choice?.eligible, at, `${where} eligible`, BOOL);
      }),
    );
  }

  /** A grant's `when` and `state` are activation formulas: `self`, `item` and input fields. */
  private grant(grant: Grant, at: L, where: string): void {
    this.activation(() => {
      this.formula(grant.when, at, where, BOOL);
      if (typeof grant.item !== 'string')
        this.formula(grant.item.formula, at, `${where} item`, ['string']);
      for (const [key, value] of Object.entries(grant.state ?? {}))
        this.formula(value, at, `${where} state ${key}`, ANY);
      const presets = (tree: PresetTree | undefined) => {
        for (const [choice, picks] of Object.entries(tree ?? {}))
          for (const pick of picks) {
            if (typeof pick.option === 'object')
              this.formula(pick.option.formula, at, `${where} choices ${choice}`, [
                'string',
                'decimal',
              ]);
            presets(pick.choices);
          }
      };
      presets(grant.choices);
    });
  }

  private inlineOptions(options: InlineOption[], at: L, key: string): void {
    for (const option of options) {
      const owner = `${key}.options.${option.id}`;
      this.tagList(option.tags, at, owner);
      // An inline option owns its own choices.
      this.owned(choiceKeys(option.choices), () => {
        for (const effect of option.effects ?? []) this.effect(effect, at, owner);
        for (const grant of option.grants ?? []) this.grant(grant, at, owner);
        for (const prerequisite of option.prerequisites ?? [])
          this.formula(prerequisite.when, at, owner, BOOL);
        this.choices(option.choices ?? [], at, owner);
      });
    }
  }

  private actionOrUse(
    action: ActionOrUse,
    at: L,
    keyPrefix: string,
    ownerType?: string,
    ownComputed?: Record<string, ComputedDecl>,
  ): void {
    if ('use' in action) {
      for (const value of Object.values(action.params ?? {}))
        this.formula(value, at, `use ${action.use}`, ANY);
      return;
    }
    this.action(action, at, `${keyPrefix}.${action.id}`, ownerType, ownComputed);
  }

  private action(
    action: ActionDef,
    at: L,
    key: string,
    ownerType?: string,
    ownComputed?: Record<string, ComputedDecl>,
  ): void {
    const { steps, flags } = stepsAndFlags(action.steps, this.talliesRoot(), (step) =>
      this.choiceViews(step),
    );
    const typeName =
      ownerType ?? this.actionUserType(this.set.action(action.id, this.scope)?.qid ?? '');
    const typeDef = this.contentTypeDef(typeName);
    const own: { item: FType; self: FType } = typeDef
      ? {
          item: this.itemOf(typeDef),
          self:
            action.scope === 'applied'
              ? entryType(typeDef)
              : (revealComputed(withComputed(selfType(typeDef), ownComputed)) as FType),
        }
      : { item: 'dyn', self: 'dyn' };
    const types: Record<string, FType> = {
      params: this.paramsRoot(action, at, key),
      steps,
      flags,
      situational: this.situationalRoot(),
      participants: participantsType(action.participants),
      ...own,
      action: actionType(own.item, own.self),
    };
    // In an `each` step: `participant` is the role's view, `each` steps over the same role read as
    // one participant's result, and the step itself as its earlier runs.
    const each = (role: string, stepId: string): Record<string, FType> => ({
      participant: viewType(action.participants?.[role]?.fields ?? {}),
      steps: stepsAndFlags(
        action.steps,
        this.talliesRoot(),
        (step) => this.choiceViews(step),
        role,
        stepId,
      ).steps,
    });
    for (const [name, decl] of Object.entries(action.params ?? {})) {
      if (decl.type !== 'id' || decl.of === undefined || decl.of === 'field') continue;
      if (decl.where === undefined) continue;
      const actionRootType = actionType(own.item, own.self);
      this.typed({ item: this.itemOf(this.contentTypeDef(decl.of)), action: actionRootType }, () =>
        this.onlyRoots(['item', 'action'], () =>
          this.formula(decl.where, at, `${key} param ${name}`, BOOL),
        ),
      );
    }
    // Parameter bounds are evaluated as the action starts: no steps, flags or params yet.
    for (const [name, decl] of Object.entries(action.params ?? {}))
      this.typed({ ...own, situational: types.situational as FType }, () =>
        this.at('content', () =>
          this.onlyRoots(['situational'], () => {
            this.formula(decl.min, at, `${key} param ${name} min`, NUMBER);
            this.formula(decl.max, at, `${key} param ${name} max`, NUMBER);
          }),
        ),
      );
    this.typed(types, () => this.actionBody(action, at, key, each));
  }

  private paramsRoot(action: ActionDef, at: L, key: string): FType {
    const base = paramsType(action.params) as { object: Record<string, FType> };
    for (const [name, decl] of Object.entries(action.params ?? {})) {
      if (decl.type !== 'id' || decl.of !== 'field') continue;
      if (decl.where !== undefined)
        this.query({ type: 'field', where: decl.where }, at, `${key} param ${name}`);
      const types = new Set(
        this.fieldsMatching(decl.where).map((def) => JSON.stringify(fieldFormulaType(def.type))),
      );
      const value: FType =
        types.size === 1 ? (JSON.parse([...types][0] as string) as FType) : 'dyn';
      base.object[name] = { object: { ...FIELD_ITEM.object, value } };
    }
    return base;
  }

  fieldsMatching(where: Formula | undefined): FieldDef[] {
    return fieldsMatching(this.set, this.scope, where);
  }

  private actionBody(
    action: ActionDef,
    at: L,
    key: string,
    each: (role: string, own: string) => Record<string, FType>,
  ): void {
    this.formula(action.available, at, key, BOOL);
    this.tagList(action.tags, at, key);
    const walk = (steps: Step[]) => {
      for (const step of steps) {
        if (step.each === undefined) this.step(action, step, at, key, walk);
        else
          this.typed(each(step.each, step.id), () =>
            this.withRoots(['participant'], () => this.step(action, step, at, key, walk)),
          );
      }
    };
    walk(action.steps);
  }

  private step(
    action: ActionDef,
    step: Step,
    at: L,
    key: string,
    walk: (steps: Step[]) => void,
  ): void {
    const where = `${key} step ${step.id}`;
    this.formula(step.when, at, where, BOOL);
    this.tagList(step.tags, at, where);
    for (const part of step.parts ?? []) {
      this.tagList(part.tags, at, where);
      this.formula(part.dice, at, where, DICE);
      this.formula(part.ifEmpty, at, where, DICE);
      this.formula(part.value, at, where, NUMBER);
      this.formula(part.field, at, where, ['string']);
      this.formula(part.when, at, where, BOOL);
    }
    if (step.kind === 'choice') this.choiceStep(step, at, where);
    if (step.kind === 'allocate') this.allocateStep(step, at, where);
    if (step.kind === 'group') {
      this.formula(step.repeat?.while, at, where, BOOL);
      this.formula(step.repeat?.max, at, where, ['int']);
    }
    for (const arm of stepArms(step)) {
      if ('when' in arm) this.formula(arm.when as Formula, at, where, BOOL);
      for (const [name, value] of Object.entries(arm.flags ?? {}))
        this.flagFormula(name, value, at, where);
      walk(arm.steps ?? []);
    }
    const picked: Record<string, FType> =
      step.kind !== 'choice'
        ? {}
        : pendingSource(step)
          ? { picked: { object: { id: 'string', path: 'dyn' } } }
          : { picked: pickedType(this.choiceViews(step)) };
    const changes = [
      ...(step.kind === 'choice' ? writtenOptions(step).flatMap((o) => o.changes ?? []) : []),
      ...(step.changes ?? []),
    ];
    for (const change of changes) {
      this.typed(picked, () =>
        this.withRoots(Object.keys(picked), () => this.proposedChange(change, at, where)),
      );
    }
    if (step.release?.where !== undefined) {
      const condition = step.release.where;
      this.typed({ change: 'dyn' }, () =>
        this.withRoots(['change'], () => this.formula(condition, at, `${where} release`, BOOL)),
      );
    }
    if (step.kind === 'choice')
      this.typed(picked, () =>
        this.withRoots(Object.keys(picked), () => {
          for (const option of writtenOptions(step))
            for (const [name, value] of Object.entries(option.flags ?? {}))
              this.flagFormula(name, value, at, where);
        }),
      );
    // A `null` parameter is left out.
    for (const value of Object.values(step.params ?? {}))
      this.formula(value, at, where, ANY, step.kind === 'action');
    if (step.kind === 'action') {
      this.formula(step.source, at, where, ['string']);
      this.formula(step.entry, at, where, ['string']);
      for (const value of Object.values(step.participants ?? {}))
        this.formula(value, at, where, PARTICIPANT_LIST);
      for (const value of Object.values(step.situational ?? {}))
        this.formula(value, at, where, ANY);
    }
    this.formula(step.result, at, where, ['string']);
    this.declaredResult(action, step.result, at, where);
    for (const value of Object.values(step.data ?? {})) this.formula(value, at, where, ANY);
  }

  private choiceViews(step: Step): { item?: FType; self?: FType; value?: FType } {
    const values = valueSource(step);
    // A formula's element type would need the steps this builds, so it is `dyn` here.
    if (values) return { value: Array.isArray(values.values) ? writtenType(values.values) : 'dyn' };
    const query = optionQuery(step);
    if (!query) return {};
    const def = this.contentTypeDef(query.type);
    return query.source === 'copies'
      ? { item: this.itemOf(def), self: selfType(def) }
      : { item: this.itemOf(def) };
  }

  private choiceStep(step: Step, at: L, where: string): void {
    this.typed({ picks: 'int' }, () =>
      this.withRoots(['picks'], () => {
        for (const option of writtenOptions(step)) this.formula(option.when, at, where, BOOL);
      }),
    );
    const pending = pendingSource(step);
    this.formula(pending?.entry, at, where, ['string']);
    if (pending?.path && !Array.isArray(pending.path.choice))
      this.formula(pending.path.choice, at, where, [{ list: 'string' }]);
    if (pending?.path && typeof pending.path.entry === 'object')
      this.formula(pending.path.entry.formula, at, where, ['string']);
    this.typed({ options: { list: 'string' }, choice: PENDING_CHOICE }, () =>
      this.withRoots(pending ? ['options', 'choice'] : ['options'], () => {
        this.formula(step.recommend as Formula | undefined, at, where, ['string']);
        this.formula(step.random, at, where, BOOL);
      }),
    );
    this.formula(step.repeat?.max, at, where, ['int']);
    this.formula(step.repeat?.min, at, where, ['int']);
    const values = valueSource(step);
    if (values) {
      let value: FType = 'dyn';
      if (Array.isArray(values.values)) value = writtenType(values.values);
      else {
        const formula = values.values.formula;
        this.formula(formula, at, `${where} values`, [{ list: 'string' }, { list: 'decimal' }]);
        const tree = formulaTree(formula);
        const type = tree.ok ? check(tree.value, this.checkContext()) : undefined;
        if (type?.ok && typeof type.value === 'object' && 'list' in type.value)
          value = type.value.list;
      }
      this.typed({ value, picks: 'int' }, () =>
        this.withRoots(['value', 'picks'], () => {
          this.formula(values.where, at, `${where} where`, BOOL);
          this.formula(step.prefer, at, where, NUMBER);
        }),
      );
      return;
    }
    const query = optionQuery(step);
    if (!query) return;
    const views = this.choiceViews(step);
    this.typed({ ...views, picks: 'int' }, () =>
      this.at('candidate', () =>
        this.onlyRoots([...(query.source === 'copies' ? ['self'] : []), ...this.inEach()], () => {
          this.formula(query.where, at, where, BOOL);
          this.formula(step.prefer, at, where, NUMBER);
        }),
      ),
    );
  }

  private allocateStep(step: Step, at: L, where: string): void {
    const query = step.fields?.where;
    if (query !== undefined)
      this.typed({ item: FIELD_ITEM }, () =>
        this.withRoots(['item', 'action'], () => this.formula(query, at, where, BOOL)),
      );
    this.formula(step.budget, at, where, ['int']);
    this.formula(step.random, at, where, BOOL);
    for (const value of step.values ?? []) this.formula(value, at, where, ['int']);
    if (typeof step.recommend === 'object')
      for (const value of Object.values(step.recommend)) this.formula(value, at, where, ['int']);
    this.typed({ field: ALLOCATED_FIELD, amount: 'int' }, () => {
      this.withRoots(['field'], () => this.formula(step.limit, at, where, ['int']));
      this.withRoots(['field', 'amount'], () => this.formula(step.cost, at, where, ['int']));
    });
  }

  private followUp(def: FollowUp, at: L, where: string): void {
    const self = revealComputed(this.types.self);
    this.typed(self ? { self } : {}, () => this.followUpBody(def, at, where));
  }

  private followUpBody(def: FollowUp, at: L, where: string): void {
    this.formula(def.becomes, at, where, BOOL);
    this.formula(def.while, at, where, BOOL);
    this.typed({ change: CHANGE }, () =>
      this.withRoots(def.on ? ['change'] : [], () => {
        this.formula(def.when, at, where, BOOL);
        for (const value of Object.values(def.params ?? {}))
          this.formula(value, at, where, ANY, true);
        // A linked character's start parameters.
        for (const value of Object.values(def.create?.params ?? {}))
          this.formula(value, at, where, ANY, true);
        for (const change of def.changes ?? [])
          this.forEach(change.forEach, at, where, () => {
            this.tagList(change.tags, at, where);
            this.formula(change.when, at, where, BOOL);
            this.computedField(change, at, where);
            this.formula(change.equipped, at, where, BOOL);
            this.formula(change.template, at, where, ['string']);
            if (typeof change.entry === 'object' && 'formula' in change.entry)
              this.formula(change.entry.formula, at, where, ['string']);
            else if (typeof change.entry === 'object') {
              this.formula(change.entry.item, at, where, ['string']);
              this.formula(change.entry.quantity, at, where, ['int']);
              this.formula(change.entry.equipped, at, where, BOOL);
              this.pickFormulas(change.entry.choices, at, where);
              for (const value of Object.values(change.entry.state ?? {}))
                this.formula(value, at, where, ANY);
            }
            this.appliedContent(change, at, where);
            const perCopy = (fm: Formula | undefined) =>
              (change.copies !== undefined ||
                change.applied !== undefined ||
                change.picks !== undefined ||
                change.grants !== undefined) &&
              fm !== undefined &&
              readsCopy(fm);
            const value: Expect = change.type === 'setQuantity' ? ['int'] : ANY;
            const by: Expect = change.type === 'adjustQuantity' ? ['int'] : NUMBER;
            if (change.copies) {
              const typeDef = this.contentTypeDef(change.copies.type);
              this.typed(
                { item: this.itemOf(typeDef), self: selfType(typeDef), batch: BATCH },
                () =>
                  this.at('content', () =>
                    this.onlyRoots(['batch'], () => {
                      this.formula(change.copies?.where, at, where, BOOL);
                      if (perCopy(change.value)) this.formula(change.value, at, where, value);
                      if (perCopy(change.by)) this.formula(change.by, at, where, by);
                    }),
                  ),
              );
            }
            if (change.applied || change.picks || change.grants) {
              const query = (change.applied ?? change.picks ?? change.grants)?.where as Formula;
              this.typed({ item: 'dyn', self: entryType(undefined), batch: BATCH }, () =>
                this.at('content', () =>
                  this.onlyRoots(['batch'], () => {
                    this.formula(query, at, where, BOOL);
                    if (perCopy(change.value)) this.formula(change.value, at, where, value);
                    if (perCopy(change.by)) this.formula(change.by, at, where, by);
                  }),
                ),
              );
            }
            if (!perCopy(change.value)) this.formula(change.value, at, where, value);
            if (!perCopy(change.by)) this.formula(change.by, at, where, by);
          });
      }),
    );
  }

  /** The formulas a change passes on bind their own roots, so they don't see `x`. */
  private forEach(formula: Formula | undefined, at: L, where: string, fn: () => void): void {
    if (formula === undefined) return fn();
    this.formula(formula, at, where, [{ list: 'dyn' }]);
    const tree = formulaTree(formula);
    const type = tree.ok ? check(tree.value, this.checkContext()) : undefined;
    const element: FType =
      type?.ok && typeof type.value === 'object' && 'list' in type.value ? type.value.list : 'dyn';
    this.typed({ x: element }, () => this.withRoots(['x'], fn));
  }

  private computedField(change: ProposedChange, at: L, where: string): void {
    if (typeof change.field !== 'object') return;
    this.formula(change.field.formula, at, where, ['string']);
    if (change.split)
      this.problems.push({
        at,
        where,
        formula: change.field.formula,
        code: 'type-mismatch',
        message: "a split adjust's field is written out, not computed",
      });
  }

  /**
   * Each computed value reads only those declared before it. `before` is the content type's: a
   * name an item or template redeclares keeps its place.
   */
  private computed(
    decls: Record<string, ComputedDecl> | undefined,
    at: L,
    owner: string,
    before?: Record<string, ComputedDecl>,
  ): void {
    const order = Object.keys(before ?? {});
    for (const name of Object.keys(decls ?? {})) if (!order.includes(name)) order.push(name);
    for (const [name, decl] of Object.entries(decls ?? {})) {
      const earlier = order.slice(0, order.indexOf(name));
      this.typed({ self: revealComputed(this.types.self, earlier) as FType }, () =>
        this.formula(decl.formula, at, `${owner} computed ${name}`, [fieldFormulaType(decl.type)]),
      );
    }
  }

  private appliedContent(change: ProposedChange, at: L, where: string, passed?: string[]): void {
    this.formula(change.source, at, where, ['string']);
    this.formula(change.active, at, where, BOOL);
    for (const value of Object.values(change.state ?? {})) {
      if (!readsRoot(value, ['batch'])) {
        this.formula(value, at, where, ANY);
        continue;
      }
      this.typed({ item: 'dyn', batch: BATCH }, () =>
        this.at('content', () =>
          this.onlyRoots([...(passed ?? []), 'item', 'batch'], () =>
            passed ? this.passedOn(value, at, where, ANY) : this.formula(value, at, where, ANY),
          ),
        ),
      );
    }
  }

  private pickFormulas(tree: Record<string, unknown> | undefined, at: L, where: string): void {
    for (const list of Object.values(tree ?? {}))
      for (const pick of list as { option: unknown; choices?: Record<string, unknown> }[]) {
        if (pick.option !== null && typeof pick.option === 'object')
          this.formula((pick.option as { formula: Formula }).formula, at, where, [
            'string',
            'decimal',
          ]);
        this.pickFormulas(pick.choices, at, where);
      }
  }

  private proposedChange(change: ProposedChange, at: L, where: string): void {
    this.forEach(change.forEach, at, where, () => this.proposedChangeBody(change, at, where));
  }

  private proposedChangeBody(change: ProposedChange, at: L, where: string): void {
    this.tagList(change.tags, at, where);
    this.formula(change.when, at, where, BOOL);
    this.computedField(change, at, where);
    if (change.path && !Array.isArray(change.path.choice))
      this.formula(change.path.choice, at, where, [{ list: 'string' }]);
    if (change.path && typeof change.path.entry === 'object')
      this.formula(change.path.entry.formula, at, where, ['string']);
    this.formula(change.option, at, where, ['string']);
    this.formula(change.equipped, at, where, BOOL);
    this.formula(change.template, at, where, ['string']);
    for (const value of Object.values(change.params ?? {})) this.formula(value, at, where, ANY);
    if (typeof change.entry === 'object' && 'formula' in change.entry)
      this.formula(change.entry.formula, at, where, ['string']);
    else if (typeof change.entry === 'object') {
      this.formula(change.entry.item, at, where, ['string']);
      this.formula(change.entry.quantity, at, where, ['int']);
      this.formula(change.entry.equipped, at, where, BOOL);
      this.pickFormulas(change.entry.choices, at, where);
      for (const value of Object.values(change.entry.state ?? {}))
        this.formula(value, at, where, ANY);
    }
    // `where` and formulas reading `self` or `item` are evaluated per copy by applyChanges.
    const perCopy = (fm: Formula | undefined) =>
      change.copies !== undefined && fm !== undefined && readsCopy(fm);
    const value: Expect = change.type === 'setQuantity' ? ['int'] : ANY;
    const by: Expect = change.type === 'adjustQuantity' ? ['int'] : NUMBER;
    if (change.copies) {
      const def = this.contentTypeDef(change.copies.type);
      // They may also read `steps`, `flags`, `params` and `action`, substituted by the action as
      // literals, so a path to a map is a type mismatch. No other action root is passed on.
      this.typed({ item: this.itemOf(def), self: selfType(def), batch: BATCH }, () =>
        this.at('content', () =>
          this.onlyRoots([...PASSED_ROOTS, ...this.inEach(), 'batch'], () => {
            this.passedOn(change.copies?.where, at, where, BOOL);
            if (perCopy(change.value)) this.passedOn(change.value, at, where, value);
            if (perCopy(change.by)) this.passedOn(change.by, at, where, by);
          }),
        ),
      );
    }
    this.appliedContent(change, at, where, [...PASSED_ROOTS, ...this.inEach()]);
    const applied = change.applied ?? change.picks ?? change.grants;
    if (applied) {
      this.typed({ item: 'dyn', self: entryType(undefined), batch: BATCH }, () =>
        this.at('content', () =>
          this.onlyRoots([...PASSED_ROOTS, ...this.inEach(), 'batch'], () => {
            this.passedOn(applied.where, at, where, BOOL);
            if (change.value !== undefined && readsCopy(change.value))
              this.passedOn(change.value, at, where, value);
            if (change.by !== undefined && readsCopy(change.by))
              this.passedOn(change.by, at, where, by);
          }),
        ),
      );
    }
    const perEntry = (fm: Formula | undefined) =>
      perCopy(fm) || (applied !== undefined && fm !== undefined && readsCopy(fm));
    this.typed({ part: PART }, () =>
      this.withRoots(change.split ? ['part'] : [], () => {
        if (!perEntry(change.value)) this.formula(change.value, at, where, value);
        if (!perEntry(change.by)) this.formula(change.by, at, where, by);
      }),
    );
  }

  /** A literal result must be declared: listed, or a band of its band set. */
  private declaredResult(action: ActionDef, result: Formula | undefined, at: L, where: string) {
    if (result === undefined || action.results === undefined) return;
    const tree = formulaTree(result);
    if (!tree.ok || tree.value.type !== 'string') return;
    const value = tree.value.value;
    const declared = Array.isArray(action.results)
      ? action.results
      : (this.set.bands(action.results.bands, this.scope)?.def.bands ?? []).map((band) => band.id);
    if (declared.includes(value)) return;
    this.problems.push({
      at,
      where,
      formula: result,
      code: 'undeclared-result',
      message: `the action does not declare the result "${value}"`,
    });
  }

  private place: Place = 'field';
  private readonly extraRoots: string[] = [];

  private at<T>(place: Place, fn: () => T): T {
    const previous = this.place;
    this.place = place;
    try {
      return fn();
    } finally {
      this.place = previous;
    }
  }

  /** Activation conditions and item fields: evaluated before effects, so input fields only. */
  private inputOnly = false;

  private activation<T>(fn: () => T): T {
    const previous = this.inputOnly;
    this.inputOnly = true;
    try {
      return fn();
    } finally {
      this.inputOnly = previous;
    }
  }

  private types: Record<string, FType> = { character: CHARACTER };

  private typed<T>(types: Record<string, FType>, fn: () => T): T {
    const previous = this.types;
    this.types = { ...previous, ...types };
    try {
      return fn();
    } finally {
      this.types = previous;
    }
  }

  private inEach(): string[] {
    return this.extraRoots.includes('participant') ? ['participant'] : [];
  }

  private onlyRoots<T>(roots: string[], fn: () => T): T {
    const previous = this.extraRoots.splice(0, this.extraRoots.length, ...roots);
    try {
      return fn();
    } finally {
      this.extraRoots.splice(0, this.extraRoots.length, ...previous);
    }
  }

  private withRoots<T>(roots: string[], fn: () => T): T {
    this.extraRoots.push(...roots);
    try {
      return fn();
    } finally {
      this.extraRoots.splice(this.extraRoots.length - roots.length, roots.length);
    }
  }

  private itemOf(type: ContentTypeDef | undefined): FType {
    let item = this.itemTypes.get(type);
    if (!item) this.itemTypes.set(type, (item = itemType(type, this.templateFields)));
    return item;
  }
  private readonly itemTypes = new Map<ContentTypeDef | undefined, FType>();

  private get templateFields(): Record<string, ValueDecl> {
    this.templateFieldDecls ??= Object.fromEntries(
      [...this.set.templateFields(this.scope)].map(([name, { def }]) => [name, def]),
    );
    return this.templateFieldDecls;
  }
  private templateFieldDecls: Record<string, ValueDecl> | undefined;

  private contentTypeDef(name: string | undefined): ContentTypeDef | undefined {
    return name ? this.set.contentType(name, this.scope)?.def : undefined;
  }

  private talliesRoot(): FType {
    return talliesType(
      this.scope.flatMap((pid) => [...(this.set.rules.get(pid)?.tallies.keys() ?? [])]),
    );
  }

  private linksRoot(): FType {
    return linksType(
      this.scope.flatMap((pid) =>
        [...(this.set.rules.get(pid)?.links ?? [])].map(
          ([name, { def }]) => [name, def.fields] as [string, typeof def.fields],
        ),
      ),
    );
  }

  private situationalRoot(): FType {
    return situationalType(
      this.scope.flatMap((pid) =>
        [...(this.set.rules.get(pid)?.situational.values() ?? [])].map((l) => l.def),
      ),
    );
  }

  private actionUserType(qid: string): string | undefined {
    const users = new Set<string>();
    for (const pid of this.scope) {
      for (const [name, { def }] of this.set.rules.get(pid)?.contentTypes ?? []) {
        if (
          (def.actions ?? []).some(
            (a) => 'use' in a && this.set.action(a.use, this.scope)?.qid === qid,
          )
        )
          users.add(name);
        // Used by an applied entry: its `self` isn't a copy, so `dyn`.
        if (
          (def.actions ?? []).some(
            (a) =>
              'use' in a &&
              a.scope === 'applied' &&
              this.set.action(a.use, this.scope)?.qid === qid,
          )
        )
          users.add('#applied');
      }
    }
    for (const entry of this.set.content.values()) {
      const uses = (entry.item.actions ?? []).filter(
        (a) => 'use' in a && this.set.action(a.use, this.set.scope(entry.pack))?.qid === qid,
      );
      if (uses.length > 0) users.add(this.set.typeOf(entry) ?? '?');
      if (uses.some((a) => a.scope === 'applied')) users.add('#applied');
    }
    return users.size === 1 ? [...users][0] : undefined;
  }

  private flagRecord: Map<string, FType[]> | undefined;

  private flagFormula(name: string, formula: Formula, at: L, where: string): void {
    this.formula(formula, at, where, ANY);
    if (!this.flagRecord) return;
    const tree = formulaTree(formula);
    const type = tree.ok ? check(tree.value, this.checkContext()) : undefined;
    const types = this.flagRecord.get(name) ?? [];
    types.push(type?.ok ? type.value : 'dyn');
    this.flagRecord.set(name, types);
  }

  /**
   * A flag an added option sets must be set elsewhere, with a matching type, by every action in
   * scope whose choice step the option reaches.
   */
  private optionFlag(tags: string[], name: string, formula: Formula, at: L, where: string): void {
    const declared: FType[] = [];
    for (const target of this.optionTargets(tags)) {
      const types = actionFlagTypes(this.set, target).get(name);
      if (!types) {
        this.problems.push({
          at,
          where,
          formula,
          code: 'unknown-name',
          message: `${target.key} doesn't set the flag "${name}"; an option sets only flags its action sets elsewhere`,
        });
        return;
      }
      declared.push(...types);
    }
    const open = declared.length === 0 || declared.some((t) => t === 'dyn');
    this.formula(formula, at, where, open ? ANY : declared);
  }

  private optionTargets(tags: string[]): ActionTarget<L>[] {
    const memo = JSON.stringify(tags);
    const known = this.targetsByTags.get(memo);
    if (known) return known;
    const out: ActionTarget<L>[] = [];
    this.targetsByTags.set(memo, out);
    const add = (def: ActionOrUse, pack: string, at: L, key: string, ownerType?: string) => {
      if ('use' in def || !reachesChoice(def.steps, tags)) return;
      out.push({ def, pack, at, key, ...(ownerType !== undefined ? { ownerType } : {}) });
    };
    for (const pid of this.scope) {
      const rules = this.set.rules.get(pid);
      for (const [, { def, at }] of rules?.actions ?? []) add(def, pid, at, `actions.${def.id}`);
      for (const [name, { def, at }] of rules?.contentTypes ?? [])
        for (const action of def.actions ?? [])
          add(action, pid, at, `types.${name}.${actionKey(action)}`, name);
      for (const { doc, at } of this.set.packContent.get(pid) ?? [])
        for (const action of doc.actions ?? [])
          add(
            action,
            pid,
            at,
            `${doc.id ?? doc.override ?? '?'}.actions.${actionKey(action)}`,
            doc.type ?? this.typeOfParent(doc),
          );
    }
    return out;
  }

  static flagTypesOf<L>(set: PackSet<L>, target: ActionTarget<L>): Map<string, FType[]> {
    const checker = new FormulaChecker(set, target.pack, {});
    const record = new Map<string, FType[]>();
    checker.flagRecord = record;
    checker.at('action', () => checker.action(target.def, target.at, target.key, target.ownerType));
    return record;
  }

  private typeOfParent(doc: ContentItem): string | undefined {
    const ref = doc.override ?? doc.extends;
    const target = ref ? this.set.item(ref, this.scope) : undefined;
    return target ? this.set.typeOf(target) : undefined;
  }

  private choicesBound = false;

  /** The choice keys `picksOf` may name: unbound without an owner; any when known only later. */
  private ownerChoices: readonly string[] | typeof ANY_CHOICE | undefined;

  private owned<T>(choices: readonly string[] | typeof ANY_CHOICE, fn: () => T): T {
    const previous = this.ownerChoices;
    this.ownerChoices = choices;
    try {
      return fn();
    } finally {
      this.ownerChoices = previous;
    }
  }

  /** A literal `picksOf` argument must name a choice of the formula's owner. */
  private ownerPicks(formula: Formula, at: L, where: string): void {
    const choices = this.ownerChoices;
    if (!Array.isArray(choices)) return;
    const tree = formulaTree(formula);
    if (!tree.ok) return;
    const visit = (node: Node): void => {
      if (node.type === 'call' && node.fn === 'picksOf' && node.args.length === 1) {
        const [arg] = node.args;
        if (arg?.type === 'string' && !choices.includes(arg.value))
          this.problems.push({
            at,
            where,
            formula,
            code: 'unknown-reference',
            message: `picksOf('${arg.value}') names no choice of the formula's owner (${choices.join(', ') || 'none'})`,
          });
      }
      for (const child of children(node)) visit(child);
    };
    visit(tree.value);
  }

  /**
   * `picksOf(content, choice)` and `grantedPicksOf(content, choice)` name content the pack sees and
   * one of its choices.
   */
  private contentChoices(formula: Formula, at: L, where: string): void {
    const tree = formulaTree(formula);
    if (!tree.ok) return;
    const visit = (node: Node): void => {
      if (
        node.type === 'call' &&
        (node.fn === 'grantedPicksOf' || node.fn === 'picksOf') &&
        node.args.length === 2
      ) {
        const [content, choice] = node.args;
        if (content?.type === 'string' && choice?.type === 'string') {
          const entry = this.set.item(content.value, this.scope);
          const doc = entry?.item;
          const problem = !entry
            ? `${node.fn}('${content.value}', …) names no content visible from the pack`
            : doc?.override || doc?.extends || choiceKeys(doc?.choices).includes(choice.value)
              ? undefined
              : `${node.fn}('${content.value}', '${choice.value}') names no choice of that content (${choiceKeys(doc?.choices).join(', ') || 'none'})`;
          if (problem)
            this.problems.push({ at, where, formula, code: 'unknown-reference', message: problem });
        }
      }
      for (const child of children(node)) visit(child);
    };
    visit(tree.value);
  }

  /**
   * `itemField(id, name)` names an item field some content type the pack sees (or the template
   * fields) declares; a literal ID names content the pack sees, whose type declares it.
   */
  private contentItems(formula: Formula, at: L, where: string): void {
    const tree = formulaTree(formula);
    if (!tree.ok) return;
    const problem = (message: string) =>
      this.problems.push({ at, where, formula, code: 'unknown-reference', message });
    const declares = (type: string | undefined, name: string, scope: string[]) => {
      if (type !== undefined && type !== 'template')
        return this.set.contentType(type, scope)?.def.fields?.[name] !== undefined;
      return (
        this.set.templateFields(scope).has(name) ||
        scope.some((pid) =>
          [...(this.set.rules.get(pid)?.contentTypes.values() ?? [])].some(
            (t) => t.def.fields?.[name] !== undefined,
          ),
        )
      );
    };
    const visit = (node: Node): void => {
      if (node.type === 'call' && (node.fn === 'itemField' || node.fn === 'itemTags')) {
        const [id, name] = node.args;
        const entry = id?.type === 'string' ? this.set.item(id.value, this.scope) : undefined;
        if (id?.type === 'string' && !entry)
          problem(`${node.fn}('${id.value}', …) names no content visible from the pack`);
        if (node.fn === 'itemField' && name?.type === 'string') {
          const type = entry ? this.set.typeOf(entry) : undefined;
          const scope = entry ? this.set.scope(entry.pack) : this.scope;
          if (!declares(type, name.value, scope))
            problem(
              entry
                ? `itemField('${entry.qid}', '${name.value}'): its content type declares no item field "${name.value}"`
                : `itemField(…, '${name.value}'): no content type declares an item field "${name.value}"`,
            );
        }
      }
      for (const child of children(node)) visit(child);
    };
    visit(tree.value);
  }

  private showWhen(formula: Formula | undefined, at: L, where: string): void {
    if (formula === undefined) return;
    this.choicesBound = true;
    try {
      this.formula(formula, at, where, BOOL);
    } finally {
      this.choicesBound = false;
    }
    const tree = formulaTree(formula);
    if (!tree.ok) return;
    const visit = (node: Node): void => {
      if (node.type === 'call' && node.fn === 'hasChoice') {
        const [arg] = node.args;
        if (arg?.type === 'string' && !this.set.contentType(arg.value, this.scope))
          this.problems.push({
            at,
            where,
            formula,
            code: 'unknown-reference',
            message: `hasChoice('${arg.value}') names no content type visible from the pack`,
          });
      }
      for (const child of children(node)) visit(child);
    };
    visit(tree.value);
  }

  private checkContext(): CheckContext {
    return {
      field: (id) => {
        const field = this.set.field(id, this.scope);
        if (!field || (this.inputOnly && !field.def.input)) return undefined;
        return fieldFormulaType(field.def.type);
      },
      roots: new Set([...rootsFor(this.place), ...this.extraRoots]),
      rootTypes: this.types,
      character: this.place !== 'itemField' && this.place !== 'query',
      ...(this.inputOnly ? { activation: true } : {}),
      ...(this.choicesBound ? { choices: true } : {}),
      ...(this.ownerChoices !== undefined && this.place !== 'itemField' && this.place !== 'query'
        ? { picks: true }
        : {}),
      family: (name) => this.set.family(name, this.scope),
      id: (text) =>
        this.set.item(text, this.scope) !== undefined ||
        this.set.field(text, this.scope) !== undefined ||
        this.set.contentType(text, this.scope) !== undefined ||
        this.set.action(text, this.scope) !== undefined ||
        this.set.link(text, this.scope) !== undefined ||
        (text.includes(':') && !this.set.manifests.has(text.slice(0, text.indexOf(':')))),
    };
  }

  /** Paths at `steps`, `flags` or `params` need a literal form: the action substitutes them. */
  private passedOn(formula: Formula | undefined, at: L, where: string, expect: Expect): void {
    if (formula === undefined) return;
    const before = this.problems.length;
    this.formula(formula, at, where, expect);
    if (this.problems.length > before) return;
    const tree = formulaTree(formula);
    if (!tree.ok) return;
    const ctx = this.checkContext();
    const maps: string[] = [];
    const visitPath = (path: Node) => {
      const type = check(path, ctx);
      if (type.ok && !hasLiteral(type.value)) maps.push(print(path));
      return path;
    };
    replaceRooted(tree.value, new Set(PASSED_ROOTS), { path: visitPath, has: (path) => path });
    for (const path of maps) {
      this.problems.push({
        at,
        where,
        formula,
        code: 'type-mismatch',
        message: `"${path}" is a map, which a change can't pass on; read a member`,
      });
    }
  }

  private formula(
    formula: Formula | undefined,
    at: L,
    where: string,
    expect: Expect,
    nullable = false,
  ): void {
    if (formula === undefined) return;
    if (typeof formula === 'string') this.options.onFormula?.(formula, at, where);
    const context = this.checkContext();
    const problem = checkFormula(formula, nullable ? { ...context, nullable } : context, expect);
    if (!problem) {
      if (context.picks) this.ownerPicks(formula, at, where);
      this.contentChoices(formula, at, where);
      this.contentItems(formula, at, where);
      return;
    }
    const hint =
      this.inputOnly && problem.code === 'unknown-name'
        ? ' (activation conditions and item fields can read only input fields)'
        : '';
    this.problems.push({ at, where, formula, code: problem.code, message: problem.message + hint });
  }

  private effectValueType(effect: Effect): Expect {
    if (typeof effect.target !== 'string') {
      if ('fields' in effect.target) return NUMBER;
      // The field is known only on the sheet.
      if ('formula' in effect.target)
        return effect.op === 'set' ? ANY : effect.op === 'add' ? ['dice', 'decimal'] : NUMBER;
      if ('rolls' in effect.target && effect.target.tally !== undefined) return ['int'];
      // A roll's `add`, and a `set` replacing a part, may be dice.
      if ('rolls' in effect.target)
        return effect.op === 'add' || effect.op === 'set' ? DICE : ['int'];
      return effect.op === 'add' ? ['dice', 'decimal'] : NUMBER;
    }
    if (effect.op === 'multiply') return NUMBER;
    const field = this.set.field(effect.target, this.scope);
    return field ? [fieldFormulaType(field.def.type)] : ANY;
  }
}

/** Fields visible in a scope whose view (`id`, `type`, `tags`) matches `where`. */
export function fieldsMatching<L>(
  set: PackSet<L>,
  scope: string[],
  where: Formula | undefined,
  /** Keep a field whose `where` can't be decided from its view alone (it reads the action). */
  undecided = false,
): FieldDef[] {
  const out: FieldDef[] = [];
  const tree = where === undefined ? undefined : formulaTree(where);
  for (const pid of scope) {
    for (const [id, { def }] of set.rules.get(pid)?.fields ?? []) {
      if (!tree) {
        out.push(def);
        continue;
      }
      if (!tree.ok) return out;
      // A field whose tags are computed may match on some sheet: kept.
      const tags = def.tags ?? [];
      if (tags.some((t) => typeof t !== 'string')) {
        out.push(def);
        continue;
      }
      const result = evaluate(tree.value, {
        field: () => undefined,
        roots: { item: { id: `${pid}:${id}`, type: def.type, tags } },
      });
      if (result.ok ? result.value.kind === 'bool' && result.value.value : undecided) out.push(def);
    }
  }
  return out;
}

/** Formats a problem the way the build reports it. */
export function describeProblem<L>(problem: FormulaProblem<L>): string {
  return `${problem.where}: formula ${JSON.stringify(problem.formula)}: ${problem.code}: ${problem.message}`;
}

/** Written values' type: `string`, `int` or `decimal` when they all are, else `dyn`. */
function writtenType(values: readonly (string | number)[]): FType {
  if (values.every((v) => typeof v === 'string')) return 'string';
  if (values.every((v) => Number.isInteger(v))) return 'int';
  if (values.every((v) => typeof v === 'number')) return 'decimal';
  return 'dyn';
}

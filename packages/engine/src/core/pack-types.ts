export type Formula = string | number | boolean;
export type TagOrFormula = string | { formula: Formula };
export type Literal = string | number | boolean | (string | number | boolean)[];

export interface PackManifest {
  id: string;
  version: string;
  specVersion: string;
  license: string;
  credit?: string;
  notices?: Record<string, string>;
  defaultLanguage: string;
  dependencies?: Record<string, string>;
  hides?: string[];
}

export interface TagMembers {
  under?: string[];
  tags?: string[];
  except?: string[];
}

export interface ValueDecl {
  type: string;
  values?: string[];
  of?: string;
  members?: TagMembers;
  /** Loaded: the declared tags `members` admits, sorted. */
  tagOptions?: string[];
  required?: boolean;
  optional?: boolean;
  default?: Literal;
  min?: Formula;
  max?: Formula;
  where?: Formula;
  label?: string;
}

export interface ComputedDecl {
  type: 'integer' | 'decimal' | 'boolean' | 'string';
  formula: Formula;
}

export interface Overflow {
  at: 'max' | 'min';
  inclusive?: boolean;
  into: string;
  by?: Formula;
  reset: Formula;
  /** The excess past the bound carries over into the field after the reset. */
  carry?: boolean;
  tags?: string[];
}

export interface FieldDef extends ValueDecl {
  input?: boolean;
  limits?: { min?: Formula; max?: Formula };
  rounding?: 'floor' | 'ceil' | 'round' | 'truncate';
  recommend?: Recommend;
  formula?: Formula;
  tags?: TagOrFormula[];
  absorbedBy?: string[];
  overflow?: Overflow[];
  /** A string field whose value names this one, the `{name}` of its text. */
  nameFrom?: string;
}

export interface Query {
  type: string;
  where?: Formula;
}

export interface GrantValue {
  item?: string;
  tag?: string;
  field?: string;
  query?: Query;
  formula?: Formula;
}

export interface RollModifier {
  kind: string;
  count?: Formula;
  part?: string;
  below?: Formula;
  factor?: Formula;
  value?: Formula;
  at?: Formula;
  steps?: Formula;
  faces?: Formula[];
  of?: 'die' | 'roll';
}

export type EffectTarget =
  | string
  | { fields: { where: Formula } }
  | { rolls: string[]; from?: string; tally?: string; parts?: string[] }
  | { incoming: { fields?: string[]; tags?: string[] } }
  | { choices: string[]; from?: string }
  | { steps: string[]; from?: string };

export interface StepChanges {
  changes: ProposedChange[];
  /** Default: the step's `to`. */
  to?: Destination;
}

export interface OptionValue {
  id: string;
  /** Without changes, the pick is only recorded. */
  changes?: ProposedChange[];
  to?: Destination;
  /** Flags set when picked, before the changes. */
  flags?: Record<string, Formula>;
}

export type ThenChange =
  | { type: 'setState' | 'adjustState'; entry: 'self'; key: string; value?: Formula; by?: Formula }
  | { type: 'removeEffect'; entry: 'self'; key?: undefined; value?: undefined; by?: undefined };

/** The actor, another character the app picks, an action role, or a link slot's character. */
export type Destination = string | { link: string };

export interface Effect {
  id?: string;
  target: EffectTarget;
  op: string;
  value?: Formula | GrantValue | RollModifier | OptionValue | StepChanges;
  when?: Formula;
  stackKey?: string;
  rounding?: 'floor' | 'ceil' | 'round' | 'truncate';
  tags?: TagOrFormula[];
  multiplied?: boolean;
  scope?: 'holder' | 'applied';
  duration?: { amount?: Formula; unit: string };
  then?: ThenChange[];
}

export interface InlineOption {
  id: string;
  tags?: string[];
  prerequisites?: Prerequisite[];
  effects?: Effect[];
  grants?: Grant[];
  choices?: Choice[];
}

export interface Choice {
  id: string;
  /** One choice per slot, keyed `<id>-<slot>`, with `slot` bound. */
  slots?: number[];
  unique?: string;
  /** Where the group holds: the character (default) or the owner activation. */
  uniqueScope?: 'character' | 'owner';
  required?: boolean;
  pick?: Formula | { min?: Formula; max?: Formula };
  from: Query | { items: string[] } | ValueOptions | { options: InlineOption[] };
  when?: Formula;
  recommend?: Formula;
  effects?: Effect[];
  /** Content choices: `false` keeps the picks inactive, references only. */
  activate?: boolean;
  prompt?: string;
  eligible?: Formula;
  waivePrerequisites?: boolean;
  /** Its owner is ineligible while it has no eligible option. */
  requiresOption?: boolean;
}

export interface ValueOptions {
  values: (string | number)[] | { formula: Formula };
  where?: Formula;
}

/**
 * What the rules call for on the character: a moment (`on` or `becomes`), stored when a batch
 * triggers it, or a standing offer (`while`), derived; an `action` or `changes`.
 */
export interface FollowUp {
  id: string;
  on?: { field: string; tags?: string[]; once?: boolean };
  becomes?: Formula;
  while?: Formula;
  when?: Formula;
  /** Advisory: dismissing it needs an override. */
  required?: boolean;
  to?: 'self' | { link: string };
  action?: string;
  params?: Record<string, Formula>;
  changes?: ProposedChange[];
  /** After loading, `link` is the qualified slot and `start` is `<pack>:<id>`. */
  create?: { link: string; start: string; params?: Record<string, Formula> };
}

export interface Grant {
  item: string | { formula: Formula };
  when?: Formula;
  scope?: 'holder' | 'applied';
  waivePrerequisites?: boolean;
  /** Values the granted content sees as `self.<key>`, each an activation formula. */
  state?: Record<string, Formula>;
  /** Holder grants: picks made for the granted content's choices. */
  choices?: PresetTree;
}

/** A grant's preset picks, keyed by bare choice IDs; an option is a literal or `{ formula }`. */
export type PresetTree = Record<
  string,
  { option: string | number | { formula: Formula }; choices?: PresetTree }[]
>;

export interface KeptTemplate {
  template: string;
  /** Exactly one of `copies` and `content`. */
  copies?: Query;
  content?: Query;
  when?: Formula;
  scope?: 'holder' | 'applied';
  /** Values for the template's `params`: activation formulas with the keeper's roots. */
  params?: Record<string, Formula>;
}

export interface Reapply {
  match?: string[];
  state: Record<string, 'highest' | 'lowest' | 'add' | 'replace'>;
}

export interface Immunity {
  id: string;
  items?: string[];
  query?: Query;
  when?: Formula;
  scope?: 'holder' | 'applied';
}

export interface Prerequisite {
  id: string;
  when: Formula;
}

export interface RollPart {
  source?: { type: string; id?: string; entry?: string };
  id?: string;
  ifEmpty?: Formula;
  tags?: TagOrFormula[];
  dice?: Formula;
  value?: Formula;
  field?: Formula;
  when?: Formula;
  multiplied?: false;
}

export interface Step {
  id: string;
  kind: string;
  when?: Formula;
  sheet?: 'given' | 'proposed';
  parts?: RollPart[];
  of?: string;
  tags?: TagOrFormula[];
  bands?: string;
  better?: 'high' | 'low';
  options?: StepOptions;
  /** Choice steps: the recommended option. Allocate steps: amounts by field ID. */
  recommend?: Formula | Record<string, Formula>;
  /** Choice and allocate steps: draw the recommendation at random while it holds. */
  random?: Formula;
  prefer?: Formula;
  repeat?: { max: Formula; min?: Formula };
  cases?: (BranchArm & { when: Formula })[];
  else?: BranchArm;
  changes?: ProposedChange[];
  to?: Destination;
  /** Roll, choice, changes, action and branch steps: once per participant of a role. */
  each?: string;
  as?: 'participant';
  use?: string;
  source?: Formula;
  entry?: Formula;
  hold?: boolean;
  release?: { steps: string[]; where?: Formula; combine?: boolean };
  params?: Record<string, Formula>;
  /** Keyed by qualified situational ID once loaded. */
  situational?: Record<string, Formula>;
  participants?: Record<string, Formula>;
  result?: Formula;
  data?: Record<string, Formula>;
  prompt?: string;
  label?: string;
  fields?: { type: 'field'; where?: Formula };
  budget?: Formula;
  spend?: 'all' | 'upTo';
  limit?: Formula;
  cost?: Formula;
  values?: Formula[];
}

export interface StepOption {
  id: string;
  when?: Formula;
  changes?: ProposedChange[];
  to?: Destination;
  flags?: Record<string, Formula>;
}

export type StepOptions =
  | StepOption[]
  | { content: { type: string; where?: Formula } }
  | { copies: { type: string; where?: Formula } }
  | ValueSource
  | { pending: { entry?: Formula } };

export interface ValueSource {
  values: (string | number)[] | { formula: Formula };
  where?: Formula;
}

export function writtenOptions(step: Step): StepOption[] {
  return Array.isArray(step.options) ? step.options : [];
}

/** The query a kept template is kept by, over copies' base items or over content. */
export function keptQuery(kept: KeptTemplate): Query {
  return (kept.copies ?? kept.content) as Query;
}

export function optionQuery(
  step: Step,
): { source: 'content' | 'copies'; type: string; where?: Formula } | undefined {
  const options = step.options;
  if (!options || Array.isArray(options)) return undefined;
  if ('content' in options) return { source: 'content', ...options.content };
  if ('copies' in options) return { source: 'copies', ...options.copies };
  return undefined;
}

export function valueSource(step: Step): ValueSource | undefined {
  const options = step.options;
  return options && !Array.isArray(options) && 'values' in options ? options : undefined;
}

export function pendingSource(step: Step): { entry?: Formula } | undefined {
  const options = step.options;
  return options && !Array.isArray(options) && 'pending' in options ? options.pending : undefined;
}

export interface BranchArm {
  id?: string;
  flags?: Record<string, Formula>;
  steps?: Step[];
}

export interface ProposedEntry {
  id?: string;
  item: Formula;
  quantity?: Formula;
  equipped?: Formula;
  state?: Record<string, Formula>;
  templates?: string[];
  choices?: Record<string, unknown>;
}

export interface ProposedChange {
  type: string;
  when?: Formula;
  forEach?: Formula;
  field?: string | { formula: Formula };
  entry?: string | ProposedEntry | { formula: Formula };
  key?: string;
  value?: Formula;
  by?: Formula;
  tags?: TagOrFormula[];
  split?: { roll: string; by: string };
  copies?: { type: string; where?: Formula };
  limit?: number;
  applied?: { where: Formula; limit?: number };
  picks?: { where: Formula; limit?: number };
  pick?: 'self';
  grant?: 'self';
  grants?: { where: Formula; limit?: number };
  id?: string;
  source?: Formula;
  active?: Formula;
  state?: Record<string, Formula>;
  equipped?: Formula;
  template?: Formula;
  path?: { entry?: string | { formula: Formula }; choice: string[] | Formula };
  option?: Formula;
  followUp?: string;
  params?: Record<string, Formula>;
}

export interface ActionDef {
  id: string;
  tags?: string[];
  available?: Formula;
  params?: Record<string, ValueDecl>;
  participants?: Record<string, Role>;
  steps: Step[];
  results?: string[] | { bands: string };
  label?: string;
  scope?: 'holder' | 'applied';
}

export interface ActionUse {
  use: string;
  params?: Record<string, Formula>;
  scope?: 'holder' | 'applied';
}

export type ActionOrUse = ActionDef | ActionUse;

export interface CopyLimit {
  max?: number;
  perItem?: number;
}

export interface ContentTypeDef {
  effects?: Effect[];
  followUps?: FollowUp[];
  grants?: Grant[];
  fields?: Record<string, ValueDecl>;
  state?: Record<string, ValueDecl>;
  computed?: Record<string, ComputedDecl>;
  carried?: boolean;
  equippable?: boolean;
  /** Integer literals, read without evaluating anything. */
  copies?: CopyLimit;
  actions?: ActionOrUse[];
  label?: string;
  /** Named texts: `<contentId>.texts.<name>` keys; the engine doesn't read them. */
  texts?: string[];
  reapply?: Reapply;
  nameFrom?: string;
}

export interface ContentItem {
  id?: string;
  type?: string;
  override?: string;
  extends?: string;
  tags?: string[];
  removeTags?: string[];
  /** A template's string, enum or id value may be `{ formula }`. */
  fields?: Record<string, Literal | { formula: Formula }>;
  /** Templates only: values its item fields read as `params.<name>`, given by a keeper. */
  params?: Record<string, ValueDecl>;
  state?: Record<string, ValueDecl>;
  computed?: Record<string, ComputedDecl>;
  /** A string state key whose non-empty value names each copy, replacing the type's. */
  nameFrom?: string;
  effects?: Effect[];
  followUps?: FollowUp[];
  actions?: ActionOrUse[];
  choices?: Choice[];
  grants?: Grant[];
  immuneTo?: Immunity[];
  reapply?: Reapply;
  standardCopies?: Query[];
  keepsTemplates?: KeptTemplate[];
  /** Item fields the templates this item keeps leave as they are. */
  keepsFields?: string[];
  prerequisites?: Prerequisite[];
  appliesTo?: Query | Query[];
  suppress?: string[];
  /** Exempt from exclusivity groups: picked again in another choice of a group. */
  repeatable?: boolean;
}

export interface Situational {
  id: string;
  type: string;
  rolls?: string[];
  incoming?: { fields?: string[]; tags?: string[] };
  values?: string[];
  default?: Literal;
  effects?: Effect[];
  available?: Formula;
  label?: string;
}

export interface DisplayGroup {
  id: string;
  kind?: 'fields' | 'actions' | 'content';
  label?: string;
  visibility?: 'primary' | 'secondary' | 'background';
  members?: Query & { from?: 'own' | 'applied' };
  showWhen?: Formula;
  sectionBy?: Formula;
  sortBy?: Formula;
}

export interface FieldHints {
  groups?: string[];
  label?: string;
  shortLabel?: string;
  format?: string | { bands: string };
  unit?: string;
  hidden?: boolean;
  visibility?: 'primary' | 'secondary' | 'background';
  showWhen?: Formula;
  /** The first is the field's own roll; `action` is qualified by `loadRuleset`. */
  rolls?: FieldRoll[];
  /** Companion fields shown in this field's tile, qualified by `loadRuleset`. */
  with?: { field: string; as: CompanionRole }[];
}

export type CompanionRole = 'modifier' | 'max' | 'detail';

export interface StateHints extends Omit<FieldHints, 'groups' | 'rolls' | 'with'> {
  with?: { key: string; as: CompanionRole }[];
}

export interface FieldRoll {
  action: string;
  params?: Record<string, Literal>;
}

export interface TypeHints {
  state?: Record<string, StateHints>;
  fields?: Record<string, { format?: string; unit?: string; hidden?: boolean }>;
  quantity?: { hidden?: boolean };
}

export type StackingPolicy = 'addAll' | 'highestOnly' | 'lowestOnly' | 'playerChooses';
export type Recommend = 'highest' | 'lowest' | 'first' | 'last';

export interface Settings {
  rounding?: 'floor' | 'ceil' | 'round' | 'truncate';
  roundIncoming?: 'value' | 'magnitude';
  rollModifiers?: { advantage?: 'cancel' | 'net' | 'stack' };
  stacking?: { default?: StackingPolicy; keys?: Record<string, StackingPolicy> };
  competing?: { recommend?: Recommend };
}

export interface DeclaredField {
  type: string;
  values?: string[];
  of?: string;
  default?: Literal;
}

export interface Role {
  /** The pack participants are expected to use; only the build checks against it. */
  pack?: string;
  min?: number;
  max?: number;
  fields?: Record<string, DeclaredField>;
}

export interface LinkSlot {
  /** The pack the linked character is expected to use; only cross-checked at load. */
  pack?: string;
  fields: Record<string, DeclaredField>;
}

export interface CreationStart {
  id: string;
  action: string;
  params?: Record<string, Literal>;
  random?: boolean;
}

export interface Band {
  id: string;
  when: Formula;
  tags?: string[];
}

export type BandSetDoc = Band[] | { value: Formula; bands: Band[] };

/** A result band set: its bands, and the value they read as `roll.value`. */
export interface BandSet {
  value?: Formula;
  bands: Band[];
}

export function bandSet(doc: BandSetDoc): BandSet {
  return Array.isArray(doc) ? { bands: doc } : { value: doc.value, bands: doc.bands };
}

export interface RulesDoc {
  /** Named lists of keys for field families; expanded before loading. */
  families?: Record<string, (string | number)[]>;
  /** Named sets of declared view fields; expanded before loading. */
  viewFields?: Record<string, Record<string, DeclaredField>>;
  tags?: string[];
  fields?: Record<string, FieldDef>;
  links?: Record<string, LinkSlot>;
  contentTypes?: Record<string, ContentTypeDef>;
  templateFields?: Record<string, ValueDecl>;
  settings?: Settings;
  situational?: Situational[];
  rollTallies?: string[];
  resultBands?: Record<string, BandSetDoc>;
  actions?: ActionDef[];
  effects?: Effect[];
  followUps?: FollowUp[];
  creation?: CreationStart[];
  standardCopies?: Query[];
  immuneTo?: Immunity[];
  choices?: Choice[];
  constraints?: Constraint[];
  display?: {
    groups?: DisplayGroup[];
    fields?: Record<string, FieldHints>;
    types?: Record<string, TypeHints>;
  };
}

export type I18nDoc = Record<string, string>;

export type { UpgradeScript as UpgradeDoc } from '@opencharacter/spec';

export type { ChoicePick as Pick, ChoiceTree, Entry } from '@opencharacter/spec';
export type { CharacterFile as CharacterDoc } from '@opencharacter/spec';

export function appliesQueries(item: { appliesTo?: Query | Query[] | undefined }): Query[] {
  const a = item.appliesTo;
  return a === undefined ? [] : Array.isArray(a) ? a : [a];
}

export interface Constraint {
  id: string;
  check: Formula;
  data?: Record<string, Formula>;
  copies?: { type: string; where?: Formula };
}

/** Whether an item's value has the shape its item field declares (references resolve apart). */
export function fitsItemField(value: unknown, decl: ValueDecl): boolean {
  switch (decl.type) {
    case 'integer':
    case 'decimal':
    case 'boolean':
    case 'dice':
      return !Array.isArray(value) && (typeof value !== 'object' || value === null);
    case 'string':
    case 'id':
      return typeof value === 'string';
    case 'enum':
      return typeof value === 'string' && (decl.values ?? []).includes(value);
    case 'set':
      return Array.isArray(value);
    default:
      return true;
  }
}

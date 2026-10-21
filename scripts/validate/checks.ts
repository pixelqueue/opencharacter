import semver from 'semver';
import { loadFixedSet, SPEC_VERSION } from '../../packages/spec/src/node.ts';
import {
  ALL_ROOTS,
  checkPackFormulas,
  describeProblem,
  fieldsMatching,
  formulaTree,
} from '../../packages/engine/src/check/index.ts';
import {
  aggregatedFields,
  calculationOrder,
  children,
  evaluate,
  type FieldView,
  longDecimals,
  type Node,
  parse,
  RESERVED,
  references,
  roundDecimal,
} from '../../packages/engine/src/formula/index.ts';
import { familyPattern, patternIds } from '../../packages/engine/src/formula/evaluate.ts';

const KEYWORDS = new Set(['true', 'false', 'null', 'in']);
import {
  optionQuery,
  pendingSource,
  valueSource,
  writtenOptions,
} from '../../packages/engine/src/core/pack-types.ts';
import { appliesQueries } from '../../packages/engine/src/core/pack-types.ts';
import { HOMEBREW } from '../../packages/engine/src/core/homebrew.ts';
import {
  blockArgument,
  headlineArgument,
  messageArguments,
  spellTag,
} from '../../packages/text/src/block.ts';
import { admitsTag } from '../../packages/engine/src/core/ruleset.ts';
import type { Reporter } from './report.ts';
import type { ContentEntry, Ruleset } from './ruleset.ts';
import type {
  ActionDef,
  ActionOrUse,
  CharacterDoc,
  Choice,
  CreationStart,
  ChoiceTree,
  ContentItem,
  Destination,
  DisplayGroup,
  Effect,
  FollowUp,
  FieldDef,
  FieldHints,
  FieldRoll,
  Formula,
  Grant,
  GrantValue,
  Immunity,
  InlineOption,
  Literal,
  OptionValue,
  StepChanges,
  ProposedChange,
  Query,
  Step,
  TypeHints,
  ValueDecl,
} from './types.ts';

const BUILT_IN_TYPES = new Set(['template', 'field']);
const numeric = (t: string | undefined) => t === 'integer' || t === 'decimal';
const MEMBER_KINDS = new Set(['field', 'tag', 'string']);
const OP_TARGETS = new Map(
  loadFixedSet('effect-operations').items.map((op) => [op.id, op['targets'] as string[]]),
);

const COPY_CORE = new Set(['id', 'item', 'templates', 'equipped', 'quantity', 'choices', 'state']);

function hasOutcome(steps: Step[]): boolean {
  return steps.some(
    (step) =>
      step.kind === 'outcome' ||
      [...(step.cases ?? []), ...(step.else ? [step.else] : [])].some((arm) =>
        hasOutcome(arm.steps ?? []),
      ),
  );
}

function actionIds(def: { actions?: ActionOrUse[] }): Set<string> {
  return new Set((def.actions ?? []).flatMap((a) => ('use' in a ? [] : [a.id])));
}

function targetKind(
  target: Effect['target'],
): 'field' | 'fields' | 'roll' | 'incoming' | 'choice' | 'step' {
  if (typeof target === 'string') return 'field';
  if ('fields' in target) return 'fields';
  if ('choices' in target) return 'choice';
  if ('steps' in target) return 'step';
  return 'rolls' in target ? 'roll' : 'incoming';
}

function matchesFieldView(where: Formula, view: FieldView): boolean {
  if (view.type !== 'integer' && view.type !== 'decimal') return false;
  const tree = formulaTree(where);
  if (!tree.ok) return false;
  const result = evaluate(tree.value, {
    field: () => undefined,
    roots: { item: { id: view.id, type: view.type, tags: [...view.tags] } },
  });
  return result.ok && result.value.kind === 'bool' && result.value.value;
}

export class PackChecker {
  private readonly scope: string[];
  private readonly tags: Set<string>;
  readonly requiredKeys = new Set<string>();
  readonly optionalKeys = new Set<string>();
  readonly optionalPrefixes = new Set<string>();
  readonly slotPrompts = new Set<string>();
  private readonly blocks = new Map<string, BlockScope>();
  private contentOwner: string | undefined;
  private offerable: FollowUp[] | undefined;

  constructor(
    private readonly ruleset: Ruleset,
    private readonly report: Reporter,
    private readonly packId: string,
    private readonly onFormula?: (text: string) => void,
    /** A character's homebrew: no name, and text only if it has any. */
    private readonly homebrew = false,
  ) {
    this.scope = ruleset.scope(packId);
    this.tags = ruleset.declaredTags(this.scope);
  }

  /**
   * A computed `source` can't be known here, so it passes; the engine checks it when the action
   * runs.
   */
  private sourceDefines(source: Formula | undefined, use: string): boolean {
    if (source === undefined) return false;
    const tree = formulaTree(source);
    if (!tree.ok || tree.value.type !== 'string') return true;
    const defines = (def: { actions?: ActionOrUse[] } | undefined) =>
      (def?.actions ?? []).some((a) => !('use' in a) && a.id === use);
    let entry = this.ruleset.item(tree.value.value, this.scope);
    const seen = new Set<string>();
    while (entry && !seen.has(entry.qid)) {
      seen.add(entry.qid);
      if (defines(entry.item)) return true;
      const typeName = this.ruleset.typeOf(entry);
      const type = typeName
        ? this.ruleset.contentType(typeName, this.ruleset.scope(entry.pack))
        : undefined;
      if (defines(type?.def)) return true;
      const parent = entry.item.extends ?? entry.item.override;
      entry = parent ? this.ruleset.item(parent, this.ruleset.scope(entry.pack)) : undefined;
    }
    return false;
  }

  /** Whether any loaded content type or item defines an inline action with this local ID. */
  private anyDefines(use: string): boolean {
    const defines = (def: { actions?: ActionOrUse[] }) =>
      (def.actions ?? []).some((a) => !('use' in a) && a.id === use);
    for (const { item } of this.ruleset.content.values()) if (defines(item)) return true;
    for (const rules of this.ruleset.rules.values())
      for (const { def } of rules.contentTypes.values()) if (defines(def)) return true;
    return false;
  }

  private tag(tag: string, file: string, where: string): void {
    if (!this.tags.has(tag))
      this.report.error(file, `${where}: unknown-tag: "${tag}" is not declared in rules \`tags\``);
  }

  private tagList(
    tags: readonly (string | { formula: Formula })[] | undefined,
    file: string,
    where: string,
  ): void {
    for (const tag of tags ?? []) {
      if (typeof tag === 'string') this.tag(tag, file, where);
    }
  }

  run(): void {
    const pack = this.ruleset.packs.get(this.packId);
    const rules = this.ruleset.rules.get(this.packId);
    if (!pack || !rules) return;
    if (!this.homebrew) this.requiredKeys.add('pack.name');
    this.optionalKeys.add('headline');
    this.optionalKeys.add('headline.separator');

    for (const [dep, range] of Object.entries(pack.manifest.dependencies ?? {})) {
      if (!this.ruleset.packs.has(dep)) {
        this.report.error(`${pack.dir}/pack.yaml`, `dependency "${dep}" (${range}) not found`);
      }
    }

    for (const [id, { def, at: file }] of rules.fields) {
      const where = `field ${id}`;
      const reserved = id
        .split('.')
        .find((segment) => RESERVED.has(segment) || KEYWORDS.has(segment));
      if (reserved) {
        this.report.error(
          file,
          `${where}: "${reserved}" is a reserved word and cannot be part of a field ID`,
        );
      }
      if (ALL_ROOTS.has(id.split('.')[0] ?? '')) {
        this.report.error(
          file,
          `${where}: field IDs cannot start with the context root "${id.split('.')[0]}"`,
        );
      }
      this.memberKind(def, file, where);
      if (def.members && def.default !== undefined)
        for (const tag of [def.default].flat())
          this.memberTag(String(tag), def, file, `${where} default`);
      this.tagList(def.tags, file, where);
      this.routing(def, file, where);
      const hidden = rules.fieldHints.get(id)?.def.hidden === true;
      if (!hidden) this.requiredKeys.add(`fields.${id}.name`);
      this.optionalKeys.add(`fields.${id}.description`);
      // An enum's values are named like the field: required unless it's hidden.
      if (def.type === 'enum')
        for (const value of def.values ?? [])
          (hidden ? this.optionalKeys : this.requiredKeys).add(`fields.${id}.values.${value}.name`);
    }

    this.calculationOrder();

    for (const [name, { def, at: file }] of rules.links) {
      this.optionalKeys.add(`links.${name}.name`);
      // A view nests fields at their dots, so one declared ID can't be the start of another.
      const ids = Object.keys(def.fields);
      for (const id of ids)
        if (ids.some((other) => other.startsWith(`${id}.`)))
          this.report.error(
            file,
            `link ${name}: "${id}" is also the start of another declared field`,
          );
      if (def.pack === undefined) continue;
      if (!this.ruleset.packs.has(def.pack)) {
        this.report.error(file, `link ${name}: unknown pack "${def.pack}"`);
        continue;
      }
      const scope = this.ruleset.scope(def.pack);
      for (const [field, decl] of Object.entries(def.fields)) {
        const found = this.ruleset.field(field, scope);
        if (!found)
          this.report.error(file, `link ${name}: "${field}" is not a field of ${def.pack}`);
        else if (found.def.type !== decl.type)
          this.report.error(
            file,
            `link ${name}: "${field}" is ${found.def.type} in ${def.pack}, declared ${decl.type}`,
          );
      }
    }

    for (const [name, { def, at: file }] of rules.templateFields) {
      const where = `template field ${name}`;
      // Named for a custom template's form, in each pack that declares it.
      this.requiredKeys.add(`templateFields.${name}.name`);
      this.optionalKeys.add(`templateFields.${name}.description`);
      this.memberKind(def, file, where);
      if (def.default !== undefined)
        this.itemFieldValue(def.default, def, file, `${where} default`);
      const earlier = this.ruleset.templateFields(this.scope.slice(1)).get(name);
      if (
        earlier &&
        (earlier.def.type !== def.type ||
          earlier.def.of !== def.of ||
          JSON.stringify(earlier.def.values ?? null) !== JSON.stringify(def.values ?? null))
      )
        this.report.error(
          file,
          `${where}: template-field-mismatch: ${earlier.pack} declares it with another type`,
        );
    }

    for (const [name, { def, at: file }] of rules.contentTypes) {
      const where = `content type ${name}`;
      this.requiredKeys.add(def.label ?? `types.${name}.name`);
      if (def.copies) this.optionalKeys.add(`types.${name}.copies`);
      this.copyNames(`types.${name}`, def);
      this.nameFrom(def.nameFrom, def.state, file, where);
      this.blockKeys(`types.${name}`, `${this.packId}:${name}`, def, true);
      this.computedNames(def.computed, def.state, file, where);
      // Every item field is named, a hidden one too: a custom-item form asks for each.
      for (const field of Object.keys(def.fields ?? {})) {
        this.requiredKeys.add(`types.${name}.fields.${field}.name`);
        this.optionalKeys.add(`types.${name}.fields.${field}.description`);
      }
      for (const decl of [...Object.values(def.fields ?? {}), ...Object.values(def.state ?? {})]) {
        this.memberKind(decl, file, where);
      }
      for (const [field, decl] of Object.entries(def.fields ?? {}))
        if (decl.default !== undefined)
          this.itemFieldValue(decl.default, decl, file, `${where} field ${field} default`);
      const ids = new Set<string>();
      for (const effect of def.effects ?? []) {
        if (effect.id !== undefined && ids.has(effect.id))
          this.report.error(file, `${where}: duplicate effect id "${effect.id}"`);
        if (effect.id !== undefined) ids.add(effect.id);
      }
      this.offerable = def.followUps ?? [];
      this.contentOwner = `types.${name}`;
      for (const effect of def.effects ?? []) this.effect(effect, file, where);
      this.contentOwner = undefined;
      this.followUps(
        (def.followUps ?? []).map((fu) => ({ def: fu, file })),
        `types.${name}.followUps`,
        actionIds(def),
        true,
      );
      this.grants(def.grants, file, `${where}: `);
      for (const action of def.actions ?? []) this.actionOrUse(action, file, `types.${name}`);
      this.offerable = undefined;
    }

    for (const [id, { def, at: file }] of rules.situational) {
      this.requiredKeys.add(def.label ?? `situational.${id}.name`);
      if (def.type === 'enum')
        for (const value of def.values ?? [])
          this.requiredKeys.add(`situational.${id}.values.${value}.name`);
      this.tagList(def.rolls, file, `situational ${id}`);
      this.tagList(def.incoming?.tags, file, `situational ${id}`);
      for (const ref of def.incoming?.fields ?? []) {
        if (!this.ruleset.field(ref, this.scope))
          this.report.error(file, `situational ${id}: unknown field "${ref}"`);
      }
      for (const effect of def.effects ?? []) this.effect(effect, file, `situational ${id}`, false);
    }

    for (const name of rules.tallies.keys()) this.optionalKeys.add(`tallies.${name}.name`);

    // A tag's text belongs to the pack that declares it.
    for (const tag of this.ruleset.declaredTags([this.packId])) {
      this.requiredKeys.add(`tags.${tag}.name`);
      this.optionalKeys.add(`tags.${tag}.description`);
    }

    for (const [set, { def, at: file }] of rules.bands) {
      for (const band of def.bands) {
        this.requiredKeys.add(`bands.${set}.${band.id}.name`);
        this.optionalKeys.add(`bands.${set}.${band.id}.condition`);
        this.tagList(band.tags, file, `band ${set}.${band.id}`);
      }
    }

    this.offerable = rules.followUps.map(({ def }) => def);
    for (const [, { def, at: file }] of rules.actions) this.action(def, file, `actions.${def.id}`);
    this.offerable = undefined;
    this.creation(rules.creation);
    for (const { def, at: file } of rules.effects) this.effect(def, file, 'rules effect', false);
    this.followUps(
      rules.followUps.map(({ def, at }) => ({ def, file: at })),
      'followUps',
    );
    for (const { def, at: file } of rules.choices.values()) this.choices([def], file, 'rules');
    // A slot's key may not be another rules-level choice's ID.
    for (const { def, at: file } of rules.choices.values())
      for (const n of def.slots ?? [])
        if (rules.choices.has(`${def.id}-${n}`))
          this.report.error(file, `rules: duplicate choice id "${def.id}-${n}"`);

    for (const [id, { def, at: file }] of rules.constraints) {
      this.requiredKeys.add(`constraints.${id}`);
      if (def.copies && !this.ruleset.contentType(def.copies.type, this.scope))
        this.report.error(file, `constraint ${id}: unknown content type "${def.copies.type}"`);
    }
    const immunityIds = new Set<string>();
    for (const { def, at: file } of rules.immuneTo) {
      if (immunityIds.has(def.id)) this.report.error(file, `immunity ${def.id}: duplicate id`);
      immunityIds.add(def.id);
      this.immunities([def], file, 'rules', false);
    }
    for (const { def, at: file } of rules.standardCopies)
      this.query(def, file, 'rules standardCopies');
    this.standardOverLimit();

    for (const [id, { def, at: file }] of rules.groups) this.group(id, def, file);
    for (const [id, { def, at: file }] of rules.fieldHints) {
      const field = this.ruleset.field(id, this.scope);
      if (!field) this.report.error(file, `display hints for unknown field "${id}"`);
      if (typeof def.format === 'object') {
        if (!this.ruleset.bands(def.format.bands, this.scope))
          this.report.error(file, `field "${id}": unknown result bands "${def.format.bands}"`);
        if (field && !['integer', 'decimal'].includes(field.def.type))
          this.report.error(file, `field "${id}": a band set names numbers, not ${field.def.type}`);
      }
      for (const group of def.groups ?? []) {
        const found = this.ruleset.group(group, this.scope);
        if (!found) {
          this.report.error(file, `field "${id}" is in unknown display group "${group}"`);
        } else if ((found.def.kind ?? 'fields') !== 'fields') {
          this.report.error(file, `field "${id}" is in ${found.def.kind} display group "${group}"`);
        }
      }
      if (def.label) this.requiredKeys.add(def.label);
      if (def.shortLabel) this.requiredKeys.add(def.shortLabel);
      this.unit(def.unit);
      for (const roll of def.rolls ?? []) this.fieldRoll(id, roll, file);
      this.companions(
        `field "${id}"`,
        field?.def.type,
        (def.with ?? []).map((c) => {
          const found = this.ruleset.field(c.field, this.scope);
          const hints = found ? this.fieldHintsOf(found.qid) : undefined;
          return {
            name: c.field,
            as: c.as,
            self: found !== undefined && found.qid === field?.qid,
            type: found?.def.type,
            hidden: hints?.hidden === true,
            chained: hints?.with !== undefined,
          };
        }),
        file,
      );
    }
    for (const [type, { def, at: file }] of rules.typeHints) this.typeHints(type, def, file);

    for (const { file, doc } of pack.content) {
      this.contentOwner = doc.id ?? doc.override;
      this.item(doc, file);
      this.contentOwner = undefined;
    }
    this.formulas();
    this.upgradeScripts();
    if (!this.homebrew || pack.i18n.size > 0) this.i18n();
  }

  private creation(starts: { def: CreationStart; at: string }[]): void {
    const ids = new Set<string>();
    for (const { def, at: file } of starts) {
      const where = `creation ${def.id}`;
      if (ids.has(def.id)) this.report.error(file, `${where}: duplicate creation start id`);
      ids.add(def.id);
      this.requiredKeys.add(`creation.${def.id}.name`);
      this.requiredKeys.add(`creation.${def.id}.description`);
      const target = this.ruleset.action(def.action, this.scope);
      if (!target) {
        this.report.error(file, `${where}: unknown action "${def.action}"`);
        continue;
      }
      for (const name of Object.keys(def.params ?? {}))
        if (!target.def.params?.[name])
          this.report.error(file, `${where}: action "${def.action}" has no parameter "${name}"`);
      for (const [name, decl] of Object.entries(target.def.params ?? {}))
        if (!decl.optional && decl.default === undefined && def.params?.[name] === undefined)
          this.report.error(file, `${where}: action "${def.action}" needs parameter "${name}"`);
      if (def.random) this.randomRun(target.def, target.qid, file, where, new Set());
      // A creation action's rolls are a wizard's cards: each needs its own name, or every card
      // reads as the action. Only the start's own steps, when this pack defines it.
      if (target.qid === `${this.packId}:${target.def.id}`) {
        const walk = (steps: Step[]) => {
          for (const step of steps) {
            if (step.kind === 'roll' && !step.label)
              this.requiredKeys.add(`actions.${target.def.id}.steps.${step.id}.name`);
            for (const arm of [...(step.cases ?? []), ...(step.else ? [step.else] : [])])
              walk(arm.steps ?? []);
          }
        };
        walk(target.def.steps);
      }
    }
  }

  /**
   * Warns about each step of a random creation action an automatic run would pause at: a choice
   * step over a written list, or an allocate step, without `recommend`; a choice step over content
   * or copies without `recommend` or `prefer`. A `random` step draws one. Actions it runs through
   * `action` steps are walked too.
   */
  private randomRun(
    action: ActionDef,
    qid: string,
    file: string,
    where: string,
    seen: Set<string>,
  ): void {
    if (seen.has(qid)) return;
    seen.add(qid);
    const walk = (steps: Step[], prefix: string) => {
      for (const step of steps) {
        const path = `${prefix}${step.id}`;
        const query =
          step.kind === 'choice' &&
          !Array.isArray(step.options) &&
          step.options !== undefined &&
          ('content' in step.options || 'copies' in step.options);
        const pauses =
          (step.kind === 'choice' && Array.isArray(step.options)) ||
          step.kind === 'allocate' ||
          (query && step.prefer === undefined);
        if (pauses && step.recommend === undefined && step.random === undefined)
          this.report.warn(
            file,
            `${where}: step "${path}" of ${qid} has no recommend, so a random run pauses there`,
          );
        for (const arm of [...(step.cases ?? []), ...(step.else ? [step.else] : [])])
          walk(arm.steps ?? [], `${path}/`);
        if (step.kind === 'action' && step.use && step.as !== 'participant') {
          const used = this.ruleset.action(step.use, this.scope);
          if (used) this.randomRun(used.def, used.qid, file, where, seen);
        }
      }
    };
    walk(action.steps, '');
  }

  private upgradeScripts(): void {
    const pack = this.ruleset.packs.get(this.packId);
    if (!pack) return;
    for (const { file, doc } of pack.upgrades) {
      if (!semver.valid(doc.from) || !semver.valid(doc.to) || !semver.lt(doc.from, doc.to)) {
        this.report.error(file, `upgrade script: from ${doc.from} must be below to ${doc.to}`);
      }
      if (semver.gt(doc.to, pack.manifest.version)) {
        this.report.error(
          file,
          `upgrade script goes to ${doc.to}, past the pack's version ${pack.manifest.version}`,
        );
      }
      for (const raw of doc.steps) {
        const step = raw as {
          op: string;
          to?: string;
          field?: string;
          owner?: string;
          choice?: string;
          type?: string;
          item?: string;
        };
        const where = `upgrade ${doc.from}-to-${doc.to} ${step.op}`;
        if (step.op === 'renameContent' && step.to && !this.ruleset.item(step.to, [this.packId])) {
          this.report.error(file, `${where}: "${step.to}" is not content of this pack`);
        }
        if (step.op === 'renameField' && step.to) {
          const field = this.ruleset.field(step.to, [this.packId]);
          if (!field?.def.input)
            this.report.error(file, `${where}: "${step.to}" is not an input field of this pack`);
        }
        if ((step.op === 'setDefault' || step.op === 'mapValues') && step.field) {
          const field = this.ruleset.field(step.field, [this.packId]);
          if (!field?.def.input)
            this.report.error(file, `${where}: "${step.field}" is not an input field of this pack`);
        }
        const own = [this.packId];
        if (step.op === 'renameContentType' && step.to && !this.ruleset.contentType(step.to, own))
          this.report.error(file, `${where}: "${step.to}" is not a content type of this pack`);
        if (step.op === 'renameAction' && step.to && !this.ruleset.action(step.to, own))
          this.report.error(file, `${where}: "${step.to}" is not a rules action of this pack`);
        if (step.op === 'renameTag' && step.to && !this.ruleset.declaredTags(own).has(step.to))
          this.report.error(file, `${where}: "${step.to}" is not a tag this pack declares`);
        if (step.op === 'renameItemField' && step.type && step.to) {
          const type = this.ruleset.contentType(step.type, own);
          if (!Object.hasOwn(type?.def.fields ?? {}, step.to))
            this.report.error(file, `${where}: "${step.to}" is not an item field of ${step.type}`);
        }
        if (step.op === 'adoptStandard' && step.item && !this.ruleset.item(step.item, own))
          this.report.error(file, `${where}: "${step.item}" is not content of this pack`);
        if (step.op === 'requireChoice' && step.choice) {
          const owner = step.owner ? this.ruleset.item(step.owner, [this.packId])?.item : undefined;
          const choices = step.owner
            ? (owner?.choices ?? [])
            : [...(this.ruleset.rules.get(this.packId)?.choices.keys() ?? [])].map((id) => ({
                id,
              }));
          if (!choices.some((c) => c.id === step.choice))
            this.report.error(
              file,
              `${where}: no choice "${step.choice}" on ${step.owner ?? 'the rules'}`,
            );
        }
      }
    }
  }

  private computedNames(
    computed: Record<string, unknown> | undefined,
    state: Record<string, unknown> | undefined,
    file: string,
    where: string,
    core = true,
  ): void {
    for (const name of Object.keys(computed ?? {})) {
      if (core && COPY_CORE.has(name))
        this.report.error(file, `${where}: computed value "${name}" reuses a core property`);
      else if (state && Object.hasOwn(state, name))
        this.report.error(file, `${where}: computed value "${name}" reuses a state key`);
    }
  }

  private copyNames(
    key: string,
    def: { state?: Record<string, unknown>; computed?: Record<string, unknown> },
    typeState?: Record<string, unknown>,
  ): void {
    for (const [name, decl] of Object.entries(def.state ?? {})) {
      this.optionalKeys.add(`${key}.state.${name}.name`);
      // An item's enum state key that its type declares too falls back to the type's value names.
      const { type, values = [] } = decl as { type?: string; values?: unknown[] };
      if (type !== 'enum') continue;
      const keys =
        typeState && Object.hasOwn(typeState, name) ? this.optionalKeys : this.requiredKeys;
      for (const value of values) keys.add(`${key}.state.${name}.values.${String(value)}.name`);
    }
    for (const name of Object.keys(def.computed ?? {}))
      this.optionalKeys.add(`${key}.computed.${name}.name`);
  }

  private nameFrom(
    key: string | undefined,
    state: Record<string, unknown> | undefined,
    file: string,
    where: string,
  ): void {
    if (key === undefined) return;
    const decl = state?.[key] as { type?: string } | undefined;
    if (!decl) this.report.error(file, `${where}: nameFrom names unknown state key "${key}"`);
    else if (decl.type !== 'string')
      this.report.error(file, `${where}: nameFrom state key "${key}" must be a string`);
  }

  private blockKeys(
    owner: string,
    type: string,
    def: BlockScope['def'],
    own: boolean,
    item?: BlockScope['item'],
  ): void {
    this.optionalKeys.add(`${owner}.block`);
    this.blocks.set(`${owner}.block`, { type, def, own, ...(item ? { item } : {}) });
    this.optionalKeys.add(`${owner}.headline`);
    this.blocks.set(`${owner}.headline`, { type, def, own, ...(item ? { item } : {}) });
    if (item) return;
    for (const of of ['fields', 'state'] as const)
      for (const [name, decl] of Object.entries(def[of] ?? {}))
        if (decl.type === 'enum')
          for (const value of decl.values ?? [])
            this.optionalKeys.add(`${owner}.${of}.${name}.values.${value}.name`);
        // Another value may have a name too (orc-2e's light Bulk, 0.1, is "L").
        else this.optionalPrefixes.add(`${owner}.${of}.${name}.values.`);
  }

  private block(file: string, key: string, text: string, names?: Map<string, string>): void {
    const scope = this.blocks.get(key);
    if (!scope) return;
    const what = key.endsWith('.headline') ? 'headline piece' : 'block';
    const parsed = messageArguments(text);
    if (!parsed.ok) {
      this.report.error(file, `"${key}": the ${what} doesn't parse as ICU (${parsed.error})`);
      return;
    }
    const { def, item } = scope;
    const fields = def.fields ?? {};
    const state = { ...def.state, ...item?.state };
    const computed = { ...def.computed, ...item?.computed };
    const local = scope.type.slice(scope.type.indexOf(':') + 1);
    for (const arg of parsed.args) {
      const a = blockArgument(arg, (n) => Object.hasOwn(fields, n));
      const base = a?.kind === 'has' ? a.of : a;
      let ok = base !== undefined;
      if (base?.kind === 'text') ok = (def.texts ?? []).includes(base.text);
      // A tag test spells a declared tag, `.` and `-` as `_`.
      if (base?.kind === 'tag') ok = [...this.tags].some((t) => spellTag(t) === base.spelled);
      if (base?.kind === 'self')
        ok = Object.hasOwn(state, base.key) || Object.hasOwn(computed, base.key);
      if (!ok) {
        this.report.error(
          file,
          `"${key}": the ${what}'s argument {${arg}} is nothing its type gives`,
        );
        continue;
      }
      // A value's name: each enum value needs one, in the type's own pack's default language.
      if (!names || !scope.own || !base || !('names' in base) || !base.names) continue;
      const [of, name, decl] =
        base.kind === 'field'
          ? (['fields', base.field, fields[base.field]] as const)
          : base.kind === 'self'
            ? (['state', base.key, state[base.key]] as const)
            : [];
      if (!of || decl?.type !== 'enum') continue;
      for (const value of decl.values ?? []) {
        const valueKey = `types.${local}.${of}.${name}.values.${value}.name`;
        if (!names.has(valueKey))
          this.report.error(file, `"${key}": {${arg}} needs a name for "${value}" ("${valueKey}")`);
      }
    }
  }

  /** The headline's arguments spell a field's dots as `_`, one field per spelling. */
  private headline(file: string, text: string): void {
    const parsed = messageArguments(text);
    if (!parsed.ok) {
      this.report.error(file, `"headline": the headline doesn't parse as ICU (${parsed.error})`);
      return;
    }
    const fields = new Map<string, Set<string>>();
    for (const id of this.ruleset.fieldIds(this.scope)) {
      const spelled = spellTag(id);
      fields.set(spelled, (fields.get(spelled) ?? new Set()).add(id));
    }
    const scope = {
      field: (s: string) => fields.has(s),
      type: (n: string) => this.ruleset.contentType(n, this.scope) !== undefined,
      link: (n: string) => this.ruleset.link(n, this.scope) !== undefined,
    };
    for (const arg of parsed.args) {
      const a = headlineArgument(arg, scope);
      const base = a?.kind === 'has' ? a.of : a;
      if (!base) {
        this.report.error(
          file,
          `"headline": the argument {${arg}} is no field_, type_ or link_ the pack sees`,
        );
        continue;
      }
      const ids = base.kind === 'field' ? fields.get(base.spelled) : undefined;
      if (ids && ids.size > 1)
        this.report.error(
          file,
          `"headline": {${arg}} could be any of ${[...ids].join(', ')}; rename one field`,
        );
    }
  }

  private item(item: ContentItem, file: string): void {
    const owner = item.id ?? item.override ?? '?';
    if (item.override) {
      const target = this.ruleset.item(item.override, this.scope);
      if (!target) this.report.error(file, `overrides unknown item "${item.override}"`);
      else if (target.pack === this.packId)
        this.report.error(file, 'cannot override an item in the same pack');
    } else {
      this.requiredKeys.add(`${owner}.name`);
      const typeDef = item.type ? this.ruleset.contentType(item.type, this.scope)?.def : undefined;
      this.copyNames(owner, item, typeDef?.state ?? {});
      this.nameFrom(item.nameFrom, { ...typeDef?.state, ...item.state }, file, owner);
    }
    this.tagList(item.tags, file, owner);
    this.tagList(item.removeTags, file, `${owner}.removeTags`);
    if (item.extends && !this.ruleset.item(item.extends, this.scope)) {
      this.report.error(file, `extends unknown item "${item.extends}"`);
    }

    const typeName = item.type;
    if (typeName === 'template' && item.id) {
      const fields: Record<string, { type: string }> = {};
      for (const [name, value] of Object.entries(item.fields ?? {}))
        if (typeof value === 'number' || typeof value === 'boolean')
          fields[name] = { type: typeof value === 'number' ? 'decimal' : 'boolean' };
      this.blockKeys(item.id, 'template', { fields }, false, {});
    }
    if (typeName && !BUILT_IN_TYPES.has(typeName)) {
      const type = this.ruleset.contentType(typeName, this.scope);
      if (!type) {
        this.report.error(file, `unknown content type "${typeName}"`);
      } else {
        if (item.id)
          for (const text of type.def.texts ?? [])
            this.optionalKeys.add(`${item.id}.texts.${text}`);
        if (item.id)
          this.blockKeys(item.id, type.qid, type.def, type.qid.startsWith(`${this.packId}:`), item);
        const decls = type.def.fields ?? {};
        for (const [name, value] of Object.entries(item.fields ?? {})) {
          const decl = decls[name];
          if (!decl)
            this.report.error(
              file,
              `field "${name}" is not declared by content type "${typeName}"`,
            );
          else this.itemFieldValue(value, decl, file, `${owner}.fields.${name}`);
        }
        if (!item.extends) {
          for (const [name, decl] of Object.entries(decls)) {
            if (decl.required && !(name in (item.fields ?? {}))) {
              this.report.error(
                file,
                `missing required field "${name}" for content type "${typeName}"`,
              );
            }
          }
        }
      }
    } else if (typeName === 'template') {
      // A template sets the template fields and its base types' fields; with several base types, a
      // field of every one of them.
      const bases = appliesQueries(item).map(
        (q) => this.ruleset.contentType(q.type, this.scope)?.def,
      );
      const types = appliesQueries(item).map((q) => q.type);
      const templateFields = this.ruleset.templateFields(this.scope);
      for (const [name, value] of Object.entries(item.fields ?? {})) {
        const inAll = bases.length > 0 && bases.every((b) => b?.fields?.[name] !== undefined);
        const decl =
          (inAll ? bases[0]?.fields?.[name] : undefined) ?? templateFields.get(name)?.def;
        if (!decl)
          this.report.error(
            file,
            `field "${name}" is neither a template field nor a field of ${types.map((t) => `"${t}"`).join(' and ')}`,
          );
        else if (value !== null) this.itemFieldValue(value, decl, file, `${owner}.fields.${name}`);
      }
    }

    for (const query of appliesQueries(item)) this.query(query, file, `${owner} appliesTo`);
    for (const decl of Object.values(item.state ?? {})) this.memberKind(decl, file, owner);
    {
      const ref = item.override ?? item.extends;
      const parent = ref ? this.ruleset.item(ref, this.scope) : undefined;
      const own =
        item.type === 'template'
          ? appliesQueries(item)[0]?.type
          : (item.type ?? (parent ? this.ruleset.typeOf(parent) : undefined));
      const type = own ? this.ruleset.contentType(own, this.scope)?.def : undefined;
      this.computedNames(item.computed, { ...type?.state, ...item.state }, file, owner);
      this.computedNames(type?.computed, item.state ?? {}, file, owner, false);
    }
    if (item.suppress) {
      const ref = item.override ?? item.extends;
      const parent = ref ? this.ruleset.item(ref, this.scope) : undefined;
      const own = item.type ?? (parent ? this.ruleset.typeOf(parent) : undefined);
      const type = own ? this.ruleset.contentType(own, this.scope)?.def : undefined;
      const typeEffects = new Set((type?.effects ?? []).map((e) => e.id));
      for (const id of item.suppress) {
        if (!typeEffects.has(id))
          this.report.error(
            file,
            `${owner}: suppress names "${id}", which is not an effect ID of its content type`,
          );
      }
    }
    const itemType =
      typeName && !BUILT_IN_TYPES.has(typeName)
        ? this.ruleset.contentType(typeName, this.scope)
        : undefined;
    this.offerable = [...(item.followUps ?? []), ...(itemType?.def.followUps ?? [])];
    for (const effect of item.effects ?? []) this.effect(effect, file, owner);
    this.followUps(
      (item.followUps ?? []).map((fu) => ({ def: fu, file })),
      `${owner}.followUps`,
      this.itemActionIds(item),
      true,
    );
    for (const action of item.actions ?? []) this.actionOrUse(action, file, `${owner}.actions`);
    this.choices(item.choices ?? [], file, owner);
    this.offerable = undefined;
    this.grants(item.grants, file, '');
    this.immunities(item.immuneTo ?? [], file, owner);
    for (const query of item.standardCopies ?? [])
      this.query(query, file, `${owner}.standardCopies`);
    for (const kept of item.keepsTemplates ?? []) {
      const template = this.ruleset.item(kept.template, this.scope);
      if (!template) this.report.error(file, `keepsTemplates: unknown item "${kept.template}"`);
      else if (template.item.type !== 'template')
        this.report.error(file, `keepsTemplates: "${kept.template}" is not a template`);
      this.query(kept.copies, file, `${owner}.keepsTemplates`);
    }
    for (const name of item.keepsFields ?? []) {
      const types = (item.keepsTemplates ?? []).map(
        (k) => this.ruleset.contentType(k.copies.type, this.scope)?.def,
      );
      const known =
        this.ruleset.templateFields(this.scope).has(name) ||
        (types.length > 0 && types.every((t) => t?.fields?.[name] !== undefined));
      if (!known)
        this.report.error(file, `keepsFields: "${name}" is not an item field of the kept copies`);
    }
    for (const prerequisite of item.prerequisites ?? [])
      this.requiredKeys.add(`${owner}.prerequisites.${prerequisite.id}`);
  }

  private itemActionIds(item: ContentItem, depth = 0): Set<string> {
    const own = actionIds(item);
    const parentRef = item.extends ?? item.override;
    const parent = parentRef ? this.ruleset.item(parentRef, this.scope) : undefined;
    const typeName = item.type ?? (parent ? this.ruleset.typeOf(parent) : undefined);
    const type = typeName ? this.ruleset.contentType(typeName, this.scope)?.def : undefined;
    for (const id of actionIds(type ?? {})) own.add(id);
    if (parent && depth < 16)
      for (const id of this.itemActionIds(parent.item, depth + 1)) own.add(id);
    return own;
  }

  private followUps(
    list: { def: FollowUp; file: string }[],
    keyRoot: string,
    own: ReadonlySet<string> = new Set(),
    copy = false,
  ): void {
    const ids = new Set<string>();
    for (const { def, file } of list) {
      const where = `follow-up ${keyRoot}.${def.id}`;
      if (ids.has(def.id)) this.report.error(file, `${where}: duplicate follow-up id`);
      ids.add(def.id);
      this.optionalKeys.add(`${keyRoot}.${def.id}.name`);
      this.optionalKeys.add(`${keyRoot}.${def.id}.description`);
      if (def.on) {
        if (!this.ruleset.field(def.on.field, this.scope))
          this.report.error(file, `${where}: unknown field "${def.on.field}"`);
        for (const tag of def.on.tags ?? []) this.tag(tag, file, where);
      }
      const to = def.to === 'self' ? undefined : def.to;
      if (to) this.linkScope(to.link, file, where);
      if (def.create) this.createOffer(def.create, file, where);
      if (def.action !== undefined) {
        if (to) {
          if (!def.action.includes(':'))
            this.report.error(
              file,
              `${where}: a follow-up to a link names its action with the pack ("<pack>:${def.action}")`,
            );
        } else if (!own.has(def.action) && !this.ruleset.action(def.action, this.scope)) {
          this.report.error(file, `${where}: unknown action "${def.action}"`);
        }
      }
      for (const change of def.changes ?? []) {
        if (change.type === 'offerFollowUp')
          this.report.error(file, `${where}: only an action offers a follow-up (offerFollowUp)`);
        if (change.split) this.report.error(file, `${where}: a follow-up's change has no split`);
        else this.proposedChange(change, file, where, false, new Set(), to);
        if (change.entry === 'self' && !copy)
          this.report.error(file, `${where}: entry: self is only for follow-ups on content`);
      }
    }
  }

  private createOffer(create: NonNullable<FollowUp['create']>, file: string, where: string): void {
    const link = this.ruleset.link(create.link, this.scope);
    if (!link) this.report.error(file, `${where}: unknown link "${create.link}"`);
    const colon = create.start.indexOf(':');
    const id = colon < 0 ? create.start : create.start.slice(colon + 1);
    let found: { def: CreationStart; pack: string } | undefined;
    for (const pid of colon < 0 ? this.scope : [create.start.slice(0, colon)]) {
      if (!this.scope.includes(pid)) continue;
      const hit = this.ruleset.rules.get(pid)?.creation.find((s) => s.def.id === id);
      if (hit) {
        found = { def: hit.def, pack: pid };
        break;
      }
    }
    if (!found) {
      this.report.error(file, `${where}: unknown creation start "${create.start}"`);
      return;
    }
    const expects = link?.def.pack;
    if (expects !== undefined) {
      if (!this.ruleset.packs.has(expects) || !this.ruleset.scope(expects).includes(found.pack))
        this.report.error(
          file,
          `${where}: creation start "${create.start}" is ${found.pack}'s, which a character using ${expects} doesn't load`,
        );
    }
    const action = this.ruleset.action(found.def.action, this.ruleset.scope(found.pack));
    for (const name of Object.keys(create.params ?? {}))
      if (action && !action.def.params?.[name])
        this.report.error(
          file,
          `${where}: creation start "${create.start}"'s action has no parameter "${name}"`,
        );
  }

  private itemFieldValue(value: Literal, decl: ValueDecl, file: string, where: string): void {
    const bad = (expected: string) =>
      this.report.error(file, `${where}: expected ${expected}, got ${JSON.stringify(value)}`);
    switch (decl.type) {
      case 'integer':
      case 'decimal':
      case 'boolean':
      case 'dice':
        if (Array.isArray(value)) bad(`a ${decl.type} formula`);
        break;
      case 'string':
        if (typeof value !== 'string') bad('a string');
        break;
      case 'enum':
        if (typeof value !== 'string' || !decl.values?.includes(value)) {
          bad(`one of ${decl.values?.join(', ')}`);
        }
        break;
      case 'id':
        if (typeof value !== 'string') bad('an id');
        else this.member(value, decl.of, file, where, decl);
        break;
      case 'set':
        if (!Array.isArray(value)) bad('a list');
        else for (const member of value) this.member(String(member), decl.of, file, where, decl);
        break;
    }
  }

  private member(
    value: string,
    of: string | undefined,
    file: string,
    where: string,
    decl?: Pick<ValueDecl, 'members'>,
  ): void {
    if (of === 'tag') {
      this.tag(value, file, where);
      this.memberTag(value, decl, file, where);
    }
    if (!of || of === 'tag' || of === 'string') return;
    if (of === 'field') {
      if (!this.ruleset.field(value, this.scope))
        this.report.error(file, `${where}: unknown field "${value}"`);
      return;
    }
    const hit = this.ruleset.item(value, this.scope);
    if (!hit) this.report.error(file, `${where}: unknown ${of} "${value}"`);
    else if (this.ruleset.typeOf(hit) !== of)
      this.report.error(file, `${where}: "${value}" is not a ${of}`);
  }

  private memberTag(
    tag: string,
    decl: Pick<ValueDecl, 'members'> | undefined,
    file: string,
    where: string,
  ): void {
    if (decl?.members && !admitsTag(decl.members, tag))
      this.report.error(file, `${where}: "${tag}" is not one of its members`);
  }

  private memberKind(decl: ValueDecl, file: string, where: string): void {
    const { under = [], tags = [], except = [] } = decl.members ?? {};
    for (const tag of [...under, ...tags, ...except]) this.tag(tag, file, `${where} members`);
    if (!decl.of || MEMBER_KINDS.has(decl.of)) return;
    if (!this.ruleset.contentType(decl.of, this.scope)) {
      this.report.error(file, `${where}: unknown member kind "${decl.of}"`);
    }
  }

  private immunities(list: Immunity[], file: string, owner: string, unique = true): void {
    const ids = new Set<string>();
    for (const def of list) {
      const where = `${owner} immunity ${def.id}`;
      if (unique && ids.has(def.id)) this.report.error(file, `${where}: duplicate id`);
      ids.add(def.id);
      for (const id of def.items ?? [])
        if (!this.ruleset.item(id, this.scope))
          this.report.error(file, `${where}: unknown item "${id}"`);
      if (def.query) {
        if (BUILT_IN_TYPES.has(def.query.type))
          this.report.error(file, `${where}: a query over "${def.query.type}" matches no content`);
        else this.query(def.query, file, where);
      }
    }
  }

  /** Actions and content join a display group only by `members`. */
  private group(id: string, def: DisplayGroup, file: string): void {
    const where = `group ${id}`;
    const kind = def.kind ?? 'fields';
    this.requiredKeys.add(def.label ?? `groups.${id}.label`);
    // Section labels are optional, and their keys come from a formula.
    if (def.sectionBy !== undefined) this.optionalPrefixes.add(`groups.${id}.sections.`);
    const type = def.members?.type;
    if (kind === 'actions' && type !== 'action')
      this.report.error(file, `${where}: an actions group's members must be "type: action"`);
    else if (
      kind === 'content' &&
      (type === undefined || BUILT_IN_TYPES.has(type) || type === 'action')
    )
      this.report.error(file, `${where}: a content group's members must name a content type`);
    else if (kind === 'fields' && type !== undefined && type !== 'field')
      this.report.error(file, `${where}: a fields group's members must be "type: field"`);
    else if (def.members && kind !== 'actions') this.query(def.members, file, where);
  }

  private grants(grants: readonly Grant[] | undefined, file: string, prefix: string): void {
    for (const grant of grants ?? []) {
      // A formula item names content per character: checked by the engine.
      if (typeof grant.item !== 'string') continue;
      const granted = this.ruleset.item(grant.item, this.scope);
      if (!granted) {
        this.report.error(file, `${prefix}grants unknown item "${grant.item}"`);
        continue;
      }
      if (!grant.state) continue;
      const typeName = this.ruleset.typeOf(granted);
      const type = typeName
        ? this.ruleset.contentType(typeName, this.ruleset.scope(granted.pack))?.def
        : undefined;
      const declared = { ...type?.state, ...granted.item.state };
      for (const key of Object.keys(grant.state))
        if (!(key in declared))
          this.report.error(
            file,
            `${prefix}grant of "${grant.item}" sets state key "${key}", which it doesn't declare`,
          );
    }
  }

  private typeHints(type: string, def: TypeHints, file: string): void {
    const found = this.ruleset.contentType(type, this.scope);
    if (!found) {
      this.report.error(file, `display hints for unknown content type "${type}"`);
      return;
    }
    const where = `display hints for ${type}`;
    const state = new Map(Object.entries(found.def.state ?? {}).map(([k, d]) => [k, d.type]));
    for (const { item } of this.ruleset.content.values())
      if (item.type === type)
        for (const [key, decl] of Object.entries(item.state ?? {}))
          if (!state.has(key)) state.set(key, decl.type);
    for (const [key, hints] of Object.entries(def.state ?? {})) {
      if (!state.has(key)) this.report.error(file, `${where}: unknown state key "${key}"`);
      if (hints.label) this.requiredKeys.add(hints.label);
      if (hints.shortLabel) this.requiredKeys.add(hints.shortLabel);
      this.unit(hints.unit);
      this.companions(
        `${where}: state key "${key}"`,
        state.get(key),
        (hints.with ?? []).map((c) => ({
          name: c.key,
          as: c.as,
          self: c.key === key,
          type: state.get(c.key),
          hidden: def.state?.[c.key]?.hidden === true,
          chained: def.state?.[c.key]?.with !== undefined,
        })),
        file,
      );
    }
    for (const [name, hints] of Object.entries(def.fields ?? {})) {
      if (!found.def.fields?.[name])
        this.report.error(file, `${where}: unknown item field "${name}"`);
      this.unit(hints.unit);
    }
  }

  private fieldRoll(id: string, roll: FieldRoll, file: string): void {
    const where = `field "${id}" rolls ${roll.action}`;
    const target = this.ruleset.action(roll.action, this.scope);
    if (!target) {
      this.report.error(file, `field "${id}" rolls unknown action "${roll.action}"`);
      return;
    }
    const actionScope = this.ruleset.scope(target.qid.slice(0, target.qid.indexOf(':')));
    for (const [name, value] of Object.entries(roll.params ?? {})) {
      const decl = target.def.params?.[name];
      if (!decl) {
        this.report.error(file, `${where}: no parameter "${name}"`);
        continue;
      }
      const bad = (expected: string) =>
        this.report.error(
          file,
          `${where}: parameter "${name}" expects ${expected}, got ${JSON.stringify(value)}`,
        );
      const member = (v: Literal): string | undefined => {
        if (typeof v !== 'string') return 'a string';
        if (decl.of === 'field') {
          const field = this.ruleset.field(v, this.scope);
          if (!field) return 'a known field';
          const tags = field.def.tags ?? [];
          if (decl.where === undefined || !tags.every((t) => typeof t === 'string')) return;
          const tree = formulaTree(decl.where);
          if (!tree.ok) return;
          const result = evaluate(tree.value, {
            field: () => undefined,
            roots: { item: { id: field.qid, type: field.def.type, tags: tags as string[] } },
          });
          if (!(result.ok && result.value.kind === 'bool' && result.value.value))
            return 'a field its where matches';
          return;
        }
        if (!decl.of || MEMBER_KINDS.has(decl.of)) return;
        const type = this.ruleset.contentType(decl.of, actionScope);
        const item = this.ruleset.item(v, this.scope);
        const typeName = item && this.ruleset.typeOf(item);
        const itemType = typeName
          ? this.ruleset.contentType(typeName, this.ruleset.scope(item.pack))
          : undefined;
        if (!type || itemType?.qid !== type.qid) return `a ${decl.of}`;
        return;
      };
      switch (decl.type) {
        case 'integer':
        case 'decimal':
          if (typeof value !== 'number' || (decl.type === 'integer' && !Number.isInteger(value)))
            bad(decl.type === 'integer' ? 'a whole number' : 'a number');
          else if (typeof decl.min === 'number' && value < decl.min) bad(`at least ${decl.min}`);
          else if (typeof decl.max === 'number' && value > decl.max) bad(`at most ${decl.max}`);
          break;
        case 'boolean':
          if (typeof value !== 'boolean') bad('true or false');
          break;
        case 'string':
        case 'dice':
          if (typeof value !== 'string') bad('a string');
          break;
        case 'enum':
          if (typeof value !== 'string' || !decl.values?.includes(value))
            bad(`one of ${decl.values?.join(', ')}`);
          break;
        case 'id': {
          const problem = member(value);
          if (problem) bad(problem);
          break;
        }
        case 'set': {
          if (!Array.isArray(value)) bad('a list');
          else
            for (const v of value) {
              const problem = member(v);
              if (problem) bad(problem);
            }
          break;
        }
      }
    }
  }

  private fieldHintsOf(qid: string): FieldHints | undefined {
    const local = qid.slice(qid.indexOf(':') + 1);
    for (const pid of this.scope) {
      const hints = this.ruleset.rules.get(pid)?.fieldHints;
      const found = hints?.get(qid) ?? (qid.startsWith(`${pid}:`) ? hints?.get(local) : undefined);
      if (found) return found.def;
    }
    return undefined;
  }

  private companions(
    where: string,
    type: string | undefined,
    companions: {
      name: string;
      as: string;
      self: boolean;
      type: string | undefined;
      hidden: boolean;
      chained: boolean;
    }[],
    file: string,
  ): void {
    const roles = new Set<string>();
    for (const c of companions) {
      const at = `${where} with ${c.name}`;
      if (roles.has(c.as)) this.report.error(file, `${where}: companion role "${c.as}" twice`);
      roles.add(c.as);
      if (c.type === undefined) {
        this.report.error(file, `${at}: unknown companion`);
        continue;
      }
      if (c.self) this.report.error(file, `${at}: a value isn't its own companion`);
      if (c.hidden) this.report.error(file, `${at}: a hidden value can't be a companion`);
      if (c.chained) this.report.error(file, `${at}: a companion has no companions of its own`);
      const paired = c.as === 'modifier' || c.as === 'max';
      if (paired && type !== undefined && !(numeric(type) && numeric(c.type)))
        this.report.error(file, `${at}: a ${c.as} companion pairs numbers`);
    }
  }

  private unit(id: string | undefined): void {
    if (id === undefined) return;
    this.requiredKeys.add(`units.${id}.name`);
    this.requiredKeys.add(`units.${id}.short`);
  }

  /**
   * Rules-level standard copies that alone exceed their type's `copies.max` make every character
   * invalid. Counted over the pack's scope with every query of the scope; reported at the pack's
   * own query of the type. A `where` is read with the item's ID, type and tags; one that reads more
   * counts no item.
   */
  private standardOverLimit(): void {
    const own = this.ruleset.rules.get(this.packId)?.standardCopies ?? [];
    const queries = this.scope.flatMap((pid) =>
      (this.ruleset.rules.get(pid)?.standardCopies ?? []).map((q) => ({ ...q, pid })),
    );
    const typeOf = (name: string, pid: string) =>
      this.ruleset.contentType(name, this.ruleset.scope(pid));
    const reported = new Set<string>();
    for (const { def, at: file } of own) {
      const type = typeOf(def.type, this.packId);
      const max = type?.def.copies?.max;
      // A formula limit depends on the character: the engine reports it.
      if (!type || typeof max !== 'number' || reported.has(type.qid)) continue;
      reported.add(type.qid);
      const matched = new Set<string>();
      for (const query of queries) {
        if (typeOf(query.def.type, query.pid)?.qid !== type.qid) continue;
        const tree = query.def.where === undefined ? undefined : formulaTree(query.def.where);
        for (const entry of this.ruleset.content.values()) {
          if (!this.scope.includes(entry.pack)) continue;
          const name = this.ruleset.typeOf(entry);
          if (!name || typeOf(name, entry.pack)?.qid !== type.qid) continue;
          if (tree) {
            if (!tree.ok) continue;
            const view = {
              id: entry.qid,
              type: type.qid.split(':')[1],
              tags: [...(entry.item.tags ?? [])],
            };
            const result = evaluate(tree.value, { field: () => undefined, roots: { item: view } });
            if (!(result.ok && result.value.kind === 'bool' && result.value.value)) continue;
          }
          matched.add(entry.qid);
        }
      }
      if (matched.size > max)
        this.report.error(
          file,
          `rules standardCopies: too-many-copies: the standard copies of "${def.type}" (${matched.size}) exceed its copies.max (${max})`,
        );
    }
  }

  private query(query: Query, file: string, where: string): void {
    if (!BUILT_IN_TYPES.has(query.type) && !this.ruleset.contentType(query.type, this.scope)) {
      this.report.error(file, `${where}: query names unknown type "${query.type}"`);
    }
  }

  private effect(effect: Effect, file: string, where: string, copy = true): void {
    const kind = targetKind(effect.target);
    const label = `${where} effect${effect.id ? ` ${effect.id}` : ''}`;
    if (effect.then && !copy)
      this.report.error(
        file,
        `${label}: then-without-copy: only an effect with an entry (content's, not the rules', a situational choice's or a choice's) can change its entry`,
      );
    if (!OP_TARGETS.get(effect.op)?.includes(kind)) {
      this.report.error(file, `${label}: op "${effect.op}" cannot target ${kind}s`);
    }
    if (typeof effect.target === 'string') {
      const field = this.ruleset.field(effect.target, this.scope);
      if (!field) this.report.error(file, `${label}: unknown target field "${effect.target}"`);
      else if (effect.op === 'grant' && field.def.type !== 'set') {
        this.report.error(
          file,
          `${label}: grant needs a set field, "${effect.target}" is ${field.def.type}`,
        );
      }
      if (effect.op === 'grant' && field) {
        this.grantValue(effect.value as GrantValue, field.def.of, file, label, field.def);
      }
    } else if ('fields' in effect.target) {
      // A grant into a set of set fields: the members each field takes are checked by the engine
      // when it applies.
      if (effect.op === 'grant')
        this.grantValue(effect.value as GrantValue, undefined, file, label);
    } else if ('rolls' in effect.target) {
      this.tagList(effect.target.rolls, file, label);
      if (effect.target.parts) this.tagList(effect.target.parts, file, label);
      const tally = effect.target.tally;
      if (tally !== undefined) {
        if (!this.scope.some((pid) => this.ruleset.rules.get(pid)?.tallies.has(tally)))
          this.report.error(
            file,
            `${label}: unknown-tally: "${tally}" is not a declared roll tally`,
          );
        if (!['add', 'atLeast', 'atMost'].includes(effect.op))
          this.report.error(file, `${label}: op "${effect.op}" cannot target a roll tally`);
      }
    } else if ('incoming' in effect.target) {
      this.tagList(effect.target.incoming.tags, file, label);
      for (const ref of effect.target.incoming.fields ?? []) {
        if (!this.ruleset.field(ref, this.scope))
          this.report.error(file, `${label}: unknown field "${ref}"`);
      }
    } else if ('choices' in effect.target) {
      this.tagList(effect.target.choices, file, label);
    } else if ('steps' in effect.target) {
      this.tagList(effect.target.steps, file, label);
    }
    // A changes effect adds to a step the way an option effect does, so it too belongs on a content
    // item.
    if (effect.op === 'changes') {
      const value = effect.value as StepChanges;
      if (this.contentOwner === undefined)
        this.report.error(
          file,
          `${label}: changes effects are only for content items and types (their effects, choices and inline options)`,
        );
      for (const change of value.changes ?? [])
        this.proposedChange(change, file, label, false, new Set(), value.to);
    }
    // An option effect adds an option named by the content item that writes it, so it belongs on a
    // content item: its effects, or its choices' and inline options'.
    if (effect.op === 'option') {
      const value = effect.value as OptionValue;
      if (this.contentOwner === undefined)
        this.report.error(
          file,
          `${label}: option effects are only for content items and types (their effects, choices and inline options)`,
        );
      else this.requiredKeys.add(`${this.contentOwner}.options.${value.id}.name`);
      for (const change of value.changes ?? [])
        this.proposedChange(change, file, label, false, new Set(), value.to);
    }
    if (effect.tags) {
      if (kind !== 'roll' || effect.op !== 'add') {
        this.report.error(
          file,
          `${label}: tags are only for add effects on rolls (the roll item they add)`,
        );
      }
      this.tagList(effect.tags, file, label);
    }
  }

  private routing(def: FieldDef, file: string, where: string): void {
    const numericInput = (ref: string, what: string) => {
      const field = this.ruleset.field(ref, this.scope);
      if (!field) this.report.error(file, `${where}: ${what} names unknown field "${ref}"`);
      else if (!field.def.input || !['integer', 'decimal'].includes(field.def.type)) {
        this.report.error(file, `${where}: ${what} field "${ref}" must be a numeric input field`);
      }
    };
    if (
      (def.absorbedBy || def.overflow) &&
      (!def.input || !['integer', 'decimal'].includes(def.type))
    ) {
      this.report.error(
        file,
        `${where}: absorbedBy and overflow are only for numeric input fields`,
      );
    }
    for (const ref of def.absorbedBy ?? []) numericInput(ref, 'absorbedBy');
    if (def.nameFrom !== undefined) {
      const named = this.ruleset.field(def.nameFrom, this.scope);
      if (!named)
        this.report.error(file, `${where}: nameFrom names unknown field "${def.nameFrom}"`);
      else if (named.def.type !== 'string')
        this.report.error(
          file,
          `${where}: nameFrom field "${def.nameFrom}" must be a string field`,
        );
    }
    for (const overflow of def.overflow ?? []) {
      numericInput(overflow.into, 'overflow');
      this.tagList(overflow.tags, file, `${where} overflow`);
    }
    if (new Set((def.overflow ?? []).map((o) => o.at)).size < (def.overflow ?? []).length) {
      this.report.error(file, `${where}: at most one overflow per bound`);
    }
  }

  private grantValue(
    value: GrantValue,
    of: string | undefined,
    file: string,
    where: string,
    decl?: Pick<ValueDecl, 'members'>,
  ): void {
    if (value.item !== undefined) this.member(value.item, of, file, where);
    if (value.tag !== undefined) {
      this.tag(value.tag, file, where);
      this.memberTag(value.tag, decl, file, where);
    }
    if (value.field !== undefined && !this.ruleset.field(value.field, this.scope)) {
      this.report.error(file, `${where}: unknown field "${value.field}"`);
    }
    if (value.query) this.query(value.query, file, where);
  }

  private choices(choices: Choice[], file: string, owner: string): void {
    const seen = new Set<string>();
    for (const choice of choices) {
      // A slotted choice is one choice per slot, keyed `<id>-<slot>`.
      const keys = choice.slots ? choice.slots.map((n) => `${choice.id}-${n}`) : [choice.id];
      for (const id of keys) {
        if (seen.has(id)) this.report.error(file, `${owner}: duplicate choice id "${id}"`);
        seen.add(id);
      }
      const key = `${owner}.choices.${choice.id}`;
      const where = `choice ${key}`;
      this.requiredKeys.add(choice.prompt ?? `${key}.prompt`);
      if (choice.slots) this.slotPrompts.add(choice.prompt ?? `${key}.prompt`);
      for (const effect of choice.effects ?? []) this.effect(effect, file, where, false);
      const group = choice.unique?.includes(':') ? choice.unique.split(':')[0] : undefined;
      if (group !== undefined && !this.scope.includes(group))
        this.report.error(
          file,
          `${where}: exclusivity group "${choice.unique}" names a pack that isn't this one or a dependency`,
        );
      const from = choice.from;
      if (choice.activate !== undefined && ('values' in from || 'options' in from))
        this.report.error(file, `${where}: activate applies only to a query or items`);
      // A computed list's values aren't known here.
      if ('values' in from) this.optionalPrefixes.add(`${key}.options.`);
      if ('items' in from) {
        for (const ref of from.items) {
          if (!this.ruleset.item(ref, this.scope))
            this.report.error(file, `${where}: unknown option "${ref}"`);
        }
      } else if ('options' in from) {
        this.inlineOptions(from.options, file, key);
      } else if ('type' in from) {
        this.query(from, file, where);
      }
    }
  }

  private inlineOptions(options: InlineOption[], file: string, key: string): void {
    const seen = new Set<string>();
    for (const option of options) {
      if (seen.has(option.id))
        this.report.error(file, `${key}: duplicate option id "${option.id}"`);
      seen.add(option.id);
      const owner = `${key}.options.${option.id}`;
      this.requiredKeys.add(`${owner}.name`);
      this.tagList(option.tags, file, owner);
      for (const effect of option.effects ?? []) this.effect(effect, file, owner);
      this.grants(option.grants, file, `${owner}: `);
      for (const prerequisite of option.prerequisites ?? [])
        this.requiredKeys.add(`${owner}.prerequisites.${prerequisite.id}`);
      this.choices(option.choices ?? [], file, owner);
    }
  }

  private actionOrUse(action: ActionOrUse, file: string, keyPrefix: string): void {
    if ('use' in action) {
      const target = this.ruleset.action(action.use, this.scope);
      if (!target) {
        this.report.error(file, `uses unknown action "${action.use}"`);
        return;
      }
      for (const name of Object.keys(action.params ?? {})) {
        if (!target.def.params?.[name])
          this.report.error(file, `action "${action.use}" has no parameter "${name}"`);
      }
      return;
    }
    this.action(action, file, `${keyPrefix}.${action.id}`);
  }

  private action(action: ActionDef, file: string, key: string): void {
    this.params(action, file, key);
    this.roles(action, file, key);
    this.actionBody(action, file, key);
  }

  private roles(action: ActionDef, file: string, key: string): void {
    for (const [role, def] of Object.entries(action.participants ?? {})) {
      const where = `${key}: role ${role}`;
      this.optionalKeys.add(`${key}.participants.${role}.name`);
      if (def.min !== undefined && def.max !== undefined && def.min > def.max)
        this.report.error(file, `${where}: min is greater than max`);
      const ids = Object.keys(def.fields ?? {});
      for (const id of ids)
        if (ids.some((other) => other.startsWith(`${id}.`)))
          this.report.error(file, `${where}: "${id}" is also the start of another declared field`);
      if (def.pack !== undefined && !this.ruleset.packs.has(def.pack)) {
        this.report.error(file, `${where}: unknown pack "${def.pack}"`);
        continue;
      }
      const scope = def.pack !== undefined ? this.ruleset.scope(def.pack) : this.scope;
      const pack = def.pack ?? this.packId;
      for (const [field, decl] of Object.entries(def.fields ?? {})) {
        const found = this.ruleset.field(field, scope);
        if (!found) this.report.error(file, `${where}: "${field}" is not a field of ${pack}`);
        else if (found.def.type !== decl.type)
          this.report.error(
            file,
            `${where}: "${field}" is ${found.def.type} in ${pack}, declared ${decl.type}`,
          );
      }
    }
  }

  private params(action: ActionDef, file: string, key: string): void {
    for (const [name, decl] of Object.entries(action.params ?? {})) {
      if (decl.type !== 'id' || decl.of !== 'field') {
        const content = decl.type === 'id' && decl.of !== 'tag' && decl.of !== 'string';
        if (decl.where !== undefined && !content)
          this.report.error(
            file,
            `${key}: param ${name}: where is only for field and content parameters (type: id)`,
          );
        continue;
      }
      if (fieldsMatching(this.ruleset, this.scope, decl.where).length === 0)
        this.report.error(file, `${key}: param ${name} allows no field`);
    }
  }

  private actionBody(action: ActionDef, file: string, key: string): void {
    this.requiredKeys.add(action.label ?? `${key}.name`);
    this.optionalKeys.add(`${key}.description`);
    this.tagList(action.tags, file, key);
    for (const [name, decl] of Object.entries(action.params ?? {})) {
      this.memberKind(decl, file, key);
      this.requiredKeys.add(decl.label ?? `${key}.params.${name}.name`);
      this.optionalKeys.add(`${key}.params.${name}.description`);
      if (decl.type === 'enum')
        for (const value of decl.values ?? [])
          this.requiredKeys.add(`${key}.params.${name}.values.${value}.name`);
    }
    this.results(action, file, key);
    const ids = new Set<string>();
    const rollSteps = new Set<string>();
    const collect = (steps: Step[]) => {
      for (const step of steps) {
        if (step.kind === 'roll') rollSteps.add(step.id);
        for (const arm of [...(step.cases ?? []), ...(step.else ? [step.else] : [])])
          collect(arm.steps ?? []);
      }
    };
    collect(action.steps);
    const walk = (steps: Step[]) => {
      for (const step of steps) {
        const where = `${key} step ${step.id}`;
        if (ids.has(step.id)) this.report.error(file, `${key}: duplicate step id "${step.id}"`);
        ids.add(step.id);
        this.tagList(step.tags, file, where);
        for (const part of step.parts ?? []) {
          this.tagList(part.tags, file, where);
          if (part.ifEmpty !== undefined && part.dice === undefined)
            this.report.error(file, `${where}: ifEmpty is only for dice parts`);
        }
        if (step.bands && !this.ruleset.bands(step.bands, this.scope)) {
          this.report.error(file, `${where}: unknown result bands "${step.bands}"`);
        }
        for (const option of writtenOptions(step))
          this.requiredKeys.add(`${key}.options.${option.id}.name`);
        // A value's own text is optional: the app names it otherwise.
        if (valueSource(step)) this.optionalPrefixes.add(`${key}.options.`);
        const query = step.kind === 'choice' ? optionQuery(step) : undefined;
        if (query && !this.ruleset.contentType(query.type, this.scope))
          this.report.error(file, `${where}: unknown content type "${query.type}"`);
        // A roll's default name is optional; an explicit one must exist.
        if (step.kind === 'choice' || step.kind === 'allocate') {
          if (step.prompt) this.requiredKeys.add(step.prompt);
          else if (!pendingSource(step)) this.requiredKeys.add(`${key}.steps.${step.id}.prompt`);
        }
        if (step.kind === 'allocate') this.allocate(step, file, where);
        if (step.kind === 'roll') {
          if (step.label) this.requiredKeys.add(step.label);
          else this.optionalKeys.add(`${key}.steps.${step.id}.name`);
        }
        for (const arm of [...(step.cases ?? []), ...(step.else ? [step.else] : [])])
          walk(arm.steps ?? []);
        const copies = query?.source === 'copies';
        for (const option of writtenOptions(step))
          for (const change of option.changes ?? [])
            this.proposedChange(change, file, where, copies, rollSteps, option.to);
        for (const change of step.changes ?? [])
          this.proposedChange(change, file, where, copies, rollSteps, step.to);
        if (
          step.kind === 'action' &&
          step.use &&
          !this.ruleset.action(step.use, this.scope) &&
          !this.sourceDefines(step.source, step.use) &&
          !(step.source === undefined && step.entry !== undefined && this.anyDefines(step.use))
        ) {
          this.report.error(file, `${where}: unknown action "${step.use}"`);
        }
        // Roles: `each` and a role in `to` must be declared (`target` needn't be), and a handoff
        // needs an `each`.
        const declared = (role: string) => Object.hasOwn(action.participants ?? {}, role);
        if (step.each !== undefined && !declared(step.each))
          this.report.error(file, `${where}: each names undeclared role "${step.each}"`);
        if (step.as === 'participant' && step.each === undefined)
          this.report.error(file, `${where}: as: participant is only for an each step`);
        // An `each` branch step's case steps already run per participant.
        if (step.kind === 'branch' && step.each !== undefined) {
          const nested = (list: Step[]): void => {
            for (const inner of list) {
              if (inner.each !== undefined)
                this.report.error(
                  file,
                  `${where}: step "${inner.id}" has an each inside the each branch step "${step.id}"`,
                );
              for (const arm of [...(inner.cases ?? []), ...(inner.else ? [inner.else] : [])])
                nested(arm.steps ?? []);
            }
          };
          for (const arm of [...(step.cases ?? []), ...(step.else ? [step.else] : [])])
            nested(arm.steps ?? []);
        }
        for (const ref of Object.keys(step.situational ?? {}))
          if (!this.ruleset.situational(ref, this.scope))
            this.report.error(file, `${where}: unknown situational choice "${ref}"`);
        for (const to of [
          ...(step.kind === 'changes' ? [step.to] : []),
          ...writtenOptions(step).map((o) => o.to),
        ])
          if (typeof to === 'string' && to !== 'self' && to !== 'target' && !declared(to))
            this.report.error(file, `${where}: to names undeclared role "${to}"`);
      }
    };
    walk(action.steps);
  }

  private allocate(step: Step, file: string, where: string): void {
    const matched = new Set(
      // A query that reads the action may offer any field it can't decide.
      fieldsMatching(this.ruleset, this.scope, step.fields?.where, true).filter(
        (def) => def.input && def.type === 'integer',
      ),
    );
    if (matched.size === 0)
      this.report.error(file, `${where}: fields matches no integer input field`);
    if (typeof step.recommend !== 'object') return;
    for (const ref of Object.keys(step.recommend)) {
      const field = this.ruleset.field(ref, this.scope);
      if (!field) this.report.error(file, `${where}: recommend names unknown field "${ref}"`);
      else if (!matched.has(field.def))
        this.report.error(file, `${where}: recommend names "${ref}", which the step doesn't offer`);
    }
  }

  private linkScope(slot: string, file: string, where: string): string[] | undefined {
    const link = this.ruleset.link(slot, this.scope);
    if (!link) {
      this.report.error(file, `${where}: unknown link "${slot}"`);
      return undefined;
    }
    const pack = link.def.pack;
    return pack !== undefined && this.ruleset.packs.has(pack)
      ? this.ruleset.scope(pack)
      : undefined;
  }

  /**
   * A proposed change in an action step, a written option or an option effect. `copies`: whether
   * `entry: picked` names a copy here (a choice step over copies); `rollSteps`: the roll steps a
   * `split` may name.
   */
  private proposedChange(
    change: ProposedChange,
    file: string,
    where: string,
    copies: boolean,
    rollSteps: ReadonlySet<string>,
    to?: Destination,
  ): void {
    // A change sent to a link is the linked character's: its field is checked against the pack the
    // slot names, when the repo has it.
    const linkScope = typeof to === 'object' ? this.linkScope(to.link, file, where) : undefined;
    // A change for a role or target may name a pack the action's pack doesn't see: passed on as
    // written, and checked against that pack when the repo has it.
    const foreign = (ref: string) => {
      const colon = ref.indexOf(':');
      if (typeof to !== 'string' || to === 'self' || colon < 0) return false;
      return !this.scope.includes(ref.slice(0, colon));
    };
    const foreignScope = (ref: string) => {
      const pack = ref.slice(0, ref.indexOf(':'));
      return this.ruleset.packs.has(pack) ? this.ruleset.scope(pack) : undefined;
    };
    if (change.type === 'offerFollowUp') {
      const ref = change.followUp ?? '';
      const local =
        ref.includes(':') && ref.startsWith(`${this.packId}:`)
          ? ref.slice(ref.indexOf(':') + 1)
          : ref;
      const def = this.offerable?.find((fu) => fu.id === local);
      if (!def) this.report.error(file, `${where}: offers unknown follow-up "${ref}"`);
      else if (def.while !== undefined)
        this.report.error(file, `${where}: follow-up "${ref}" is derived (while), never offered`);
    }
    // A computed field is checked when the action runs, for set and adjust only and not with split.
    if (typeof change.field === 'object') {
      if (change.type !== 'set' && change.type !== 'adjust')
        this.report.error(file, `${where}: a computed field is only for set and adjust`);
      if (change.split) this.report.error(file, `${where}: a split adjust's field is written out`);
    } else if (change.field && typeof to === 'object') {
      if (!change.field.includes(':'))
        this.report.error(
          file,
          `${where}: a change sent to a link names its field with the pack ("<pack>:${change.field}")`,
        );
      else if (linkScope) {
        const field = this.ruleset.field(change.field, linkScope);
        if (!field) this.report.error(file, `${where}: unknown linked field "${change.field}"`);
        else if (!field.def.input)
          this.report.error(file, `${where}: "${change.field}" is not an input field`);
      }
    } else if (change.field && foreign(change.field)) {
      const scope = foreignScope(change.field);
      const field = scope ? this.ruleset.field(change.field, scope) : undefined;
      if (scope && !field) this.report.error(file, `${where}: unknown field "${change.field}"`);
      else if (field && !field.def.input)
        this.report.error(file, `${where}: "${change.field}" is not an input field`);
    } else if (change.field) {
      const field = this.ruleset.field(change.field, this.scope);
      if (!field) this.report.error(file, `${where}: unknown field "${change.field}"`);
      else if (!field.def.input)
        this.report.error(file, `${where}: "${change.field}" is not an input field`);
    }
    this.tagList(change.tags, file, where);
    if (change.entry === 'picked' && !copies)
      this.report.error(
        file,
        `${where}: entry: picked is only for the changes of a choice step over copies`,
      );
    // A choice to pick in: choose and unchoose need a path, choose an option too (an unchoose
    // without one removes every pick); nothing else takes them.
    const picks = change.type === 'choose' || change.type === 'unchoose';
    if (picks && change.path === undefined)
      this.report.error(file, `${where}: ${change.type} needs a path`);
    if (change.type === 'choose' && change.option === undefined)
      this.report.error(file, `${where}: choose needs an option`);
    if (!picks && (change.path !== undefined || change.option !== undefined))
      this.report.error(file, `${where}: path and option are only for choose and unchoose`);
    if (change.type === 'setQuantity' && change.value === undefined)
      this.report.error(file, `${where}: setQuantity needs a value`);
    if (change.type === 'adjustQuantity' && change.by === undefined)
      this.report.error(file, `${where}: adjustQuantity needs a by`);
    if (change.copies) {
      const perCopy = [
        'setState',
        'adjustState',
        'setQuantity',
        'adjustQuantity',
        'equip',
        'removeItem',
      ];
      if (!perCopy.includes(change.type))
        this.report.error(file, `${where}: copies is only for per-copy changes`);
      if (change.entry !== undefined)
        this.report.error(file, `${where}: a change has entry or copies, not both`);
      const typeScope =
        typeof to === 'object'
          ? linkScope
          : foreign(change.copies.type)
            ? foreignScope(change.copies.type)
            : this.scope;
      if (typeScope && !this.ruleset.contentType(change.copies.type, typeScope))
        this.report.error(file, `${where}: unknown content type "${change.copies.type}"`);
    }
    if (change.applied) {
      if (!['removeEffect', 'toggleEffect', 'setState', 'adjustState'].includes(change.type))
        this.report.error(
          file,
          `${where}: applied is only for removeEffect, toggleEffect, setState and adjustState`,
        );
      if (change.entry !== undefined || change.id !== undefined || change.copies !== undefined)
        this.report.error(
          file,
          `${where}: a change names its entries by applied or by ID, not both`,
        );
    }
    if (change.type === 'applyEffect' && change.source === undefined)
      this.report.error(file, `${where}: applyEffect needs a source`);
    if (
      change.type !== 'applyEffect' &&
      (change.source !== undefined || change.state !== undefined)
    )
      this.report.error(file, `${where}: source and state are only for applyEffect`);
    if (
      (change.type === 'removeEffect' || change.type === 'toggleEffect') &&
      change.id === undefined &&
      change.applied === undefined
    )
      this.report.error(file, `${where}: ${change.type} needs an id or applied`);
    if (change.type === 'toggleEffect' && change.active === undefined)
      this.report.error(file, `${where}: toggleEffect needs active`);
    if (change.source !== undefined) {
      // A literal source is checked now; a computed one when the action runs.
      const tree = formulaTree(change.source);
      const ref = tree.ok && tree.value.type === 'string' ? tree.value.value : undefined;
      const scope =
        ref === undefined
          ? undefined
          : typeof to === 'object'
            ? linkScope
            : foreign(ref)
              ? foreignScope(ref)
              : this.scope;
      if (ref !== undefined && typeof to === 'object' && !ref.includes(':'))
        this.report.error(
          file,
          `${where}: a change sent to a link names its source with the pack ("<pack>:${ref}")`,
        );
      else if (ref !== undefined && scope) {
        const hit = this.ruleset.item(ref, scope);
        if (!hit) this.report.error(file, `${where}: unknown content "${ref}"`);
        else if (hit.item.type === 'template')
          this.report.error(file, `${where}: "${ref}" is a template`);
      }
    }
    if (change.type === 'equip' && change.equipped === undefined)
      this.report.error(file, `${where}: equip needs equipped`);
    if (change.type !== 'equip' && change.equipped !== undefined)
      this.report.error(file, `${where}: equipped is only for equip`);
    const templated = change.type === 'applyTemplate' || change.type === 'removeTemplate';
    if (templated && change.template === undefined)
      this.report.error(file, `${where}: ${change.type} needs a template`);
    if (!templated && change.template !== undefined)
      this.report.error(file, `${where}: template is only for applyTemplate and removeTemplate`);
    if (change.template !== undefined && typeof to !== 'object') {
      const tree = formulaTree(change.template);
      const ref = tree.ok && tree.value.type === 'string' ? tree.value.value : undefined;
      if (ref !== undefined && !foreign(ref)) {
        const hit = this.ruleset.item(ref, this.scope);
        if (!hit) this.report.error(file, `${where}: unknown content "${ref}"`);
        else if (hit.item.type !== 'template')
          this.report.error(file, `${where}: "${ref}" is not a template`);
      }
    }
    if (typeof change.entry === 'object' && !('formula' in change.entry)) {
      if (change.type !== 'addItem')
        this.report.error(file, `${where}: an entry object is only for addItem changes`);
      const tree = formulaTree(change.entry.item);
      if (
        tree.ok &&
        tree.value.type === 'string' &&
        typeof to !== 'object' &&
        !foreign(tree.value.value)
      ) {
        const hit = this.ruleset.item(tree.value.value, this.scope);
        if (!hit) this.report.error(file, `${where}: unknown content "${tree.value.value}"`);
        else if (hit.item.type === 'template')
          this.report.error(file, `${where}: "${tree.value.value}" is a template`);
      }
      for (const ref of typeof to === 'object' ? [] : (change.entry.templates ?? []))
        if (!this.ruleset.item(ref, this.scope))
          this.report.error(file, `${where}: unknown template "${ref}"`);
    }
    if (change.split) {
      if (change.type !== 'adjust')
        this.report.error(file, `${where}: split is only for adjust changes`);
      if (!rollSteps.has(change.split.roll)) {
        this.report.error(
          file,
          `${where}: split names "${change.split.roll}", which is not a roll step of this action`,
        );
      }
      this.tag(change.split.by, file, where);
    }
  }

  /**
   * An action that can finish with a result but declares none is a warning: its results have no
   * text.
   */
  private results(action: ActionDef, file: string, key: string): void {
    if (Array.isArray(action.results)) {
      for (const result of action.results) this.requiredKeys.add(`${key}.results.${result}.name`);
      return;
    }
    if (action.results) {
      if (!this.ruleset.bands(action.results.bands, this.scope))
        this.report.error(file, `${key}: unknown result bands "${action.results.bands}"`);
      return;
    }
    if (hasOutcome(action.steps))
      this.report.warn(file, `${key}: has an outcome step but declares no results`);
  }

  /**
   * Works out the calculation order of this pack's fields from their formulas, min/max and the
   * rules' always-on effects, and reports loops (`circular-formula`). Effects on content are left
   * out: whether they loop depends on what a character owns, so the engine catches those.
   * `sumFields`, `maxFields` and `minFields` read the fields their filter keeps among those visible
   * from the pack; packs that depend on this one may add more, which the engine checks.
   */
  private calculationOrder(): void {
    const rules = this.ruleset.rules.get(this.packId);
    if (!rules) return;
    const roots = new Set(ALL_ROOTS);
    const visible: FieldView[] = this.scope.flatMap((pid) =>
      [...(this.ruleset.rules.get(pid)?.fields ?? [])].map(([id, { def }]) => ({
        id: `${pid}:${id}`,
        type: def.type,
        tags: (def.tags ?? []).filter((t): t is string => typeof t === 'string'),
      })),
    );
    const reads = (formula: Formula | undefined): string[] => {
      if (formula === undefined) return [];
      const tree = formulaTree(formula);
      if (!tree.ok) return [];
      return [
        ...[...references(tree.value, roots)].map(
          (ref) => this.ruleset.field(ref, this.scope)?.qid ?? ref,
        ),
        ...aggregatedFields(tree.value, visible),
        ...familyFields(tree.value).flatMap((pattern) => {
          const ids = patternIds(pattern, (name) => this.ruleset.family(name, this.scope));
          return (Array.isArray(ids) ? ids : []).flatMap((id) => {
            const qid = this.ruleset.field(id, this.scope)?.qid;
            return qid ? [qid] : [];
          });
        }),
      ];
    };
    const deps = new Map<string, Set<string>>();
    const add = (target: string, from: string[]) => {
      const qid = this.ruleset.field(target, this.scope)?.qid;
      if (!qid) return;
      const set = deps.get(qid) ?? new Set();
      for (const ref of from) set.add(ref);
      deps.set(qid, set);
    };
    for (const [id, { def }] of rules.fields)
      add(id, [...reads(def.formula), ...reads(def.min), ...reads(def.max)]);
    for (const { def } of rules.effects) {
      if (typeof def.target === 'string' && def.op !== 'grant') {
        add(def.target, [...reads(def.value as Formula | undefined), ...reads(def.when)]);
      } else if (typeof def.target === 'object' && 'fields' in def.target) {
        // An effect on a set of fields is one effect per visible field it reaches.
        const from = [...reads(def.value as Formula | undefined), ...reads(def.when)];
        for (const view of visible)
          if (matchesFieldView(def.target.fields.where, view)) add(view.id, from);
      }
    }
    try {
      calculationOrder(deps);
    } catch (error) {
      const fields =
        (error as { error?: { data?: { fields?: string[] } } }).error?.data?.fields ?? [];
      const file =
        rules.fields.get(fields[0]?.split(':')[1] ?? '')?.at ??
        `${this.ruleset.packs.get(this.packId)?.dir}/rules`;
      this.report.error(file, `circular-formula: ${(error as Error).message}`);
    }
  }

  private formulas(): void {
    const problems = checkPackFormulas(this.ruleset, this.packId, {
      onFormula: (text, at, where) => {
        this.onFormula?.(text);
        // Decimal literals keep six places; more aren't what the text says.
        for (const literal of longDecimals(text))
          this.report.warn(
            at,
            `${where}: decimal ${literal} has more than six places; it is rounded to ${roundDecimal(Number(literal))}`,
          );
        // An ID of the pack's own written in full: `@<id>` says it short, and the build checks it.
        for (const id of ownIdStrings(text, this.packId))
          if (this.ruleset.item(id, this.scope) || this.ruleset.field(id, this.scope))
            this.report.warn(at, `${where}: write '${this.packId}:${id}' as @${id}`);
      },
    });
    for (const problem of problems) this.report.error(problem.at, describeProblem(problem));
  }

  private message(file: string, key: string, text: string, names?: Map<string, string>): void {
    if (!balancedBraces(text))
      this.report.error(file, `"${key}": unbalanced braces in ICU message`);
    // One prompt serves every slot of a slotted choice.
    if (this.slotPrompts.has(key) && !/\{\s*slot\s*[,}]/.test(text))
      this.report.warn(file, `"${key}": a slotted choice's prompt should name its slot as {slot}`);
    if (key.endsWith('.description') || (key.endsWith('.block') && this.blocks.has(key))) {
      const html = rawHtml(text);
      if (html)
        this.report.error(
          file,
          `"${key}": a ${key.endsWith('.block') ? 'block' : 'description'} is Markdown without HTML (found "${html}")`,
        );
    }
    this.block(file, key, text, names);
    if (key === 'headline') this.headline(file, text);
  }

  private i18n(): void {
    const pack = this.ruleset.packs.get(this.packId);
    if (!pack) return;
    const language = pack.manifest.defaultLanguage;
    const files = pack.i18n.get(language);
    const manifestFile = `${pack.dir}/pack.yaml`;
    if (!files) {
      this.report.error(manifestFile, `default language "${language}" has no i18n file`);
      return;
    }
    const defaultKeys = new Map<string, string>();
    for (const { file, doc } of files) {
      for (const key of Object.keys(doc)) {
        if (defaultKeys.has(key)) this.report.error(file, `duplicate translation key "${key}"`);
        defaultKeys.set(key, file);
      }
    }
    for (const { file, doc } of files)
      for (const [key, text] of Object.entries(doc)) this.message(file, key, text, defaultKeys);
    const first = files[0]?.file ?? manifestFile;
    for (const key of [...this.requiredKeys].toSorted()) {
      if (!defaultKeys.has(key)) this.report.error(first, `missing translation key "${key}"`);
    }
    const owners = new Set([...this.requiredKeys].map((key) => key.slice(0, key.lastIndexOf('.'))));
    for (const [key, file] of defaultKeys) {
      const owned = owners.has(key.slice(0, key.lastIndexOf('.')));
      const prefixed = [...this.optionalPrefixes].some((prefix) => key.startsWith(prefix));
      if (!this.requiredKeys.has(key) && !this.optionalKeys.has(key) && !owned && !prefixed) {
        this.report.warn(file, `translation key "${key}" does not belong to anything in this pack`);
      }
    }
    for (const [other, otherFiles] of pack.i18n) {
      if (other === language) continue;
      for (const { file, doc } of otherFiles) {
        for (const [key, text] of Object.entries(doc)) {
          if (!defaultKeys.has(key))
            this.report.warn(file, `"${key}" is not in the default language`);
          this.message(file, key, text);
        }
      }
    }
  }
}

/**
 * A raw HTML tag, comment, declaration or processing instruction (CommonMark's raw HTML). An
 * autolink (`<https://…>`) isn't one: its scheme ends in a colon.
 */
const RAW_HTML = /<(?:\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>|!--|![A-Za-z]|\?)/;

export function rawHtml(text: string): string | undefined {
  const prose = text.replace(/^(```|~~~)[^]*?^\1/gm, '').replace(/(`+)[^]*?\1/g, '');
  return RAW_HTML.exec(prose)?.[0];
}

interface BlockScope {
  type: string;
  def: {
    fields?: Record<string, { type: string; values?: readonly string[] }>;
    state?: Record<string, { type: string; values?: readonly string[] }>;
    computed?: Record<string, unknown>;
    texts?: readonly string[];
  };
  own: boolean;
  item?: {
    state?: Record<string, { type: string; values?: readonly string[] }>;
    computed?: Record<string, unknown>;
  };
}

function slotKeys(choice: Choice): [string, Choice][] {
  if (!choice.slots) return [[choice.id, choice]];
  return choice.slots.map((n) => [`${choice.id}-${n}`, choice]);
}

function balancedBraces(text: string): boolean {
  let depth = 0;
  for (const ch of text.replace(/'[^']*'/g, '')) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

export class CharacterChecker {
  private scope: string[] = [];

  constructor(
    private readonly ruleset: Ruleset,
    private readonly report: Reporter,
  ) {}

  run(character: CharacterDoc, file: string): void {
    const error = (message: string) => this.report.error(file, message);
    const [major, minor] = SPEC_VERSION.split('.');
    if (!character.specVersion.startsWith(`${major}.${minor}.`)) {
      this.report.warn(
        file,
        `written for spec ${character.specVersion}, validator implements ${SPEC_VERSION}`,
      );
    }

    const pinned = new Set<string>();
    for (const { id, version } of character.packs) {
      const pack = this.ruleset.packs.get(id);
      if (!pack) error(`pins unknown pack "${id}"`);
      else if (pack.manifest.version !== version) {
        error(`pins ${id} ${version}, but the pack is ${pack.manifest.version}`);
      }
      pinned.add(id);
    }
    for (const id of pinned) {
      for (const dep of Object.keys(this.ruleset.packs.get(id)?.manifest.dependencies ?? {})) {
        if (!pinned.has(dep)) error(`pack "${id}" needs "${dep}", which is not pinned`);
      }
    }
    // Later packs win, so look them up first. The homebrew is looked up first.
    this.scope = [
      ...(character.homebrew ? [HOMEBREW] : []),
      ...character.packs.map((p) => p.id).toReversed(),
    ];

    for (const [ref, value] of Object.entries(character.values ?? {})) {
      const field = this.ruleset.field(ref, this.scope);
      if (!field) error(`values: unknown field "${ref}"`);
      else if (!field.def.input) error(`values: "${ref}" is derived and must not be saved`);
      else {
        this.literal(value, field.def, file, `values.${ref}`);
        if (field.def.type === 'set' && field.def.of === 'tag' && Array.isArray(value)) {
          const declared = this.ruleset.declaredTags(this.scope);
          for (const tag of value) {
            if (!declared.has(String(tag)))
              error(`values.${ref}: unknown-tag: "${tag}" is not declared`);
            else if (!admitsTag(field.def.members, String(tag)))
              error(`values.${ref}: "${tag}" is not one of its members`);
          }
        }
      }
    }

    for (const ref of Object.keys(character.links ?? {}))
      if (!this.ruleset.link(ref, this.scope)) error(`links: unknown link slot "${ref}"`);

    const ids = new Set<string>();
    const claim = (id: string) => {
      if (ids.has(id)) error(`duplicate instance id "${id}"`);
      ids.add(id);
    };
    for (const [list, entries] of [
      ['features', character.features ?? []],
      ['inventory', character.inventory ?? []],
    ] as const) {
      for (const entry of entries) {
        claim(entry.id);
        const where = `${list}[${entry.id}]`;
        const content = this.content(entry.item, file, where);
        if (!content) continue;
        const typeName = this.ruleset.typeOf(content);
        const type = typeName ? this.ruleset.contentType(typeName, this.scope)?.def : undefined;
        if (!type) {
          error(`${where}: "${entry.item}" has no usable content type`);
          continue;
        }
        if (Boolean(type.carried) !== (list === 'inventory')) {
          error(`${where}: ${typeName} belongs in ${type.carried ? 'inventory' : 'features'}`);
        }
        if (entry.equipped !== undefined && !type.equippable)
          error(`${where}: ${typeName} is not equippable`);
        const stateDecls: Record<string, ValueDecl> = { ...type.state, ...content.item.state };
        const owners: ContentEntry[] = [content];
        for (const ref of entry.templates ?? []) {
          const template = this.content(ref, file, where);
          if (!template) continue;
          if (template.item.type !== 'template') {
            error(`${where}: "${ref}" is not a template`);
            continue;
          }
          const targets = appliesQueries(template.item).map((q) => q.type);
          if (targets.length > 0 && !targets.includes(typeName as string))
            error(`${where}: template "${ref}" applies to ${targets.join(', ')}, not ${typeName}`);
          Object.assign(stateDecls, template.item.state);
          owners.push(template);
        }
        for (const [key, value] of Object.entries(entry.state ?? {})) {
          const decl = stateDecls[key];
          if (!decl) error(`${where}: unknown state key "${key}"`);
          else this.literal(value, decl, file, `${where}.state.${key}`);
        }
        this.tree(entry.choices ?? {}, this.choicesOf(owners), file, where);
      }
    }

    for (const applied of character.applied ?? []) {
      claim(applied.id);
      this.content(applied.source, file, `applied[${applied.id}]`);
    }

    // A `while` follow-up is derived, never stored.
    const stored = new Set<string>();
    for (const entry of character.followUps ?? []) {
      const where = `followUps[${entry.id}]`;
      if (stored.has(entry.id)) error(`${where}: duplicate follow-up id`);
      stored.add(entry.id);
      const def = this.followUpDef(entry.followUp);
      if (!def) error(`${where}: unknown follow-up "${entry.followUp}"`);
      else if (def.while !== undefined)
        error(`${where}: "${entry.followUp}" is a derived offer (while), which is never stored`);
    }

    const rulesChoices = new Map<string, Choice>();
    for (const pid of this.scope) {
      for (const { def } of this.ruleset.rules.get(pid)?.choices.values() ?? []) {
        for (const [id, choice] of slotKeys(def))
          if (!rulesChoices.has(id)) rulesChoices.set(id, choice);
      }
    }
    this.tree(character.choices ?? {}, rulesChoices, file, 'choices');
  }

  /** A follow-up by its listed ID: `<pack>:<id>` (rules) or `<content or type>#<id>`. */
  private followUpDef(ref: string): FollowUp | undefined {
    const hash = ref.indexOf('#');
    if (hash < 0) {
      const colon = ref.indexOf(':');
      const rules = this.ruleset.rules.get(ref.slice(0, colon));
      return rules?.followUps.find((fu) => fu.def.id === ref.slice(colon + 1))?.def;
    }
    const owner = ref.slice(0, hash);
    const id = ref.slice(hash + 1);
    const item = this.ruleset.content.get(owner)?.item;
    if (item) return item.followUps?.find((fu) => fu.id === id);
    const colon = owner.indexOf(':');
    const type = this.ruleset.rules
      .get(owner.slice(0, colon))
      ?.contentTypes.get(owner.slice(colon + 1));
    return type?.def.followUps?.find((fu) => fu.id === id);
  }

  private content(ref: string, file: string, where: string): ContentEntry | undefined {
    const hit = this.ruleset.content.get(ref);
    if (!hit) this.report.error(file, `${where}: unknown content "${ref}"`);
    else if (!this.scope.includes(hit.pack))
      this.report.error(file, `${where}: pack of "${ref}" is not pinned`);
    return hit;
  }

  /**
   * Choices whose picks live in one tree: the tree's own item uses bare choice IDs; templates and
   * granted content use `<qualified owner id>/<choice id>`.
   */
  private choicesOf(owners: ContentEntry[]): Map<string, Choice> {
    const result = new Map<string, Choice>();
    const seen = new Set<string>();
    const visit = (entry: ContentEntry, own: boolean) => {
      if (seen.has(entry.qid)) return;
      seen.add(entry.qid);
      for (const [id, choice] of (entry.item.choices ?? []).flatMap(slotKeys))
        result.set(own ? id : `${entry.qid}/${id}`, choice);
      const typeName = this.ruleset.typeOf(entry);
      const typeGrants = typeName
        ? (this.ruleset.contentType(typeName, this.ruleset.scope(entry.pack))?.def.grants ?? [])
        : [];
      for (const grant of [...typeGrants, ...(entry.item.grants ?? [])]) {
        // A grant of applied content isn't held, so its choices aren't the copy's.
        if (grant.scope === 'applied' || typeof grant.item !== 'string') continue;
        const granted = this.ruleset.item(grant.item, this.ruleset.scope(entry.pack));
        if (granted) visit(granted, false);
      }
    };
    owners.forEach((owner, i) => visit(owner, i === 0));
    return result;
  }

  private tree(tree: ChoiceTree, allowed: Map<string, Choice>, file: string, where: string): void {
    for (const [choiceId, picks] of Object.entries(tree)) {
      const choice = allowed.get(choiceId);
      const path = `${where}.choices.${choiceId}`;
      if (!choice) {
        this.report.error(file, `${path}: no such choice here`);
        continue;
      }
      const max = typeof choice.pick === 'object' ? choice.pick.max : (choice.pick ?? 1);
      if (typeof max === 'number' && picks.length > max) {
        this.report.error(file, `${path}: ${picks.length} picks, at most ${max} allowed`);
      }
      for (const pick of picks) {
        const nested = this.option(choice, pick.option, file, path);
        if (nested) this.tree(pick.choices ?? {}, nested, file, `${path}[${pick.option}]`);
        if (pick.state) {
          const hit =
            typeof pick.option === 'string' ? this.ruleset.content.get(pick.option) : undefined;
          const typeName = hit ? this.ruleset.typeOf(hit) : undefined;
          const typeDef = typeName
            ? this.ruleset.contentType(typeName, this.ruleset.scope(hit?.pack ?? ''))?.def
            : undefined;
          const decls = { ...typeDef?.state, ...hit?.item.state };
          for (const [key, value] of Object.entries(pick.state)) {
            const decl = decls[key];
            if (!decl)
              this.report.error(file, `${path}[${pick.option}]: unknown state key "${key}"`);
            else this.literal(value, decl, file, `${path}[${pick.option}].state.${key}`);
          }
        }
      }
    }
  }

  private option(
    choice: Choice,
    option: string | number,
    file: string,
    where: string,
  ): Map<string, Choice> | undefined {
    const from = choice.from;
    const bad = (why: string) => {
      this.report.error(file, `${where}: invalid option "${option}" (${why})`);
      return undefined;
    };
    if ('values' in from) {
      // A computed list depends on the character: any string or number.
      if (!Array.isArray(from.values)) return new Map();
      return from.values.includes(option) ? new Map() : bad('not a listed value');
    }
    if ('options' in from) {
      const inline = from.options.find((o) => o.id === option);
      return inline
        ? new Map((inline.choices ?? []).flatMap(slotKeys))
        : bad('not an inline option');
    }
    if (typeof option !== 'string') return bad('expected a content id');
    const hit = this.ruleset.content.get(option);
    if (!hit) return bad('unknown content');
    if ('items' in from) {
      const listed = from.items.some((ref) => this.ruleset.item(ref, this.scope)?.qid === option);
      if (!listed) return bad('not in the listed items');
    } else if (this.ruleset.typeOf(hit) !== from.type) {
      return bad(`not a ${from.type}`);
    }
    if (choice.activate === false) return new Map();
    return this.choicesOf([hit]);
  }

  private literal(value: Literal, decl: ValueDecl, file: string, where: string): void {
    const bad = (expected: string) =>
      this.report.error(file, `${where}: expected ${expected}, got ${JSON.stringify(value)}`);
    switch (decl.type) {
      case 'integer':
        if (!Number.isInteger(value)) return bad('a whole number');
        break;
      case 'decimal':
        if (typeof value !== 'number') return bad('a number');
        break;
      case 'boolean':
        if (typeof value !== 'boolean') return bad('true or false');
        break;
      case 'string':
      case 'dice':
      case 'id':
        if (typeof value !== 'string') return bad('a string');
        break;
      case 'enum':
        if (typeof value !== 'string' || !decl.values?.includes(value))
          return bad(`one of ${decl.values?.join(', ')}`);
        break;
      case 'set':
        if (!Array.isArray(value)) return bad('a list');
        break;
    }
    if (typeof value === 'number') {
      if (typeof decl.min === 'number' && value < decl.min) bad(`at least ${decl.min}`);
      if (typeof decl.max === 'number' && value > decl.max) bad(`at most ${decl.max}`);
    }
  }
}

function ownIdStrings(text: string, packId: string): string[] {
  if (!text.includes(`${packId}:`)) return [];
  const tree = parse(text);
  if (!tree.ok) return [];
  const out: string[] = [];
  const visit = (node: Node): void => {
    if (node.type === 'string' && node.value.startsWith(`${packId}:`))
      out.push(node.value.slice(packId.length + 1));
    for (const child of children(node)) visit(child);
  };
  visit(tree.value);
  return out;
}

function familyFields(tree: Node): { text: string; names: string[] }[] {
  const out: { text: string; names: string[] }[] = [];
  const visit = (node: Node): void => {
    if (node.type === 'call' && node.fn === 'fieldOf' && node.args[0]) {
      const pattern = familyPattern(node.args[0]);
      if (pattern) out.push(pattern);
    }
    for (const child of children(node)) visit(child);
  };
  visit(tree);
  return out;
}

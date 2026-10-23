// Generated from packages/spec/schemas by `pnpm types`. Do not edit.
// See scripts/types/generate.ts for what is and isn't carried over from the schemas.

/** Something a character can do that needs dice or decisions: a cascade of steps. Each roll or choice step is a checkpoint where, per the app's policy, the engine continues automatically or pauses. Later steps see earlier results as `steps.<id>.*` and branch flags as `flags.<name>`; the item making the action is `item` (base plus templates) and its copy is `self`; app-supplied parameters are `params.<name>`; situational choices are `situational.<id>`; other characters taking part are `participants.<role>` (and, in an `each` step, `participant`). Where `item` and `self` are rebound (a choice step's candidates, a formula a change passes on), the action's own are `action.item` and `action.self`, and the current step is `action.step`. */
export type Action = {
  id: Slug;
  tags?: Tags;
  /** When the action is offered, e.g. `self.equipped`. */
  available?: Condition;
  /** Values the app supplies when starting the action (a target's AC, which stat to test). */
  params?: Record<string, ValueDecl>;
  /** Other characters the action involves, by role: a target, a helper. `startAction` takes each role's characters as views (`{ id, values }`) that the app takes from their own sheets; formulas read them as `participants.<role>`, a list in input order. A role the action doesn't declare, or a count outside `min`/`max`, is `invalid-participants`. Text: `<actionKey>.participants.<role>.name` (optional). */
  participants?: Record<string, Role>;
  steps: Steps;
  /** The outcome results the action can finish with: a list of result IDs, named by `<actionKey>.results.<result>.name`, or `{ bands: <set> }` when its results are that band set's band IDs, named by `bands.<set>.<band>.name`. An outcome `result` that isn't declared is the action error `undeclared-result`. An action without `results` isn't checked. */
  results?:
    | Slug[]
    | {
        /** A result-band set declared in the rules (`resultBands`). */
        bands: Slug;
      };
  label?: I18nKey;
  scope?: ActionScope;
};

/** On content (a content type's or an item's actions): `holder` (default) lists the action for a character who has the content active, with its copy as `self`; `applied` lists it for each active entry of the character's `applied` list whose source is the content, with the entry's ID as `entry` and the entry (`id` and its state keys) as `self`. Not allowed on the rules' actions. */
export type ActionScope = 'holder' | 'applied';

export type ActionOrUse =
  | Action
  | {
      use: Ref;
      params?: Record<string, Formula>;
      scope?: ActionScope;
    };

export type Steps = Step[];

export type Step =
  | RollStep
  | ChoiceStep
  | AllocateStep
  | BranchStep
  | ChangesStep
  | ActionStep
  | OutcomeStep;

/** Which character the step's formulas read. `given` (the default): the character as passed to the action. `proposed`: the character with every change the action has proposed so far `to: self` applied in order (from earlier steps, nested actions, a parent action and earlier picks of this step), computed afresh before the step, `when` included, and before each pick of a choice step. Fields, `character`, `self` and `item` (the action's own copy there, absent if a change removed it), a choice step's candidates, an allocate step's fields and a roll step's parts and roll effects all read it; `params`, `situational`, `participants`, `links`, `flags` and `steps` don't change. Changes for a role, a target or a link are never applied, nor are follow-ups. A batch that fails is the error `proposed-changes-failed`. */
export type StepSheet = 'given' | 'proposed';

/** A dice checkpoint. Each part becomes one roll item (one source per item); roll effects matching the step's tags add more items or modify the dice. Results: `steps.<id>.total`, `.dice` (per dice item: `faces`, `kept`), `.band`. With `of` instead of `parts`, it rolls nothing and classifies an earlier roll again by its own `bands`. */
export type RollStep = {
  /** Step ID, unique within the action. Identifier-safe because formulas read results as `steps.<id>`. */
  id: Name;
  kind: 'roll';
  when?: Condition;
  sheet?: StepSheet;
  /** Run the step once per participant of this declared role, in input order, with `participant` bound and `when` evaluated per participant. With none, the step doesn't run. Its result is a list in participant order (null where `when` skipped one); inside a later `each` step over the same role, it is the current participant's. Log paths gain the index (`saves[1]`). */
  each?: Name;
  /** Tags of the roll; entries may be formulas. */
  tags?: TagList;
  parts?: RollPart[];
  /** Classify an earlier roll again instead of rolling: the path of a roll step of this action as the log names it, relative to the action (`check/roll`, the roll of the nested action step `check`). The step's result is that roll's (total, faces, kept, items, tallies, bounds), with the band its own `bands` gives in its own context: its flags, and with `each` the current participant and that participant's flags. In an `each` step, a path whose first step is an `each` step over the same role names that step's run for the current participant. A roll that didn't run leaves the step without a result. Not a checkpoint: nothing is asked or recorded. */
  of?: string;
  /** Which results are better, for advantage/disadvantage: `high` (default) or `low` (roll-under games). */
  better?: 'high' | 'low';
  /** A result-band set declared in the rules (`resultBands`); the first matching band becomes `steps.<id>.band`. */
  bands?: Slug;
  /** The roll's name ("Damage"). Default key: `<actionKey>.steps.<id>.name`, optional in the default language; an explicit key is required. */
  label?: I18nKey;
};

/** One roll item: dice, a flat value, or the value of a field chosen by formula. Exactly one of `dice`, `value`, `field`. */
export type RollPart = {
  id?: Slug;
  dice?: DiceFormula;
  value?: Formula;
  /** A formula evaluating to a field ID; the item's value is that field's value and its source is that field (e.g. Strength or Dexterity modifier for a finesse weapon). */
  field?: Formula;
  /** Defaults: a `value` that is a single field reference gets that field as its source; otherwise the item or rules the action belongs to. */
  source?: Source;
  /** Tags of this part's roll item (`damage.slashing`); entries may be formulas. */
  tags?: TagList;
  when?: Condition;
  /** dice parts only: what to roll instead when the part ends up with no dice after pool dice are added (FitD: zero dice rolls 2d6 and keeps the lowest). */
  ifEmpty?: DiceFormula;
  /** `false`: neither `multiplyDice` nor `multiply` changes this part's items, which record `multiplied: false`. Default `true`. */
  multiplied?: false;
};

/** A choice checkpoint (hit or miss, use a reaction, push the roll, which class regains a hit die). Its options come from one source: a written list, the ruleset's content of a type (`{ content }`), the character's copies of a type (`{ copies }`), a list of values (`{ values }`), or the choices pending on the proposed sheet (`{ pending }`). Active content adds options to a step with `tags` through `option` effects; an added option's ID is `<content id>#<option id>`. Result: `steps.<id>.picked`, the option ID (with `repeat`, the list of picked IDs); for content and copies without `repeat`, also `steps.<id>.item` (and `.self` for copies); for values without `repeat`, `steps.<id>.value`. */
export type ChoiceStep = {
  /** Step ID, unique within the action. Identifier-safe because formulas read results as `steps.<id>`. */
  id: Name;
  kind: 'choice';
  when?: Condition;
  sheet?: StepSheet;
  /** Run the step once per participant of this declared role, in input order, with `participant` bound and `when` evaluated per participant. With none, the step doesn't run. Its result is a list in participant order (null where `when` skipped one); inside a later `each` step over the same role, it is the current participant's. Log paths gain the index (`saves[1]`). */
  each?: Name;
  /** Tags of the step; entries may be formulas. `option` effects aimed at `{ choices: [<tag>] }` add options to a step carrying a matching tag, and policy rules match it by tag. The step's evaluated tags are `action.step.tags`. */
  tags?: TagList;
  /** Where the options come from: exactly one source. A written list offers the options whose `when` holds (option ID: the written `id`; name: `<actionKey>.options.<id>.name`). `{ content }` offers the ruleset's content of a type, in content order (option ID: the qualified content ID; name: the item's name). `{ copies }` offers the character's copies of a type, inventory then features (option ID: the instance ID; name: the copy's item name). `{ values }` offers plain values, written out or from a list formula (option ID: the value as a string; name: `<actionKey>.options.<value>.name` when the pack has it, else the app names it). `{ pending }` asks the choices still pending on the proposed sheet, one pick at a time (option ID: the option as `listOptions` names it; name: the choice's own text). On a step with `tags`, matching `option` effects add options after these. */
  options:
    | {
        id: Slug;
        /** The option is offered only when this holds. `picks` is how many times this step has already picked it. */
        when?: Condition;
        /** Changes proposed when this option is picked, resolved like a `changes` step's at this step's path and appended before the step's own `changes`. Their formulas see `picked` (`{ id }`). */
        changes?: ProposedChange[];
        /** Who the option's `changes` are for, as a `changes` step's `to`. Default `self`. */
        to?: Destination;
        /** Flags set when this option is picked, as a branch case's: each formula is evaluated with `picked` bound and set as `flags.<name>`, in order, before the option's `changes`, so they and every later step read it. A flag already set is replaced; with `repeat`, each pick sets its flags in turn. */
        flags?: OptionFlags;
      }[]
    | {
        content: ChoiceQuery;
      }
    | {
        copies: ChoiceQuery;
      }
    | {
        /** The values to pick from: a list written out, or a formula giving a list of strings or numbers, evaluated with the action's roots before each pick (so it may read earlier steps, `item` and `self`). Each value is offered once, in the list's order, as its string form (option ID); a formula that fails is an error, as any action formula is, and an element that isn't a string or number is `type-mismatch`. */
        values:
          | (string | number)[]
          | {
              formula: Formula;
            };
        /** A condition over each candidate, bound as `value`, with `picks` how many times this step has picked it. `item` and `self` stay the action's own. */
        where?: Condition;
      }
    | {
        /** The choices still pending on the proposed sheet, in `computeSheet`'s `pending` order. Each pick answers the first of them with an eligible option not picked yet, offering those options as `listOptions` gives them, then `#done`; it proposes the `choose` for it, then the step's `changes`. The step reads the proposed sheet before each pick and goes on until nothing more can be picked or `#done` is picked. Result: `steps.<id>.picked`, the picked option IDs in order, and `steps.<id>.paths`, their choice paths. */
        pending: {
          /** String formula giving an instance ID: only choices whose path starts at that copy are asked. Without it, every pending choice is, rules-level ones included. */
          entry?: Formula;
        };
      };
  /** Pick more than once: the step is asked again, each pick its own checkpoint, until it has `max` picks or nothing is offered. After `min` picks the reserved option `#done` is offered last, which ends the step. An option may be picked again unless its `when` or `where` rules it out (they read `picks`). */
  repeat?: {
    /** Integer formula: the most picks. Evaluated once, before the first pick. */
    max: Formula;
    /** Integer formula: the picks needed before `#done` is offered (default 0). Evaluated once, before the first pick. */
    min?: Formula;
  };
  /** Formula naming the recommended option ID; it may read `options`, the list of IDs the step's own source offers (`#done` and added options left out). Under an automatic policy the engine takes it. `#done` and added options are never recommended. Without it, a `content`, `copies` or `values` step recommends the candidate with the highest `prefer`; with neither, no option is recommended, so an automatic run pauses there. Over pending choices, it also sees `choice`, the choice being asked (`{ path, owner, id }`); without it, the option `listOptions` marks recommended is. */
  recommend?: Formula;
  /** Boolean formula, evaluated before each pick with `options` (and, over pending choices, `choice`) bound as for `recommend`: when it holds, the engine draws one die with as many sides as the source's offered options (added options and `#done` left out; over pending choices, the asked choice's eligible options) and recommends option face − 1 instead of `recommend` and `prefer`. With one option nothing is drawn. The draw is a dice checkpoint at the step's path, following the dice policy for the step's tags: a pause is `needs.kind: dice` with one die and `draw`. A creation action says `random: params.random`. */
  random?: Formula;
  /** `content`, `copies` and `values` only: a number formula per candidate, with `item` (and `self`) the candidate's, or `value` the candidate value, and `picks` how many times this step has picked it. Without `recommend`, the candidate with the highest value is recommended, ties going to the earlier one. */
  prefer?: Formula;
  /** Changes proposed after every pick, after the picked option's own `changes`, resolved like a `changes` step's at this step's path, always `to: self`. `entry: picked` names the picked copy (`copies` only). Their formulas see `picked`: `{ id }`, plus `item` for content and copies, `self` for copies and `value` (the value itself) for values; `item` and `self` stay the action's own. Over pending choices, `picked` is `{ id, path }`, the option and the choice path, and the `choose` comes first. */
  changes?: ProposedChange[];
  /** The question ("Did the attack hit?"). Default key: `<actionKey>.steps.<id>.prompt`. */
  prompt?: I18nKey;
};

/** A choice step's query source: a content type, qualified against the action's pack, and an optional condition per candidate. In `where`, `item` is the candidate's item (and `self` its copy, for `copies`), `picks` is how many times the step has picked it, and the action's own item, copy and step are `action.item`, `action.self` and `action.step`. */
export type ChoiceQuery = {
  type: TypeRef;
  where?: Condition;
};

/** An allocation checkpoint: spend a budget across fields (FitD's four action dots, 5E point buy), or give each of a list of values to a different field (5E's standard array). Under an automatic policy the engine takes `recommend`; without a usable recommendation the step pauses (`needs.kind: allocate`) and the app answers with `amounts`, a map of field ID to amount. Result: `steps.<id>.amounts`. A budget step proposes one `adjust` per field with a non-zero amount, a values step one `set` per field given a value, in the fields' order. */
export type AllocateStep = {
  id: Name;
  kind: 'allocate';
  when?: Condition;
  sheet?: StepSheet;
  /** Tags of the step; entries may be formulas. Policy rules match the step by them. */
  tags?: TagList;
  /** The fields to allocate to: a query over fields (`type: field`), whose `where` sees each field as `item` (`id`, `type`, `tags`) and the action's context (`steps`, `params`, `flags`, …), the action's own item and copy as `action.item` and `action.self`. Offered are the integer input fields that match, in the ruleset's field order. */
  fields: {
    type: 'field';
    where?: Condition;
  };
  /** Integer formula: the total to spend. Exactly one of `budget` and `values`. */
  budget?: Formula;
  /** `all` (the default): the amounts' total cost must be exactly the budget. `upTo`: at most the budget. */
  spend?: 'all' | 'upTo';
  /** Integer formula per field, with `field` bound to `{ id, value }` (the field's computed value before the step): the most that field can take. An amount may never take the field's input value past its `max`; `limit` only narrows that (the smaller applies). Default: no limit but the `max`. */
  limit?: Formula;
  /** Integer formula per field with a non-zero amount, with `field` and `amount` bound: the budget the amount costs (5E point buy: `[0, 1, 2, 3, 4, 5, 7, 9][amount]`). Default: `amount`. */
  cost?: Formula;
  /** Instead of `budget`: integer formulas, the values to hand out (`[15, 14, 13, 12, 10, 8]`). Each value goes to a different field and every value is used exactly once; a field gets at most one. `spend`, `limit` and `cost` don't apply. */
  values?: Formula[];
  /** Boolean formula: when it holds, the engine recommends a random answer instead of `recommend`. With `values`, each value in order goes to a field drawn uniformly among the offered fields not given one yet. With a budget, one unit at a time goes to a field drawn uniformly among those that can take one more (within its limit, the unit's added cost positive and within what is left), until the budget is spent or no field can take more; with `spend: all`, a draw that leaves some of the budget unspent gives no recommendation. Each draw is a dice checkpoint at the step's path, as on a choice step. */
  random?: Formula;
  /** The recommended amounts: by field ID (local or qualified), an integer formula. Fields left out get nothing. Used only when it is a valid answer. */
  recommend?: Record<string, Formula>;
  /** The question. Default key: `<actionKey>.steps.<id>.prompt`. */
  prompt?: I18nKey;
};

/** Picks the first case whose `when` is true (else `else`), sets its flags and runs its steps. */
export type BranchStep = {
  /** Step ID, unique within the action. Identifier-safe because formulas read results as `steps.<id>`. */
  id: Name;
  kind: 'branch';
  when?: Condition;
  sheet?: StepSheet;
  /** Run the step once per participant of this declared role, in input order, with `participant` bound and `when` and the cases evaluated per participant. Its flags are kept per participant: inside a later `each` step over the same role, and in its own case steps, `flags.<name>` is the current participant's value (absent when it has none); elsewhere it is the list in participant order (null where none was set). Its case steps run per participant too, their results lists as an `each` step's; they may not have an `each` of their own. */
  each?: Name;
  cases: ({
    when: Condition;
  } & BranchArm)[];
  else?: BranchArm;
};

/** Flags a choice option sets when picked: flag name to formula. */
export type OptionFlags = Record<string, Formula>;

export type BranchArm = {
  id?: Slug;
  flags?: Record<string, Formula>;
  steps?: Steps;
};

/** Proposes changes for the app to apply with applyChanges (spend a shot, gain stress, deal damage). Changes `to` another character are for the app to route. With `release`, it proposes changes `hold` action steps held first. With `tags`, content's `changes` effects aimed at a matching tag add their changes after the step's own. It needs `changes`, `release` or `tags`: a step with only `tags` is a place content adds to. */
export type ChangesStep = {
  /** Step ID, unique within the action. Identifier-safe because formulas read results as `steps.<id>`. */
  id: Name;
  kind: 'changes';
  when?: Condition;
  sheet?: StepSheet;
  /** Run the step once per participant of this declared role, in input order, with `participant` bound and `when` evaluated per participant. With none, the step doesn't run. Its result is a list in participant order (null where `when` skipped one); inside a later `each` step over the same role, it is the current participant's. Log paths gain the index (`saves[1]`). */
  each?: Name;
  to?: Destination;
  /** Tags of the step; entries may be formulas, evaluated when the step runs, and tags an `action` step running this action adds count too. Content's `changes` effects aimed at a matching tag (`target: { steps: [<tag>] }`) add their changes after the step's own. Static tags must be declared. */
  tags?: TagList;
  changes?: ProposedChange[];
  /** Propose changes `hold` action steps of this action hold, before the step's own `changes`: each listed step's, in the listed order, each in the order held. A change is released when `where` holds, with `change` bound to it as the action would return it (`type`, `field`, `by`, `tags` (`[]` when it has none), …); one it leaves stays held, for a later release. With `combine`, released `adjust` changes equal in everything but `by`, recipient included, become one in the first one's place with `by` summed. Released changes keep the `step` path they were proposed at. A step that names no `hold` action step is `unknown-reference` (kind `step`) at load. Not with `each`. */
  release?: {
    /** IDs of `action` steps of this action with `hold: true`. */
    steps: Name[];
    /** Which held changes to release: a condition with `change` bound to each. Default: all. */
    where?: Condition;
    /** Merge released `adjust` changes that differ only in `by` (amounts summed). Default false. */
    combine?: boolean;
  };
};

/** Runs another action as part of this one (a failed save triggering a panic check). With `as: participant`, the participant runs it instead (a handoff). */
export type ActionStep = {
  /** Step ID, unique within the action. Identifier-safe because formulas read results as `steps.<id>`. */
  id: Name;
  kind: 'action';
  when?: Condition;
  sheet?: StepSheet;
  /** Run the step once per participant of this declared role, in input order, with `participant` bound and `when` evaluated per participant. With none, the step doesn't run. Its result is a list in participant order (null where `when` skipped one); inside a later `each` step over the same role, it is the current participant's. Log paths gain the index (`saves[1]`). */
  each?: Name;
  /** The action to run: a rules action, or with `source` one the content's type or the content itself defines, or with `entry` and no `source` one the copy's item or its type defines (its local action ID, when no rules action has that ID). */
  use: Ref;
  /** A formula giving a content ID, qualified against the action's pack. The step runs `use` as `computeSheet` lists it for this character with that `source`: with that content as `item` and the listing's `entry` as `self`. With no such listing (the action not available included) the action fails with `unknown-action` (data: `action`, `source`). */
  source?: Formula;
  /** A formula giving an instance ID, such as a choice step's `steps.weapon.picked`. The step runs `use` as `computeSheet` lists it, on the step's sheet, with that `entry` (and that `source`, when given too): that copy is `self` and its item `item`. Without `source`, a local `use` names the copy's item's own action (`<item>#<use>`). With no such listing (no such copy, the copy doesn't list the action, or its `available` is false) the action fails with `unknown-action` (data: `action`, `entry`, and `source` when given). Not with `as`. */
  entry?: Formula;
  /** Keep what the nested action proposes instead of proposing it: every change it and the actions it runs propose is resolved as usual and held under the step, in order (with `each`, every run's, in run order). The nested action's own steps see them; the parent's later steps don't until a changes step's `release` names the step. Held changes never released are dropped. Not with `as`. */
  hold?: boolean;
  /** Formulas for the used action's parameters. One giving `null` leaves the parameter out: an optional one takes its default or stays absent, a required one is `missing-param`. A field parameter given a field parameter's view takes its `id`. */
  params?: Record<string, Formula>;
  /** Participants passed on to the used action's roles: each a formula giving a list of participant IDs (`[participants.target[0].id]`) or of their views (`participants.target`), mixed or not, a view passed on by its `id`; each a participant of this action in any role (`invalid-participants` otherwise, data: `role`). The nested action reads the participant's view as the app passed it, with its own declared fields; its roles' `min` and `max` apply. Without it, the nested action has no participants. On a handoff (`as`) it may also name the running character by `character.id`; the IDs are listed in `needs.run.participants` and the app passes their views to the run. */
  participants?: Record<string, Formula>;
  /** Values for the used action's situational choices, by situational choice ID (local IDs resolve in the action's pack; an unknown one is `unknown-reference`, kind `situational`, at load): each a formula evaluated here. They replace the values the running action has (the app's, or a parent's) for the used action and the actions it runs in turn, as if the app had selected them; the choices' own effects apply as for any selected choice. Not with `as`: a participant's player answers their own. */
  situational?: Record<string, Formula>;
  /** Tags added to the evaluated tags of every roll step and choice step of the used action, and of the actions it runs in turn; entries may be formulas, evaluated here. Roll effects, situational choices, added options and policy rules match them as the step's own. Not with `as`. */
  tags?: TagList;
  /** `participant`: hand the step off. The action pauses (`needs.kind: handoff`), the app runs the used action on the current participant's own character and answers with its outcome, which the step's result holds. Only in an `each` step. */
  as?: 'participant';
};

/** Ends the action with an outcome ID and data for the app. */
export type OutcomeStep = {
  /** Step ID, unique within the action. Identifier-safe because formulas read results as `steps.<id>`. */
  id: Name;
  kind: 'outcome';
  when?: Condition;
  sheet?: StepSheet;
  result: Formula;
  data?: Record<string, Formula>;
};

/** Who proposed changes are for: `self` (the actor), `target` (another character the app picks, or the action's `target` participants), a declared role, or `{ link: <slot> }`, the character filling one of the actor's link slots. The app applies each to that character. A change for a role names its participant in `character`: the current one in an `each` step over the role, else one copy per participant. A change sent to a link names fields and content by qualified ID, since they are the linked character's. */
export type Destination =
  | Name
  | {
      link: Name;
    };

/** A role other characters fill in this action. Every role is optional unless `min` says otherwise. */
export type Role = {
  /** The fewest characters in the role (default 0). */
  min?: number;
  /** The most characters in the role (default unbounded). */
  max?: number;
  /** The pack the participants are expected to use, as a link slot's `pack`: only the build checks the declared fields against it, or against the action's own pack without one. Any character whose view has the declared fields may fill the role. */
  pack?: PackId;
  /** The fields read from each participant's view, declared as a link slot's are, or the name of a `viewFields` set. A role without fields gets views of only `id`. */
  fields?: DeclaredFields | ViewFieldsRef;
};

/** One change to a character, from the fixed set of change types (kept in sync with `data/change-types.json`). applyChanges takes a batch and applies all of it or none of it. A change failing this schema is a shape error; one that fails against the character and ruleset is a runtime error. */
export type Change =
  | SetChange
  | AdjustChange
  | AddItemChange
  | RemoveItemChange
  | EquipChange
  | SetStateChange
  | AdjustStateChange
  | SetQuantity
  | AdjustQuantity
  | TemplateChange
  | ApplyEffectChange
  | RemoveEffectChange
  | ToggleEffectChange
  | ChooseChange
  | Unchoose
  | SetExtensionChange
  | FinishCreation
  | SetHomebrewChange
  | DismissFollowUp
  | ClearFollowUp
  | OfferFollowUp;

/** Set an input field's value. */
export type SetChange = {
  type: 'set';
  field: QualifiedFieldId;
  value: Literal;
};

/** Adjust a numeric input field (a counter) by an amount. Tags (`damage.fire`) let incoming-change effects such as resistance modify the amount first. `faces` are die faces for the dice its incoming-change effects roll; applyChanges writes them in when it rolls, so a logged adjust replays without rolling. `situational` holds the receiving player's situational choices for it. */
export type AdjustChange = {
  type: 'adjust';
  field: QualifiedFieldId;
  by: number;
  tags?: Tags;
  /** Die faces for the incoming-change effects' dice `add`s, consumed in order as they are rolled. Faces left over are `faces-mismatch`; too few, with no dice function, `faces-required`. */
  faces?: number[];
  /** The receiving player's situational choices for this change, by qualified ID: a reaction such as Uncanny Dodge. Each selected choice (a boolean that's true, another value that isn't its default) must be offered (`available`) and its `incoming` must match the change (`situational-unavailable`); its incoming-change effects then apply while this change is routed, and not to its overflow or the rest of the batch. An action never sets it. */
  situational?: Record<string, Literal>;
};

/** Add a copy of a content item to the inventory (carried types) or features. */
export type AddItemChange = {
  type: 'addItem';
  entry: Entry;
};

export type RemoveItemChange = {
  type: 'removeItem';
  entry?: InstanceId;
  copies?: CopiesQuery;
  limit?: CopiesLimit;
};

export type EquipChange = {
  type: 'equip';
  entry?: InstanceId;
  equipped: boolean;
  copies?: CopiesQuery;
  limit?: CopiesLimit;
};

export type SetStateChange = {
  type: 'setState';
  /** A copy's instance ID, or an applied entry's: its keys and bounds are those its source's content type and item declare. */
  entry?: InstanceId;
  key: Name;
  /** The new value; with `copies` or `applied`, a formula evaluated per copy or entry (an action has already replaced any `steps`, `flags` or `params` in it with literals). */
  value: Literal | Formula;
  copies?: CopiesQuery;
  limit?: CopiesLimit;
  applied?: Applied;
  /** A pick, with `option`: the choice it is in, as `choose` names it. Its keys and bounds are those the picked content declares (its content type's and its own). */
  path?: ChoicePath;
  /** With `path`: the picked option. */
  option?: string | number;
  picks?: Picks;
  /** With `entry` (a copy) or `path` and `option` (a pick): the content that node's holder grants name, by qualified ID, whose saved state changes (the node's `grants`). It must be active there (`not-granted`). Its keys and bounds are those the granted content declares; a value equal to its default (the grant's `state` value, else the declared default) is dropped. */
  grant?: QualifiedId;
  grants?: Grants;
};

export type AdjustStateChange = {
  type: 'adjustState';
  /** A copy's instance ID, or an applied entry's: its keys and bounds are those its source's content type and item declare. */
  entry?: InstanceId;
  key: Name;
  /** The amount; with `copies` or `applied`, a formula evaluated per copy or entry (an action has already replaced any `steps`, `flags` or `params` in it with literals). */
  by: number | Formula;
  copies?: CopiesQuery;
  limit?: CopiesLimit;
  applied?: Applied;
  /** A pick, with `option`: the choice it is in, as `choose` names it. Its keys and bounds are those the picked content declares (its content type's and its own). */
  path?: ChoicePath;
  /** With `path`: the picked option. */
  option?: string | number;
  picks?: Picks;
  /** With `entry` (a copy) or `path` and `option` (a pick): the content that node's holder grants name, by qualified ID, whose saved state changes (the node's `grants`). It must be active there (`not-granted`). Its keys and bounds are those the granted content declares; a value equal to its default (the grant's `state` value, else the declared default) is dropped. */
  grant?: QualifiedId;
  grants?: Grants;
};

/** Set a copy's `quantity`. It may not be below 0 (`out-of-range`); a copy at 0 stays. */
export type SetQuantity = {
  type: 'setQuantity';
  entry?: InstanceId;
  /** The new quantity, an integer; with `copies`, a formula evaluated per copy (an action has already replaced any `steps`, `flags` or `params` in it with literals). */
  value: number | Formula;
  copies?: CopiesQuery;
  limit?: CopiesLimit;
};

/** Add `by` to a copy's `quantity`. The result may not be below 0 (`out-of-range`); a copy at 0 stays. */
export type AdjustQuantity = {
  type: 'adjustQuantity';
  entry?: InstanceId;
  /** The amount, an integer; with `copies`, a formula evaluated per copy (an action has already replaced any `steps`, `flags` or `params` in it with literals). */
  by: number | Formula;
  copies?: CopiesQuery;
  limit?: CopiesLimit;
};

/** Apply a template to, or remove it from, a copy of an item. */
export type TemplateChange = {
  type: 'applyTemplate' | 'removeTemplate';
  entry: InstanceId;
  template: QualifiedId;
};

/** Apply content to the character: an `applied` entry. Without `id`, applyChanges gives the entry `<source local id, dots as hyphens>-<n>`, the smallest n >= 1 that no copy, applied entry or earlier change in the batch uses. */
export type ApplyEffectChange = {
  type: 'applyEffect';
  id?: InstanceId;
  source: QualifiedId;
  active?: boolean;
  /** The entry's state. A value may be `{ formula }`, a formula an action passed on because it reads `batch`: applyChanges evaluates it with `item` the source's item, this character's fields and `batch`, and the change as applied (`changes` in the result) carries the value. */
  state?: Record<
    string,
    | Literal
    | {
        formula: Formula;
      }
  >;
};

/** An applied entry by its instance ID, or applied entries by query (`applied`). */
export type RemoveEffectChange = {
  type: 'removeEffect';
  id?: InstanceId;
  applied?: Applied;
};

/** Set `active` on an applied entry, by its instance ID, or on applied entries by query (`applied`). */
export type ToggleEffectChange = {
  type: 'toggleEffect';
  id?: InstanceId;
  applied?: Applied;
  active: boolean;
};

/** Pick an option (choose). Un-picking (unchoose) is `#/$defs/unchoose`. A choice a grant presets takes neither (`preset-choice`). */
export type ChooseChange = {
  type: 'choose';
  path: ChoicePath;
  option: string | number;
};

/** Un-pick an option (unchoose), removing its nested picks in the same all-or-nothing change. Without `option`, every pick of the choice is removed with its nested picks; a choice with none is left unchanged (not `not-picked`). */
export type Unchoose = {
  type: 'unchoose';
  path: ChoicePath;
  option?: string | number;
};

/** Where a choice lives: on an entry (or the character's rules-level choices when `entry` is absent), then alternating choice IDs and picked options down to the choice. `["martial-archetype", "5e-srd-5.1:subclasses.champion", "additional-fighting-style"]`. */
export type ChoicePath = {
  entry?: InstanceId;
  choice: (string | number)[];
};

/** Replace one app's extension data. `value: null` removes it. */
export type SetExtensionChange = {
  type: 'setExtension';
  namespace: string;
  value: unknown;
};

/** Finish creating the character: clears `creating`. Rejected with `creation-incomplete` while the character, with the batch's earlier changes applied, has rules issues or pending choices; the error's `data.issues` lists them, pending choices as `too-few-picks`. On a character that isn't being created it does nothing. A creation action proposes it as its last change, so applying the action's changes is the player's confirmation; a character made by hand finishes the same way. */
export type FinishCreation = {
  type: 'finishCreation';
};

/** Replace the character's own homebrew; `homebrew: null` removes it. Rejected with `homebrew-error` when the new homebrew doesn't load, and with `unknown-id` while the rest of the file still names homebrew content or fields it no longer has. Later changes in the batch see the new homebrew; a batch whose first change is setHomebrew doesn't load the old one. Actions can't propose it. */
export type SetHomebrewChange = {
  type: 'setHomebrew';
  homebrew: CharacterHomebrew | null;
};

/** Dismiss an ephemeral follow-up: delete the character's stored follow-up with this `id` (as computeSheet's `offers` gives it) without acting on it. A required one too: `required` is advisory. A derived offer can't be dismissed: it lasts exactly as long as its condition holds. An ID with no stored entry is `unknown-follow-up`. */
export type DismissFollowUp = {
  type: 'dismissFollowUp';
  id: string;
};

/** Clear an ephemeral follow-up that was acted on: delete the character's stored follow-up with this `id`. No entry with the ID is no change, so applying an action's changes after another app cleared it still works. startAction proposes it last when it runs a stored follow-up's action (`action.followUp`), and the `changes` computeSheet lists for a stored follow-up end with it. */
export type ClearFollowUp = {
  type: 'clearFollowUp';
  id: string;
};

/** Offer a follow-up: store the named follow-up of the character as an ephemeral offer, as if it had fired, once the batch is applied. Proposed by an action (a step's or option's changes, or changes content adds to a step) to name what may come after it: a sorcerer's blood magic after a cast. `followUp` and `source` name the declaration as a stored follow-up does; `params` are evaluated values that replace the declaration's own. The declaration's `when` and its action's availability are checked after the batch, as for a triggered follow-up; one the character doesn't have then, or a derived (`while`) one, isn't stored. A follow-up no loaded pack declares is `unknown-follow-up`. */
export type OfferFollowUp = {
  type: 'offerFollowUp';
  /** The follow-up's ID: `<pack>:<id>` for the rules', `<content or type qualified ID>#<id>` for content's. */
  followUp: string;
  /** For a follow-up on content: the content and copy declaring it, as computeSheet's sources name them. */
  source?: Source;
  /** Parameter values for the follow-up's action, replacing the declaration's own of the same name. */
  params?: Record<string, unknown>;
};

/** A change proposed by an action step. Same types as a change, but values may be formulas and `entry: self` means the copy making the action; the engine resolves them before returning. With `split`, one proposed adjust becomes one change per tag group (typed damage). An addItem's `entry` is an object whose values may be formulas. An applyEffect names its `source` with a formula and may leave out `id`; removeEffect, toggleEffect, setState and adjustState may name applied entries by query (`applied`). equip, applyTemplate and removeTemplate compute `equipped` and `template`; setExtension stays the app's. An offerFollowUp names a follow-up of the content or rules whose action, option or added changes propose it, with `params` as formulas. */
export type ProposedChange = {
  /** Any change type but setHomebrew, dismissFollowUp and clearFollowUp. */
  type:
    | 'set'
    | 'adjust'
    | 'addItem'
    | 'removeItem'
    | 'equip'
    | 'setState'
    | 'adjustState'
    | 'setQuantity'
    | 'adjustQuantity'
    | 'applyTemplate'
    | 'removeTemplate'
    | 'applyEffect'
    | 'removeEffect'
    | 'toggleEffect'
    | 'choose'
    | 'unchoose'
    | 'setExtension'
    | 'finishCreation'
    | 'setHomebrew'
    | 'dismissFollowUp'
    | 'clearFollowUp'
    | 'offerFollowUp';
  /** The change is proposed only when this holds. */
  when?: Condition;
  /** Propose the change once per element of this list, in list order, with `x` bound to the element. `when` and the change's other formulas are evaluated per element; an empty list proposes nothing. Each copy counts toward `maxActionSteps` (a follow-up's toward `maxFollowUps`). `x` is not bound in the formulas a change passes on. */
  forEach?: Formula;
  /** setState and adjustState: `self`, the pick whose content defines the running action, resolved to `path` and `option` in the returned change. In an action that isn't a picked content's, `unknown-reference`. */
  pick?: 'self';
  picks?: Picks;
  /** setState and adjustState: `self`, the grant that activated the running action's granted content (a holder grant), resolved to `entry` (or `path` and `option`, a pick) and `grant` in the returned change. In an action that isn't a granted content's, `unknown-reference`. */
  grant?: 'self';
  grants?: Grants;
  /** set and adjust may compute it: `{ formula }`, evaluated when the action runs to a field ID and qualified against the action's pack, as a literal one is. For `to: self` or a role it must name an input field (`unknown-field` or `not-input-field`, data: `field`); for a link it must be qualified and is passed on unchecked. A `split` adjust's field is written out. */
  field?: FieldRef | ComputedField;
  entry?: string | ProposedEntry | ComputedEntry;
  key?: Name;
  /** Evaluated by the action, unless the change has `copies` (or `applied`) and this reads `self`, `item` or `batch`: then it is passed on for applyChanges to evaluate per copy, with each path rooted at `steps`, `flags`, `params` or `action` replaced by its value as a literal. */
  value?: Formula;
  /** Evaluated by the action, unless the change has `copies` (or `applied`) and this reads `self`, `item` or `batch`: then it is passed on for applyChanges to evaluate per copy, with each path rooted at `steps`, `flags`, `params` or `action` replaced by its value as a literal. */
  by?: Formula;
  tags?: TagList;
  /** adjust only: split this change by tag. The engine emits one adjust per distinct tag under `by` among the roll items of step `roll`, evaluating the change's `by` formula once per group with `part` bound (`part.total`, `part.tag`). Each emitted change carries the change's tags plus the group's tag; items with no tag under `by` form one more group carrying only the change's tags. Incoming-change effects (resistance) then apply to each change separately. */
  split?: {
    roll: Name;
    by: Tag;
  };
  /** setState, adjustState, setQuantity, adjustQuantity, equip and removeItem: the copies to change, by query, instead of `entry`. The type is qualified against the action's pack; `where` and per-copy formulas (those reading `self` or `item`) are passed on for applyChanges to evaluate per match, and other formulas are evaluated by the action. Formulas passed on may also read `steps`, `flags`, `params` and `action` (the action's own `item`, `self` and `step`), which the action replaces with their values as literals. They may read `batch`: the batch's earlier field adjustments on the receiving character. */
  copies?: {
    type: TypeRef;
    /** Evaluated per candidate copy by applyChanges, with `item` and `self` bound to it. May also read `steps`, `flags`, `params` and `action` (`action.item`, `action.self`, `action.step`): the action replaces each path rooted there with its value as a literal, and `has()` of one with `true` or `false`, before passing the change on. A path to a map is `type-mismatch`. */
    where?: Condition;
  };
  limit?: CopiesLimit;
  /** removeEffect, toggleEffect, setState and adjustState: the applied entries to change, by query, instead of `id` or `entry`. `where` and per-entry formulas (those reading `self` or `item`) are passed on for applyChanges to evaluate per entry, with `steps`, `flags`, `params` and `action` replaced by their values as literals, as for `copies`. `limit` is a literal integer >= 1. */
  applied?: {
    where: Condition;
    limit?: number;
  };
  /** choose and unchoose: the choice. `entry` is an instance ID, `self` or `picked` as for `entry`; without it the choice is a rules-level one. `choice` is the path as a list of literal segments, or a formula giving the list (`"['playbook', steps.playbook.picked, 'special-ability']"`). */
  path?: {
    entry?: string | ComputedEntry;
    choice: string[] | Formula;
  };
  /** choose and unchoose: a formula naming the option (`picked.id`). An unchoose may leave it out to remove every pick of the choice. */
  option?: Formula;
  /** applyEffect: the new entry's instance ID (without it, applyChanges picks one); removeEffect and toggleEffect: the applied entry's. */
  id?: InstanceId;
  /** applyEffect: a string formula naming the content to apply, qualified against the action's pack as a proposed addItem's `item` is. A source that names no content, or a template, is `unknown-reference` when the action runs; for a link, or a role or target when qualified with a pack the ruleset doesn't load, it is passed on as written. */
  source?: Formula;
  /** applyEffect and toggleEffect: a boolean formula. */
  active?: Formula;
  /** applyEffect: the entry's state, each value a formula of the key's type. A value that reads `batch` is passed on as `{ formula }`, with `steps`, `flags`, `params` and `action` replaced by their values, for applyChanges to evaluate with `item` the source's item, the receiving character's fields and `batch`. */
  state?: Record<string, Formula>;
  /** equip: a boolean formula, evaluated by the action, for the copy `entry` names or every copy `copies` matches. */
  equipped?: Formula;
  /** applyTemplate and removeTemplate: a string formula naming the template, qualified against the action's pack as `source` is. One that names no template is `unknown-reference` when the action runs; for a link, or a role or target when qualified with a pack the ruleset doesn't load, it is passed on as written. */
  template?: Formula;
  /** offerFollowUp: the follow-up to offer, by its own ID: one declared by the content (or its content type) whose action proposes the change, or whose `changes` effect adds it to a step; in a rules action, a rules follow-up (local or qualified). The action resolves it to the qualified ID and the content's `source`, and always proposes the change to the actor, whatever the step's `to`. One the owner doesn't declare is `unknown-reference` when the action runs. */
  followUp?: string;
  /** offerFollowUp: formulas for the follow-up's action parameters, evaluated by the action; a formula giving `null` leaves its parameter out. */
  params?: Record<string, Formula>;
};

/** An instance ID computed when the action runs: a string formula, such as `{ formula: params.weapon }`. It is passed on as evaluated, for a role, a target or a link as for the actor; the character receiving the change checks it as it would a written ID. */
export type ComputedEntry = {
  formula: Formula;
};

/** A field ID computed when the action runs: a string formula, such as `{ formula: x }` or `{ formula: params.skillA.id }`. */
export type ComputedField = {
  formula: Formula;
};

/** addItem only: the copy to add. `item` is a string formula naming a content ID (a local ID is qualified against the action's pack); `quantity` is an integer formula, `equipped` a boolean formula, and each `state` value a formula of the key's type. Without `id`, the engine uses `<item local id, dots as hyphens>-<n>` with the smallest n >= 1 that the character and earlier changes of the same action don't use. In `choices`, a pick's `option` may be `{ formula }`, evaluated by the action (with `x` under `forEach`) to a string or number; the tree's keys stay literal. The picks are checked when applied, as a `choose` of each is. */
export type ProposedEntry = {
  id?: InstanceId;
  item: Formula;
  quantity?: Formula;
  equipped?: Formula;
  state?: Record<string, Formula>;
  templates?: Ref[];
  choices?: ProposedChoiceTree;
};

/** A proposed addItem's picks: a character file's choice tree, but a pick's `option` may be `{ formula }`. */
export type ProposedChoiceTree = Record<string, ProposedPick[]>;

export type ProposedPick = {
  option:
    | string
    | number
    | {
        formula: Formula;
      };
  choices?: ProposedChoiceTree;
};

/** Per-copy changes (setState, adjustState, setQuantity, adjustQuantity, equip, removeItem) may name their copies with a query instead of `entry`. applyChanges resolves it against the character it changes, at that point in the batch: the copies of `type` (inventory, then features, each in file order) whose `where` holds, with `item` and `self` bound (`steps`, `flags` and `params` are not names here: an action substitutes them before passing a change on). With `limit`, only the first that many match. In such a change, `by` and `value` are formulas evaluated per match with the same binding, and formulas resolve names in the content type's pack. No match is not an error. */
export type CopiesQuery = {
  type: QualifiedTypeRef;
  where?: Condition;
};

/** With `copies`: change at most this many matches. */
export type CopiesLimit = number;

/** setState and adjustState may name picks by query: applyChanges resolves it against the character it changes, at that point in the batch: every pick, in file order (each copy's choice tree, then the rules-level one, depth first), whose picked content declares the change's `key` and whose `where` holds with `item` the picked item and `self` its state (with declared defaults). With `limit`, only the first that many. `by` and `value` are formulas evaluated per pick with the same binding. No match is not an error. */
export type Picks = {
  where: Condition;
  limit?: number;
};

/** setState and adjustState may name granted content by query: applyChanges resolves it against the character it changes, at that point in the batch: each active holder grant, in activation order (the same item on one node once), whose granted content declares the change's `key` and whose `where` holds with `item` the granted item and `self` its state (saved, else the grant's `state`, else declared defaults). With `limit`, only the first that many. `by` and `value` are formulas evaluated per grant with the same binding. No match is not an error. */
export type Grants = {
  where: Condition;
  limit?: number;
};

/** removeEffect, toggleEffect, setState and adjustState may name applied entries by query instead of `id` or `entry`. applyChanges resolves it against the character it changes, at that point in the batch: the `applied` entries, in file order, whose `where` holds with `item` the source's item and `self` the entry (`id` and its state, with declared defaults). With `limit`, only the first that many. In such a change, `by` and `value` are formulas evaluated per entry with the same binding, and formulas resolve names in the source's pack. No match is not an error: each such change adds `{ applied: [ids] }` to `adjustments`. */
export type Applied = {
  where: Condition;
  limit?: number;
};

/** The standard interchange file for one character, monster or NPC. Holds only base state: input field values, owned content and per-copy state, choices made, and which temporary effects are on. Derived values are never saved. Every content and field reference is fully qualified (`pack:id`). */
export type CharacterFile = {
  /** The OCF spec version this file was written against. */
  specVersion: Semver;
  /** An ID for this character. A UUID is fine for an ID unique within the app or campaign; a URL (IRI) makes it global, so the character keeps one identity across apps. */
  id: string;
  /** The exact pack versions this character uses, in load order (later packs win). */
  packs: {
    id: PackId;
    version: Semver;
  }[];
  /** The character is being created. Default false, so a file without it is a finished character. An app sets it on a new character; the change `finishCreation` clears it once the character has no rules issues and no pending choices. Formulas read it as `character.creating`, so a constraint that holds only at creation guards on it. */
  creating?: boolean;
  /** Values of input fields, by qualified field ID. Missing fields take their default. */
  values?: Record<string, Literal>;
  /** Owned content that is not carried: classes (with their level), feats, traits. */
  features?: Entry[];
  /** Carried content. The character's copy of an item is a base plus templates. */
  inventory?: Entry[];
  /** Temporary effects from content the character doesn't own (Bless cast by an ally, a condition). The app turns them on and off; the engine never tracks time. */
  applied?: {
    id: InstanceId;
    source: QualifiedId;
    /** Default true. */
    active?: boolean;
    state?: EntryState;
  }[];
  /** Ephemeral follow-ups: each `on` or `becomes` follow-up a batch triggered, stored by that applyChanges until it is acted on (`clearFollowUp`, which startAction proposes) or dismissed (`dismissFollowUp`). The engine writes them; apps change them only with those two changes. computeSheet lists each in `offers`. Derived (`while`) offers are never stored. */
  followUps?: StoredFollowUp[];
  /** Picks for character-level choices declared in the rules. */
  choices?: ChoiceTree;
  /** Which character fills each link slot, by qualified slot ID: the other character's `id`. How an app finds that character is the app's business. */
  links?: Record<string, string>;
  /** The character's own content and rules additions, loaded on top of the pinned packs as the pack `homebrew`, so the rest of the file refers to them as `homebrew:<id>`. */
  homebrew?: CharacterHomebrew;
  /** App-specific extras under each app's own namespace (reverse DNS or npm package name). Other apps carry them along untouched. */
  extensions?: Record<string, unknown>;
};

export type Entry = {
  id: InstanceId;
  item: QualifiedId;
  /** Templates applied to this copy, in order. */
  templates?: QualifiedId[];
  equipped?: boolean;
  quantity?: number;
  state?: EntryState;
  /** Picks for the choices declared by this item and its templates. */
  choices?: ChoiceTree;
  /** Saved state of content this copy's item and templates grant (holder grants), by the granted content's qualified ID. */
  grants?: GrantStore;
};

/** Per-copy state values by state key (charges, shots, level). */
export type EntryState = Record<string, Literal>;

/** Picks keyed by choice ID. The tree's own item (the entry's item, or the picked option) uses bare choice IDs; choices declared by other content in the same tree (templates, granted content) are keyed `<qualified owner id>/<choice id>`. Each pick may carry the picks for the choices its option contains. */
export type ChoiceTree = Record<string, ChoicePick[]>;

export type ChoicePick = {
  /** A qualified content ID, an inline option ID, or a value. */
  option: string | number;
  choices?: ChoiceTree;
  /** Values for state keys the picked content declares (its content type's or its own), as a copy's state. The picked content sees them as `self.<key>`; a key at its default is left out. */
  state?: Record<string, Literal>;
  /** Saved state of content the picked option grants (holder grants), by the granted content's qualified ID. */
  grants?: GrantStore;
};

/** Granted content's saved state, kept on the node whose choice tree holds its picks: a copy, or a pick. Each key is a granted item's qualified ID; `state` holds values for state keys it declares (its content type's or its own), as a pick's does. The granted content sees them as `self.<key>`, over the grant's `state` and the declared defaults; a key at that default is left out. The same item granted twice to one node shares it. Kept while the grant is off. */
export type GrantStore = Record<
  string,
  {
    state?: Record<string, Literal>;
  }
>;

/** A stored ephemeral follow-up. */
export type StoredFollowUp = {
  /** Unique among the character's stored follow-ups: `<the follow-up's own ID>-<n>`, the smallest n from 1 not in use. */
  id: InstanceId;
  /** The follow-up's ID: `<pack>:<id>` for the rules', `<content or type qualified ID>#<id>` for content's. */
  followUp: string;
  /** For a follow-up on content: the content and copy it comes from, as computeSheet's sources name them. */
  source?: Source;
  /** For a follow-up to a linked character: `{ link }` with the qualified slot ID. It is stored here, on the character whose change triggered it, since one applyChanges writes one file; the app shows it to whoever runs the linked character. Absent for the character's own. */
  to?: {
    link: SlotId;
  };
  /** For a follow-up to a link: the ID of the character filling the slot when it was triggered. */
  character?: string;
  /** The parameters the follow-up fixes, evaluated when it was triggered. */
  params?: Record<string, unknown>;
  /** What triggered an `on` moment: the adjustment entry as the follow-up's formulas saw it as `change` (with `once`, the matching entries summed), and its field. */
  cause?: {
    field: QualifiedId;
    by: number;
    requested: number;
    taken: number;
    reason: 'requested' | 'absorbed' | 'overflow' | 'reset' | 'carry';
    clamped: boolean;
    tags: Tag[];
  };
};

/** A choice declared in content or rules: its options (a query, a list of content, a list of values, or inline options), how many to pick, and when it applies. Picked content becomes active on the character (its effects, grants and own choices apply), unless the choice says `activate: false`. Any option can contain its own choices, which become pending as soon as the option is picked. The character stores picks as a tree keyed by choice ID. */
export type Choice = {
  /** Unique among the choices of the same owner (content item, inline option or rules). */
  id: Slug;
  /** The choice is one choice per slot, in list order, each keyed `<id>-<slot>` (`class-feat-2`), with the slot's number bound as `slot` (an `int`) in every formula of the choice and of its inline options (`when`, `pick`, `recommend`, the query's `where`, a value choice's `values` and `where`, `effects`). Written out, not computed: slots are saved choice keys. A slot key equal to another choice of the same owner is `duplicate-id` at load. One prompt serves every slot, with the slot as the ICU argument `{slot}`. */
  slots?: number[];
  /** How many to pick: an exact count, or a range. Counts may be formulas (`proficiency.bonus`). Default 1. */
  pick?:
    | Formula
    | {
        min?: Formula;
        max?: Formula;
      };
  from: Options;
  /** A condition each option must meet, apart from the list `from` gives: `item` the content option's item, or `value` the value, with the character's fields, the owner's `item` and `self`, and `choice` (the choice itself, with its `picks`). A listed option that fails it is `option-not-eligible` in `listOptions`, and so is a saved pick. Not on a choice of inline options, which have prerequisites. */
  eligible?: Condition;
  /** When the choice applies, e.g. `self.level >= 3`. Until then it is neither pending nor active. */
  when?: Condition;
  /** A required choice with too few picks is reported as pending. Default true. */
  required?: boolean;
  /** Optional formula naming the option the rules recommend (an option ID or value). */
  recommend?: Formula;
  /** Effects applied once per pick, with the picked option visible as `pick` (its `id` or `value`). Used when options are values or fields rather than content (choose two skills), or picks that aren't activated (`activate: false`). */
  effects?: Effect[];
  /** Content choices (a query or `items`): `false` keeps the picks inactive, so a pick is a reference, such as a tool the character is proficient with. Its picks are saved and counted as usual and the choice's `effects` run per pick with `pick.id`, but the picked content's own effects, grants, choices, actions and follow-ups don't apply. Default true. */
  activate?: boolean;
  /** The choice must have something to pick. While it is pending and none of its options is eligible, the content that brings it has the rules issue `no-eligible-option`, so listOptions marks that content ineligible as an option (5E's feat instead of an Ability Score Improvement, offered only while a feat is open). Default false. */
  requiresOption?: boolean;
  /** The picked options' prerequisites don't apply ("a feat you don't need to meet the prerequisites of"): a pick's activation reports no `prerequisite-not-met`, and `listOptions` gives no prerequisite reasons. Default false. */
  waivePrerequisites?: boolean;
  /** Translation key for the prompt. Default `<owner>.choices.<id>.prompt`. A slotted choice has one prompt for every slot, with `{slot}`. */
  prompt?: I18nKey;
  /** Exclusivity group: an option picked in one choice of the group is ineligible in the others (rules issue `already-picked`). The key is pack-qualified like other IDs: a local key is the declaring pack's, and a qualified one (`orc-2e:feats`) joins the group of that pack, the declaring pack or one of its dependencies, so an extension's choices share a dependency's group. A choice never excludes its own picks. Content with `repeatable: true` is exempt: picking it in one choice of the group leaves it eligible in the others. */
  unique?: string;
  /** Where the exclusivity group (`unique`) holds. `character` (the default): across the character's choices of the group. `owner`: only among the choices of the same owner activation (one copy, one pick or one grant of the content, one inline option, or the rules), so two choices of a feat can't take the same skill while the feat taken again, or another feat with the same key, takes it freely. */
  uniqueScope?: 'character' | 'owner';
};

export type Options =
  | Query
  | {
      items: Ref[];
    }
  | {
      /** The values to pick from: a list written out, or a formula giving a list of strings or numbers, evaluated against the character (`links` included). A saved pick a formula no longer lists is `option-not-eligible`. */
      values:
        | (string | number)[]
        | {
            formula: Formula;
          };
      /** A condition over each candidate value, bound as `value`, with the character's fields, `character`, `links` and the owner's `item` and `self`. A candidate that fails it is `option-not-eligible` in `listOptions`, and so is a saved pick that fails it. */
      where?: Condition;
    }
  | {
      options: InlineOption[];
    };

/** An option defined inside the choice. Translation keys: `<owner>.choices.<choice>.options.<id>.name`. */
export type InlineOption = {
  id: Slug;
  tags?: Tags;
  prerequisites?: Prerequisite[];
  effects?: Effect[];
  grants?: Grant[];
  choices?: Choice[];
};

/** A pack ID: lowercase words joined by hyphens, with dots allowed between them, e.g. `5e-srd-5.1`. By convention `<game>-<pack folder>`. */
export type PackId = string;

/** A content ID inside one pack: dot-separated segments of lowercase words joined by hyphens, e.g. `weapons.longsword`, `magic-items.weapon-plus-one`. Content IDs are permanent and never reused. */
export type LocalId = string;

/** A content ID with its pack, e.g. `5e-srd-5.1:weapons.longsword`. */
export type QualifiedId = string;

/** A reference to content: a local ID (resolved in the referring pack, then its dependencies) or a qualified ID. */
export type Ref = LocalId | QualifiedId;

/** A content type name, local or with its pack (`class`, `specialAbility`, `5e-srd-5.1:class`). */
export type TypeRef = string;

/** A content type name with its pack (`fitd-scoundrel:specialAbility`). */
export type QualifiedTypeRef = string;

/** A field ID: dot-separated identifier segments, e.g. `abilities.str.mod`. Segments must be valid formula identifiers (no hyphens), because formulas refer to fields by bare name. */
export type FieldId = string;

/** A key standing for a family of field IDs: a field ID with one or more placeholders, `{<family>}`, each a family the pack declares in `families` (`abilities.{ability}.mod`, `spellSlots.rank{rank}.max`). Expanded before the pack loads: one entry per value, the placeholder replaced in the key and in every string of the entry. */
export type FamilyKey = string;

/** The name of a set of declared fields in the pack's `viewFields`, in place of declaring them again. */
export type ViewFieldsRef = Name;

/** A field ID with its pack, e.g. `5e-srd-5.1:abilities.str.score`. */
export type QualifiedFieldId = string;

export type FieldRef = FieldId | QualifiedFieldId;

/** A short identifier usable in formulas: item field names, state keys, parameter names, content type names. */
export type Name = string;

/** A local identifier for choices, actions, steps, bands and similar parts: lowercase words joined by hyphens. */
export type Slug = string;

/** A tag on content, fields, rolls and changes: lowercase words joined by hyphens, optionally dotted into a hierarchy (`damage.fire`). A tag matches itself and every tag below it (`damage` matches `damage.fire`). Every tag a pack uses must be declared in its rules' `tags` (or a dependency's). */
export type Tag = string;

export type Tags = Tag[];

/** An ID unique within one character file, for inventory entries, features and applied effects. Up to 193 characters, so a standard copy's derived ID (its qualified content ID with the colon and dots as hyphens) always fits. */
export type InstanceId = string;

/** A translation key, e.g. `weapons.longsword.name`. */
export type I18nKey = string;

/** A BCP 47 language tag such as `en`, `de` or `pt-BR`. */
export type LanguageTag = string;

export type Semver = string;

/** An npm-style semver range, e.g. `^1.2.0`. */
export type SemverRange = string;

/** A plain data value: a string, number, boolean, or a list of them. */
export type Literal = string | number | boolean | (string | number | boolean)[];

/** The value types a field, item field, state key or parameter can hold. Kept in sync with `data/value-types.json`. */
export type ValueType =
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'string'
  | 'enum'
  | 'dice'
  | 'id'
  | 'set';

/** How a decimal result becomes whole. Kept in sync with `data/rounding-modes.json`. */
export type Rounding = 'floor' | 'ceil' | 'round' | 'truncate';

/** Where a value, roll item or rules issue came from. */
export type Source = {
  type:
    | 'field'
    | 'item'
    | 'entry'
    | 'template'
    | 'effect'
    | 'situational'
    | 'rules'
    | 'step'
    | 'app';
  id?: string;
  entry?: InstanceId;
  effect?: string;
};

/** Marks something as deprecated. It keeps working; upgrade scripts move characters off it. */
export type Deprecation = {
  since: Semver;
  replacedBy?: string;
};

/** A tag, or `{ formula }` computing tags when the action runs (`{ formula: "'damage.' + item.damageType" }`): one string, or a list of strings spread in the entry's place. Each must be a declared tag; a tag already in the list isn't added again. */
export type TagOrFormula =
  | Tag
  | {
      formula: Formula;
    };

/** Which tags an `id` or `set` of `tag` takes: a tag listed in `tags`, or a tag below one in `under` (`damage.fire` under `damage`; `damage` itself isn't), and not listed in `except` (`except: [skill.lore]` leaves the tags below it members). Every tag named must be declared by the pack or a dependency. */
export type TagMembers = {
  /** Tags whose descendants are members; the tag itself isn't. */
  under?: MemberTagList;
  /** Tags that are members themselves (not the tags below them). */
  tags?: MemberTagList;
  /** Tags that aren't members themselves; the tags below them still can be. */
  except?: MemberTagList;
};

export type MemberTagList = Tag[];

export type TagList = TagOrFormula[];

/** Fields read from another character, by field ID as that character's packs name it, without the pack. Each has a value type and an optional `default`. Link slots declare them. A declared field the other character's view lacks reads its `default`; with none it is absent. `id` is reserved for the view's character ID. */
export type DeclaredFields = Record<string, DeclaredField>;

export type DeclaredField = {
  type: ValueType;
  /** enum: allowed values. */
  values?: Slug[];
  /** set: what the members are; only `string`. The view's value is a list of strings, read as is (not qualified). */
  of?: 'string';
  /** The value when the view lacks the field: a literal, never a formula. */
  default?: Literal;
};

/** Applied content the character can't be affected by: the items listed, or the content a query matches. Decided during activation: an active `applied` entry whose source matches an active immunity is blocked (not activated) and reported as the rules issue `immune`. */
export type Immunity = {
  /** Unique among the owner's immunities. The `immune` issue's ID is the qualified owner plus this ID (`5e-srd-5.1:features.monk.purity-of-body/poisoned`), or the pack plus this ID for the rules'. */
  id: Slug;
  /** The content the character is immune to, by ID; resolved at load like other references. */
  items?: Ref[];
  /** The content the character is immune to, as a query; its `where` sees the candidate as `item` and is an activation condition. */
  query?: Query;
  /** An activation condition: the immunity counts only while it holds. It reads `self`, `item`, `character` and raw input values, never derived fields. */
  when?: Condition;
  /** On content: which activations of the item have the immunity, as for effects. `holder` (default): while the character has the item. `applied`: while the item is the source of an active `applied` entry that isn't itself blocked (petrified's immunity to poison). The rules' immunities have no scope. */
  scope?: 'holder' | 'applied';
};

/** A link slot ID with its pack, e.g. `fitd-scoundrel:crew`. */
export type SlotId = string;

/** One piece of content (a weapon, spell, class, playbook, template, …): mechanics only, one file per item. Player-facing text lives in the pack's i18n files under keys derived from the item ID (`<id>.name`, `<id>.description`). An item either defines new content (`id` + `type`) or overrides another pack's item (`override`), changing only the properties it mentions. */
export type ContentItem = {
  /** Local content ID, permanent and never reused. Must match the file path: `content/weapons/longsword.yaml` holds `weapons.longsword`. */
  id?: LocalId;
  /** A content type declared by this pack or a dependency, or the built-in `template`. */
  type?: Name;
  /** Homebrew: the ID of another pack's item to override. Only the properties given here change. */
  override?: QualifiedId;
  /** A permanent variant: inherit everything from this item, then apply the properties given here. */
  extends?: Ref;
  tags?: Tags;
  /** Templates only: tags the copy's item doesn't have. A copy's `item.tags` are the base item's, then for each template in order its `removeTags` taken away and its `tags` added; a later template may add a removed tag again. */
  removeTags?: Tag[];
  /** Values for the item fields declared by the content type. How a value is read depends on the declared type: `integer`, `decimal`, `boolean` and `dice` values are formulas (a plain literal is a formula with no inputs); `string`, `enum` and `id` values are literal strings; `set` values are lists of literals. A template may set the rules' `templateFields` and the fields of the content type its `appliesTo` names; its values are merged into the copy's `item` in template order, replacing the base item's, and its formulas see the base item as `base`. A template may give `null` for a field: the field is absent from the copy's `item` (no declared default applies), unless a later template sets it again. Only templates may give `null`. */
  fields?: Record<string, Literal | null>;
  /** Templates only: values the template's item fields read as `params.<name>`, given by the content keeping it (`keepsTemplates` `params`). A param the keeper doesn't give, or on a saved template, is its `default`, else absent. */
  params?: Record<string, ValueDecl>;
  /** Extra per-copy state keys this item (or template) adds to the character's copy, beyond those its content type declares. */
  state?: Record<string, ValueDecl>;
  /** Computed values on this item's copies, added to the content type's or replacing one of them by name. A template's are added to the copies it is applied to. */
  computed?: Record<string, ComputedDecl>;
  effects?: Effect[];
  /** Follow-ups that apply while the character has this item's copy or pick, as effects do. Their formulas see `item` and `self`. */
  followUps?: FollowUp[];
  actions?: ActionOrUse[];
  choices?: Choice[];
  /** Other content this item makes active on the character while it is active itself, e.g. class features at level N. A grant with `scope: applied` applies while the item is the source of an active applied entry: the granted content is applied content too, with the entry as `self`. */
  grants?: Grant[];
  /** Applied content the character can't be affected by while this item is active: an `applied` entry whose source matches is blocked and reported as the rules issue `immune`. */
  immuneTo?: Immunity[];
  /** What applying this item again does, replacing its content type's `reapply`. */
  reapply?: Reapply;
  /** A string state key whose value names each copy of this item (a custom stunt the player names), replacing its content type's `nameFrom`. While the copy's value of the key is a non-empty string, it is the copy's name (computeSheet's `copyNames`). */
  nameFrom?: Name;
  /** Content every character holds a copy of while this item is active, e.g. a playbook's own gear: queries that read only `item`, resolved by loadRuleset. Each match is a standard copy with the instance ID `<pack>-<local ID>`, the colon and dots as hyphens; the character file saves it only once it differs from its defaults. */
  standardCopies?: Query[];
  /** Item fields the templates this item keeps (`keepsTemplates`) leave as they are, on the copies it keeps them on: a specific magic weapon's Price, which already counts the runes it comes with. A template the player applies later changes them as usual. */
  keepsFields?: Name[];
  /** Templates this item keeps while it is active: on the character's copies (`copies`), each copy of `copies.type` whose base item matches `copies.where` has the template applied after its saved ones; on content picked or granted to the character (`content`), each item of `content.type` matching `content.where` has the template's fields and tags merged into its `item`. A query reading only `item` is resolved by loadRuleset; one that also reads the keeper is an activation condition. A template whose `appliesTo` doesn't match isn't kept. Nothing is saved. */
  keepsTemplates?: KeptTemplate[];
  /** Conditions for having this item. Failing ones are rules issues (`prerequisite-not-met`), never blocking unless strict mode is on. */
  prerequisites?: Prerequisite[];
  /** The item may be picked more than once (a feat taken again): exclusivity groups (a choice's `unique`) don't apply to it, so a pick of it in one choice of a group leaves it eligible in the others, and isn't `already-picked`. Default false. */
  repeatable?: boolean;
  /** Templates only: the items this template may be applied to: one query, or several, any of which may match. With several, the template's item fields are the template fields and those every listed type declares; its formulas see `item` as the first type's. */
  appliesTo?: Query | Query[];
  deprecated?: Deprecation;
  /** IDs of the content type's effects this item switches off. */
  suppress?: Slug[];
};

export type Grant = {
  /** The content granted: an ID, or `{ formula }`, a string formula evaluated as an activation condition is (it reads `self`, `item` and input fields) to a content ID, qualified in the grant's pack as a literal one is; an empty string grants nothing, and an ID that names no content grants nothing with the sheet error `unknown-id`. So content grants what the player named in its state (a spell picked for the day). */
  item:
    | Ref
    | {
        formula: Formula;
      };
  when?: Condition;
  /** `holder` (default): the grant applies while the content is held, and the granted content is activated as held content. `applied`: while the content is the source of an active, unblocked `applied` entry, the granted content is activated as applied content (its `scope: applied` effects, immunities, grants and actions) with the granting entry as `self`, and immunities block it as they would an entry of it. */
  scope?: 'holder' | 'applied';
  /** The granted item's prerequisites don't apply to this activation of it (content that gives a feat outright, whether or not the character meets its prerequisites). Its own grants and picks are checked as usual. Default false. */
  waivePrerequisites?: boolean;
  /** State values for the granted content: in place of the owner copy's (a holder grant) or the granting entry's (a grant with `scope: applied`), the granted content sees them as `self.<key>`. Each key is a state key the granted content declares (`unknown-state-key` at load); each value is a formula of the key's type evaluated as an activation condition is (it reads `self`, `item` and input fields). For a holder grant they are the defaults of the granted content's saved state: a value saved in the owner's `grants` wins. A condition that includes a valued condition gives its value: `{ item: conditions.enfeebled, scope: applied, state: { value: 2 } }`. */
  state?: Record<string, Formula>;
  /** Holder grants: picks the grant makes for the granted content's own choices, by choice ID (a slot's key for a slotted choice). A choice a literal `item` doesn't declare, a literal option it doesn't offer, or `choices` on a grant with `scope: applied`, is `unknown-reference` at load; with a formula `item`, a key the content doesn't declare presets nothing. A preset choice is answered: its picks are these, it is never pending, and `choose` and `unchoose` on it are `preset-choice`. Each pick's `option` is a literal or `{ formula }`, evaluated as an activation condition is, to a content ID (qualified in the grant's pack, as `item` is), an inline option ID or a value; a pick's `choices` preset the picked option's own choices. A formula that fails, or gives neither a string nor a number, leaves its pick out with a `formula-error`. So content gives a feat for a skill it names: `{ item: feats.assurance, choices: { skill: [{ option: skill.athletics }] } }`. */
  choices?: PresetTree;
};

/** A grant's preset picks: keyed by the owner's bare choice IDs; each pick's `option` is a literal or `{ formula }`. */
export type PresetTree = Record<
  string,
  {
    option:
      | string
      | number
      | {
          formula: Formula;
        };
    choices?: PresetTree;
  }[]
>;

export type Prerequisite = {
  /** Stable ID; rules issues carry it, and its text is `<owner>.prerequisites.<id>`. */
  id: Slug;
  when: Condition;
};

export type KeptTemplate = {
  /** The template kept on the copies or the content. */
  template: Ref;
  /** The copies it is kept on: a content type and a condition over the copy's base item. A condition reading only `item` is resolved by loadRuleset; one that also reads the keeper (`self`, `picksOf`, `character`, input fields, the character functions) is an activation condition with `item` the candidate, so a keeper keeps a template on what its own choice picked. */
  copies?: Query;
  /** The content without a copy of its own it is kept on: every holder activation of content picked or granted to the character whose item is of the type and matches the condition, read as `copies`' is. The template may give only fields and tags (`template-without-copy` otherwise). */
  content?: Query;
  /** Values for the template's `params`, each a formula of the param's type evaluated as an activation condition is, with the keeper's roots (`self`, `item`, `picksOf`, `character`, input fields). The template's item fields read them as `params.<name>`, so a kept template scales with the character. A name the template doesn't declare is `unknown-name` at load. */
  params?: Record<string, Formula>;
  /** An activation condition: while it holds, the template is kept. */
  when?: Condition;
  /** `holder` (default): while the item is held. `applied`: while it is the source of an active, unblocked `applied` entry, on that character's copies. */
  scope?: 'holder' | 'applied';
};

/** A kind of content a game defines in data (weapon, spell, playbook). Its interface has four parts: fields (what is it?), effects (declared on each item), actions (what rolls can it make?), and state (what is tracked on your copy?). */
export type ContentType = {
  /** Item fields every item of this type may or must set: what the item's author writes, never what changes in play (that is `state`). Each is named by `types.<type>.fields.<field>.name` (required) and `.description` (optional) in the pack's text, for a custom-item form. */
  fields?: Record<string, ValueDecl>;
  /** A string state key whose value names each copy of this type, for copies the player or GM names (a faction added in play, a harm's "Broken leg"). While the copy's value of the key is a non-empty string, it is the copy's name: computeSheet gives it in `copyNames`, and apps show it in place of the item's name. An item's own `nameFrom` replaces the type's. */
  nameFrom?: Name;
  /** Per-copy state on the character's copy (charges, shots, level). Visible in formulas as `self.<key>`. */
  state?: Record<string, ValueDecl>;
  /** Computed values on each copy: per-copy values with a formula, worked out after every field and never saved. computeSheet returns them per copy (`copies`); the copy's own actions (and the actions it reaches through `use`) and its follow-ups read them as `self.<name>`, as do the copy's later computed values. Nothing else can read them. A name must not reuse a state key or a core property of the copy. */
  computed?: Record<string, ComputedDecl>;
  /** Copies live in the character's `inventory` (true) or `features` (false, default). */
  carried?: boolean;
  /** Copies have the core `equipped` flag (`self.equipped`). */
  equippable?: boolean;
  copies?: Copies;
  /** Actions every item of this type has, in addition to the item's own. */
  actions?: ActionOrUse[];
  label?: I18nKey;
  /** Named texts: extra player-facing text each item of the type may have, looked up as `<contentId>.texts.<name>` (a spell's `material` and `trigger`). None is required; apps know from the type which to look up and where to show them. */
  texts?: Name[];
  /** Effects every item of this type has, before the item's own. `item` and `self` are bound as for item effects; the source is the item. An item can switch one off by ID (`suppress`). */
  effects?: Effect[];
  /** Follow-ups every item of this type has while the character has its copy or pick. */
  followUps?: FollowUp[];
  /** Grants every item of this type has, before the item's own. A grant with `scope: applied` follows an applied entry of the item instead of a held copy. */
  grants?: Grant[];
  reapply?: Reapply;
};

/** A computed value on a copy. Its formula sees `item`, `self` (the copy, with the computed values declared before this one), every field, `character`, `links` and the character functions. */
export type ComputedDecl = {
  type: 'integer' | 'decimal' | 'boolean' | 'string';
  formula: Formula;
};

/** Declares a typed value: an item field, a state key or an action parameter. */
export type ValueDecl = {
  type: ValueType;
  /** enum: allowed values. */
  values?: Slug[];
  /** id/set: the content type (or `field`, `tag`, `string`) of the members. */
  of?: Name;
  /** id/set of `tag`: which tags it takes. Without it, any declared tag. */
  members?: TagMembers;
  required?: boolean;
  /** Parameters: may be omitted. */
  optional?: boolean;
  /** Parameters: the label key. Default: `<actionKey>.params.<name>.name`; an optional one-line hint is `<actionKey>.params.<name>.description`. */
  label?: I18nKey;
  /** The value when none is given. For integer, decimal, boolean and dice declarations a string is a formula: on a state key it is evaluated with `item` bound when the copy is added, and the result is written into the character file (`shots: item.magazine`); on an item field it is read as an item's own value is, over input fields. For string, enum and id declarations a string is a literal. An item field's default applies in `item` when the item doesn't set the field; an id or set default of content or `field` is qualified in the content type's pack. */
  default?: Literal;
  /** The lowest allowed value. On a state key, a number formula with `item` bound (the copy's item with its templates) that reads input fields only, evaluated by `addItem` for a formula default and by `setState` and `adjustState` (`shots: { max: item.magazine }`). On an action parameter of type `integer` or `decimal`, a number formula evaluated as the action starts, with the action's `item` and `self`, `situational` and the character's fields (`max: effort.free`); a value outside it is `out-of-range`. */
  min?: Formula;
  /** The highest allowed value. On a state key or a parameter, read like `min`. */
  max?: Formula;
  /** Parameters of type `id` with `of: field`: which fields the app may pass (a condition over each field as `item`: `id`, `type`, `tags`). The action reads the field as `params.<name>.value`, its ID as `params.<name>.id`, its type as `params.<name>.type` and its declared tags as `params.<name>.tags`. Parameters of type `id` with `of` a content type: which items the app may pass, a condition with `item` the candidate item, the character's fields, and the action's own item and copy as `action.item` and `action.self`; the action reads the item's qualified ID. A value outside it is `invalid-option` when the action starts. */
  where?: Condition;
};

/** What applying this content again does: an `applyEffect` of it, while the character has an `applied` entry of it that isn't inactive (`active` not `false`; a blocked entry counts) and whose `match` state keys are equal to the new entry's, adds no entry. Instead each key of `state` of the first such entry becomes the higher (`highest`; dice by average), the lower (`lowest`), the sum (`add`, numeric keys) or the new value (`replace`). An item's replaces its content type's. */
export type Reapply = {
  /** State keys whose values must be equal as well (the new entry's with their defaults against the existing one's), e.g. a persistent damage's damage type. */
  match?: Name[];
  /** Per state key, how the existing entry's value and the new one merge. Keys not named keep the existing entry's values. */
  state: Record<string, 'highest' | 'lowest' | 'add' | 'replace'>;
};

/** How many copies of the type a character may hold: `max` copies of the type in all, `perItem` copies of any one item. Each is an integer literal, which an app reads from the ruleset without evaluating anything, or an integer formula over the character's fields, worked out on the computed sheet: computeSheet's `copyLimits` gives every limit's value. A missing key is no limit. Copies in `features` and `inventory` count, standard copies included, whatever their `quantity`; picks, grants, templates and applied entries don't. Past a limit the sheet has the rules issue `too-many-copies`, and computeSheet lists the type in `copyLimits`. `max: 0` says the type is held by picks only. */
export type Copies = {
  /** At most this many copies of the type: an integer, or an integer formula a pack's field may raise (a variant allowing a second class). */
  max?: number | Formula;
  /** At most this many copies of any one item of the type: an integer, or an integer formula. */
  perItem?: number | Formula;
};

/** Optional presentation data. Never affects calculations or saved state; apps may ignore it. Priority is a whole number where 0 is highest. Ties keep their written order, with pack load order as the final tiebreaker. */
export type DisplayHints = {
  groups?: DisplayGroup[];
  /** Hints per field ID. */
  fields?: Record<string, FieldHints>;
  /** Hints for a content type's copies, by content type name. */
  types?: Record<string, TypeHints>;
};

export type DisplayGroup = {
  id: Slug;
  /** What the group holds: `fields` (the default), the character's `actions` as `computeSheet` lists them, or its `content` (copies and picks). */
  kind?: 'fields' | 'actions' | 'content';
  /** Translation key. Default `groups.<id>.label`. */
  label?: I18nKey;
  priority?: number;
  /** Where the group shows: `primary`, `secondary` (the default) or `background`. A background group is kept out of play views with all its members; the group's value is also the default for members that don't set their own. */
  visibility?: Visibility;
  /** A query whose matches join the group, so homebrew joins automatically: `type: field` for a fields group (fields can also join by listing the group in their own hints), `type: action` for an actions group, a content type for a content group. A content group's query may take `from`: `own` (the default: copies and content active through picks and grants) or `applied` (the character's applied entries whose source is of the type). */
  members?: Query | ContentQuery;
  showWhen?: Condition;
  /** Content groups: each member's section key (an integer or a string), over `item` and `self`. Sections are ordered by key, numbers ascending; a section's label key is `groups.<id>.sections.<key>.name` (optional). */
  sectionBy?: Formula;
  /** Content groups: a number or string members are sorted by, then by instance order. */
  sortBy?: Formula;
};

/** How prominently an app shows a group or value, a fixed meaning every app follows: `primary` is always on the sheet, compact views included; `secondary` is shown and may be collapsed; `background` is kept out of play views and shown when editing the sheet (base scores, maximums, per-level bookkeeping, overrides). `hidden` is separate: never shown. */
export type Visibility = 'primary' | 'secondary' | 'background';

export type FieldHints = {
  groups?: Slug[];
  priority?: number;
  /** Where the value shows: `primary`, `secondary` or `background`. Without it, a field takes its group's, else `secondary`. Not with `hidden`. */
  visibility?: Visibility;
  label?: I18nKey;
  shortLabel?: I18nKey;
  /** A display format, kept in sync with `data/display-formats.json`, or `{ bands: <set> }`: the value named by the first band of a result band set the field's pack sees whose `when` holds with `roll.total` the value. The engine never evaluates it. */
  format?:
    | 'plain'
    | 'signed'
    | 'percent'
    | 'dice'
    | 'fraction'
    | {
        /** A result band set (`resultBands`) the field's pack sees; `bands.<set>.<band>.name` names the value. */
        bands: Slug;
      };
  /** A unit ID; its text is `units.<id>.name` and `units.<id>.short`. Display only: converting units is the app's call. */
  unit?: Slug;
  /** Input hints for editors (a number from 1 to 30). Field min/max still apply. */
  input?: {
    min?: number;
    max?: number;
    step?: number;
    widget?: 'number' | 'checkbox' | 'dots' | 'track' | 'text' | 'select';
  };
  /** An in-between helper value players should never see. */
  hidden?: boolean;
  showWhen?: Condition;
  /** The rolls the field's tile starts: the first is the field's own (a tap), the others are offered beside it, in order. The app starts each with its `params`; parameters a roll doesn't give are asked or left out as when the player starts the action. */
  rolls?: FieldRoll[];
  /** Companion fields shown in this field's tile, each role at most once: `modifier` signed after the value ("13 (+1)"), `max` as "x / y", `detail` a small second line. In a group where the field has a tile, a companion has no tile of its own. Not with `hidden`. */
  with?: {
    field: FieldRef;
    as: CompanionRole;
  }[];
};

/** How a companion is shown in a field's tile: `modifier` signed after the value ("13 (+1)"), `max` after it as "x / y" ("0 / 195"), `detail` a small second line. `modifier` and `max` take numbers. */
export type CompanionRole = 'modifier' | 'max' | 'detail';

/** A roll a field starts: a rules action and literal values for some of its parameters. A field parameter's value is a field ID, a content parameter's an item ID. */
export type FieldRoll = {
  /** A rules action: a local or qualified action ID. */
  action: Ref;
  params?: Record<string, Literal>;
};

/** Hints for a state key of a content type's copies: a field hint without `groups`. `showWhen` sees the copy as `self` and its item as `item`; the key's own `min` and `max` still apply. */
export type StateHints = {
  priority?: number;
  /** Where the state key shows: `primary`, `secondary` (the default) or `background`. Not with `hidden`. */
  visibility?: Visibility;
  label?: I18nKey;
  shortLabel?: I18nKey;
  /** Kept in sync with `data/display-formats.json`. */
  format?: 'plain' | 'signed' | 'percent' | 'dice' | 'fraction';
  /** A unit ID; its text is `units.<id>.name` and `units.<id>.short`. Display only: converting units is the app's call. */
  unit?: Slug;
  /** Input hints for editors (a number from 1 to 30). Field min/max still apply. */
  input?: {
    min?: number;
    max?: number;
    step?: number;
    widget?: 'number' | 'checkbox' | 'dots' | 'track' | 'text' | 'select';
  };
  /** An in-between helper value players should never see. */
  hidden?: boolean;
  showWhen?: Condition;
  /** Companion state keys of the same copy shown in this key's tile, each role at most once. Not with `hidden`. */
  with?: {
    key: Name;
    as: CompanionRole;
  }[];
};

/** Hints for an item field. */
export type ItemFieldHints = {
  /** Kept in sync with `data/display-formats.json`. */
  format?: 'plain' | 'signed' | 'percent' | 'dice' | 'fraction';
  /** A unit ID; its text is `units.<id>.name` and `units.<id>.short`. Display only: converting units is the app's call. */
  unit?: Slug;
  /** Kept off the item's card. A custom-item form still asks for it. */
  hidden?: boolean;
};

export type TypeHints = {
  /** Hints by state key. */
  state?: Record<string, StateHints>;
  /** Hints by item field. */
  fields?: Record<string, ItemFieldHints>;
  /** Hints for the copies' quantity. */
  quantity?: {
    /** True when quantity never matters (class features). */
    hidden?: boolean;
  };
};

/** A content group's members: a query with `from`. With `applied`, the members are the character's applied entries whose source is of the type, in file order, inactive and blocked ones included; in `where`, `sectionBy` and `sortBy`, `item` is the source's item and `self` the entry (`id` and its state, with defaults). */
export type ContentQuery = {
  type: Name;
  where?: Condition;
  from: 'own' | 'applied';
};

/** How content changes the character, and when. Effects apply while the content carrying them is active on the character and `when` is true. Fixed order per field: the field's own formula, then set, add, multiply, atLeast/atMost. */
export type Effect = {
  /** Optional ID, unique within the content item, so apps and rules issues can point at this effect. */
  id?: Slug;
  target: EffectTarget;
  /** One of the fixed effect operations. Kept in sync with `data/effect-operations.json`. */
  op:
    | 'add'
    | 'set'
    | 'multiply'
    | 'atLeast'
    | 'atMost'
    | 'grant'
    | 'rollModifier'
    | 'option'
    | 'changes';
  /** A formula for add/set/multiply/atLeast/atMost (on rolls and on incoming changes, `add` accepts dice: `1d4`; on rolls, `atLeast` and `atMost` take an integer and bound the roll's total after the dice); a grant value object for grant; a roll modifier for rollModifier; an option for option; changes for a tagged changes step for changes. On a roll's parts, `set` takes a formula (dice or a number) that replaces each matching part. */
  value?: unknown;
  /** Condition for the effect to be active. `self` is the character's copy of the item carrying it. For `option`, the added option is offered only while this holds; it also sees the action context and `action`. For `changes`, the changes are added only while this holds, with the same context and `participant` in an `each` step. On an incoming target, it also sees `incoming`. */
  when?: Condition;
  /** Effects sharing a stack key on the same target are combined by the game's stacking policy for that key. The reserved value `source` means the content item the effect comes from (5E: two Blesses don't stack). Any other value is a literal key (orc-2e: `item`, `status`, `circumstance`). On a choice step, `option` effects sharing a key add only the first of them, in instance order, whatever the stacking policy. */
  stackKey?: string;
  /** Overrides the game's rounding for this effect's multiply. */
  rounding?: Rounding;
  /** Informational only. Time tracking is the app's job; the engine never ends an effect by itself. */
  duration?: {
    amount?: Formula;
    unit: Slug;
    concentration?: boolean;
  };
  /** Rolls with op `add` only: tags for the roll item the effect adds (Flame Tongue's `damage.fire`). Entries may be formulas. */
  tags?: TagList;
  /** Rolls with op `add` only: `false` leaves the roll items the effect adds, dice or flat, alone when `multiplyDice` multiplies the roll's dice or `multiply` its items (5E's Savage Attacks: an extra die rolled once on a critical hit, not doubled; orc-2e's deadly die, added after doubling). Default `true`. */
  multiplied?: boolean;
  /** Incoming-change effects only: changes to the effect's own entry, applied by applyChanges right after the adjust is routed, when the effect counted (its `when` held and stacking kept it). The entry is `self`: the copy for a `holder` effect, the applied entry for an `applied` one (for content an applied grant reaches, the granting entry). Each is a `setState` or `adjustState` with `entry: self`, which changes the state `self` reads the key from (for picked or held granted content that declares the key, its pick's state or its grant's saved state; otherwise the entry's, for picked or granted content the owning copy's), whose `value` and `by` are formulas seeing `item`, `self` and `incoming`, or, on an `applied` effect, a `removeEffect` with `entry: self`, which ends the entry (a ward that triggers once). Only for effects with an entry: on the rules' effects, a situational choice's and choice effects it is a load error (`then-without-copy`). */
  then?: ThenChange[];
  /** Who the effect applies to. `holder` (default): a character who has the content active (features, inventory, picks, grants). `applied`: a character the content is applied to (its `applied` list: cast on them, a condition). Content in `applied` runs only its `applied` effects; held content runs only its `holder` effects. */
  scope?: 'holder' | 'applied';
};

/** A change an incoming-change effect makes to its own entry after the adjust is routed: `setState` with `value`, `adjustState` with `by`, or `removeEffect` (an `applied` effect only), always `entry: self`. */
export type ThenChange = {
  type: 'setState' | 'adjustState' | 'removeEffect';
  entry: 'self';
  key?: Name;
  value?: Formula;
  by?: Formula;
};

/** Changes steps of actions as they run, by tag. Only op `changes`. */
export type StepTarget = {
  /** Changes step tags; the effect adds its changes to a step carrying any of them (a tag matches itself and every tag below it; tags an `action` step adds count). */
  steps: Tags;
  /** `self`: only changes steps of actions made by the item carrying this effect. `any` (default): every matching changes step the character's actions reach. */
  from?: 'self' | 'any';
};

/** What a `changes` effect adds to a tagged changes step: `changes`, proposed after the step's own each time the step runs (per participant in an `each` step) while the effect's `when` holds, `to` this `to`, else the step's. In its `when` and `changes`, `item` and `self` are the content carrying the effect (`entry: self` is that copy), the action's own are `action.item`, `action.self` and `action.step`, and the action's `params`, `situational`, `steps`, `flags`, `participants` (and `participant` in an `each` step) are bound. */
export type StepChanges = {
  changes: ProposedChange[];
  /** Who the changes are for, as a `changes` step's `to`. Default: the step's `to`. */
  to?: Destination;
};

/** A character field (by ID), a set of fields (by a static query over their tags), rolls as they happen (by tag), incoming changes (by field and tag), an action's choice steps (by tag), or an action's changes steps (by tag). */
export type EffectTarget =
  | FieldRef
  | RollTarget
  | IncomingTarget
  | ChoiceTarget
  | StepTarget
  | FieldsTarget;

/** Choice steps of actions as they run, by tag. Only op `option`. */
export type ChoiceTarget = {
  /** Choice step tags; the effect adds its option to a step carrying any of them (a tag matches itself and every tag below it). */
  choices: Tags;
  /** `self`: only choice steps of actions made by the item carrying this effect. `any` (default): every matching choice step the character's actions reach. */
  from?: 'self' | 'any';
};

/** An option an `option` effect adds to a choice step. Its ID is `<content id>#<id>`, named by `<content id>.options.<id>.name`; the effect's `when` is its condition. When it is picked, its `flags` are set, then its `changes`, if any, are resolved like a `changes` step's at the choice step's path, before the step's own `changes`; without them the pick is only recorded, for later steps to read (`steps.<id>.picked`). In its `when` and `changes`, `item` and `self` are the content carrying the effect (`entry: self` is that copy), and the action's own are `action.item`, `action.self` and `action.step`. */
export type Option = {
  id: Slug;
  changes?: ProposedChange[];
  /** Who the changes are for, as a `changes` step's `to`. Default `self`. */
  to?: Destination;
  /** Flags set when the option is picked, as a branch case's: each formula is evaluated in the option's context (`item` and `self` the content's, the action's as `action.*`, `picked` bound) and set as `flags.<name>`, in order, before the option's `changes`. A flag already set is replaced. The action must set each flag elsewhere, in a branch case or a written option: one it doesn't is `formula-error` (cause `unknown-name`) at load, and a value of another type `type-mismatch`. */
  flags?: OptionFlags;
};

export type RollTarget = {
  /** Roll tags; the effect applies to a roll carrying any of them (a tag matches itself and every tag below it). */
  rolls: Tags;
  /** `self`: only rolls made by the item carrying this effect. `any` (default): every matching roll the character makes. */
  from?: 'self' | 'any';
  /** A declared roll tally (`rollTallies`) the effect adds to instead of the roll's total. Ops: `add`, `atLeast`, `atMost`, with an integer value. Without it, `atLeast` and `atMost` bound the roll's total once it is rolled. */
  tally?: Name;
  /** The roll's own parts, by tag: the effect reaches the items built from the action's parts (not those effects add) whose tags match. Only op `set` (replace the part) and the roll modifiers `stepDie` and `setFaces`. Not with `tally`. */
  parts?: Tags;
};

export type IncomingTarget = {
  /** Changes about to be applied to this character (an `adjust` change with tags, e.g. damage). The effect modifies the change's amount before it is applied. Its `when`, `value` and `then` see `incoming`: the adjust's requested `amount`, its `field` and its `tags`. They also see `situational`: the receiving player's choices on the change, defaults for the rest. */
  incoming: {
    fields?: FieldRef[];
    tags?: Tags;
  };
};

/** What a grant adds to a `set` field. Exactly one of: `item` (a content reference, e.g. a weapon proficiency or an action-granting feature), `tag`, `field` (a field ID), `query` (every match), or `formula` (a computed member, e.g. `pick.id` in a choice's effects). */
export type GrantValue = {
  item?: Ref;
  tag?: Tag;
  field?: FieldRef;
  query?: Query;
  formula?: Formula;
};

/** A change to how a roll is made. Kinds are a fixed set kept in sync with `data/roll-modifiers.json`. */
export type RollModifier = {
  kind:
    | 'advantage'
    | 'disadvantage'
    | 'noAdvantage'
    | 'noDisadvantage'
    | 'reroll'
    | 'multiplyDice'
    | 'multiply'
    | 'minimumFace'
    | 'explode'
    | 'poolDice'
    | 'stepDie'
    | 'setFaces';
  /** reroll: reroll faces at or below this value. */
  below?: Formula;
  /** reroll: reroll at most once per die. */
  once?: boolean;
  /** multiplyDice: multiply the dice count of every dice item in the roll. multiply: multiply the value of every rolled item, dice and flat, before the roll's bounds, rounding an integer result. Both leave items marked `multiplied: false` alone. */
  factor?: Formula;
  /** minimumFace: treat lower faces as this value. */
  value?: Formula;
  /** explode: explode on faces at or above this value (default: the highest face). */
  at?: Formula;
  /** poolDice: how many dice to add to the pool (a formula). reroll: at most this many dice matching `below` are rerolled, lowest faces first (earliest first among equal faces); an integer formula. Default: every matching die. */
  count?: Formula;
  /** poolDice: the roll part (by `id`) whose dice the new dice join. Default: the roll step's first dice part. */
  part?: Slug;
  /** stepDie: how many steps along d4, d6, d8, d10, d12 each matching die moves (negative for smaller); an integer formula. */
  steps?: Formula;
  /** advantage, disadvantage: `die` (default) rolls extra dice for the roll's main dice item and keeps the better or worse ones; `roll` makes the whole roll again and keeps the better or worse total. One counted source of the kind that applies with `roll` makes every extra a whole roll. */
  of?: 'die' | 'roll';
  /** setFaces: the dice item's first faces, as integer formulas, used instead of asking for them. */
  faces?: Formula[];
};

/** A set of fields: every `integer` and `decimal` field of the ruleset whose view matches `where`, resolved once by loadRuleset (homebrew fields included). The effect is one instance per matching field, in field order, each exactly as if written with that field as its `target`, so it stacks, competes and is listed per field. Ops: add, multiply, atLeast, atMost; or `grant`, which matches every `set` field instead. */
export type FieldsTarget = {
  fields: {
    /** A condition over each field's view as `item`: `id` (qualified), `type` and `tags`. It may read nothing else (`unknown-name` at load), so the set is fixed: `'attr.dex' in item.tags`. */
    where: Condition;
  };
};

/** The qualified ID of the action whose step this is (`mothership-1e:panic-check`); for an action defined inline on an item, the qualified item ID plus `#<action id>`. Apps build the step's text keys from it. */
export type DefiningAction = string;

/** A roll step's summary: what the roll is rolled against, worked out when the roll is built, before any face is rolled, in the step's band context without `roll`. Output only: replay never reads it. */
export type RollSummary = {
  /** The qualified ID of the step's band set; absent when the step has none (then so are `value` and `bands`). */
  bandSet?: string;
  /** A band set with a `value`: that formula with every subexpression that doesn't read `roll` resolved to a literal, as canonical formula text. */
  value?: string;
  /** The bands that can still hold, in the set's order: each band whose resolved condition isn't `false`, up to and including the first whose resolved condition is `true`. */
  bands?: {
    /** The band's ID. */
    band: string;
    /** The band's condition with every maximal subexpression that doesn't read `roll` evaluated and printed back as a literal, literal guards folded, as canonical formula text. A subexpression that fails to evaluate, or gives a map, is left as written. */
    when: string;
    /** When the resolved condition is `true`, `[]`; when it is a conjunction (`&&`) of comparisons each between a roll path (`roll.total`, `roll.value`, `roll.unbounded`, `roll.kept[<int>]`) and a number literal, those comparisons in order, the roll path on the left. Absent otherwise: the band has its text only. */
    tests?: RollTest[];
  }[];
  /** The running action's flags at the step (the action `action` names), as data, as `outcome.data` reports values (a dice value as dice notation). `{}` when there are none. */
  flags: Record<string, unknown>;
};

/** One comparison of a roll path with a number. Apps word it with the pack's `bands.<set>.<band>.condition` text, else the spec's `compare.<code>` text (packages/spec/i18n). */
export type RollTest = {
  /** The roll path, as formula text: `roll.total`, `roll.value`, `roll.unbounded` or `roll.kept[<int>]`. */
  of: string;
  /** The comparison, as a code: `lt` (<), `le` (<=), `gt` (>), `ge` (>=), `eq` (==). */
  compare: 'lt' | 'le' | 'gt' | 'ge' | 'eq';
  value: number;
};

/** The participant a handoff is for: its role and its view's `id`. */
export type Participant = {
  role: Name;
  id: string;
};

/** How an action finished: its `result` and `data`. */
export type Outcome = {
  result?: string;
  data?: Record<string, unknown>;
};

/** Allocation amounts by qualified field ID: for a budget step the amount added, for a values step the value given. */
export type Amounts = Record<string, number>;

/** An answer to one pause, as continueAction takes it and as startAction's `answers` lists them: `faces` for a dice pause, `option` for a choice, `amounts` for an allocation, `outcome` for a handoff. */
export type Answer =
  | {
      faces: number[];
    }
  | {
      option: string;
    }
  | {
      amounts: Amounts;
    }
  | {
      outcome: Outcome;
    };

/** When the engine continues by itself and when it pauses. Rules are checked in order; the first matching rule decides; unmatched checkpoints use the defaults. */
export type ActionPolicy = {
  /** Roll steps. Default `auto`. */
  dice?: 'auto' | 'pause';
  /** Choice steps. Default `auto`. */
  choices?: 'auto' | 'pause';
  /** Allocation steps. Default `auto`. */
  allocations?: 'auto' | 'pause';
  rules?: {
    kind?: 'roll' | 'choice' | 'allocate';
    /** Matches a roll step, a choice step or an allocation step carrying any of these tags, or a tag below one. */
    tags?: Tags;
    step?: string;
    then: 'auto' | 'pause';
  }[];
};

/** One die face set, choice, allocation or handoff answer, however supplied. Replaying an action from its log always gives the same result. */
export type LogEntry = {
  /** Step path, e.g. `attack`, `hit/damage`, or `saves[1]` for the second participant of an `each` step. */
  step: string;
  action: DefiningAction;
  kind: 'dice' | 'choice' | 'allocate' | 'handoff';
  by: 'engine' | 'app';
  /** A roll step with `of`: the full path of the earlier roll it classified again (`check/roll`). It rolled nothing, so the entry has no `faces`; `items` and `total` are that roll's, `band` its own. */
  of?: string;
  /** The faces the step used. A roll step with no dice items is not a checkpoint and has none. */
  faces?: number[];
  /** Dice entries of a random draw on a choice or allocate step: what the face picked among. Its one face is `faces[0]`. */
  draw?: Draw;
  /** The picked option ID; `#done` when a repeated choice step was ended early. */
  option?: string;
  /** Choice steps with `repeat`: which pick of the step this is, from 0. Each pick is its own entry with the same `step`. */
  index?: number;
  /** Choice steps over pending choices: the path of the choice the pick answered. On replay, a recorded pick whose choice is no longer the one asked is `answer-mismatch`. */
  choice?: ChoicePath;
  /** Allocation steps: the amounts, as answered or recommended. */
  amounts?: Amounts;
  /** Handoffs: the participant who ran the used action. */
  participant?: Participant;
  /** Handoffs: the outcome the app answered with. */
  outcome?: Outcome;
  items?: RollItem[];
  total?: number;
  band?: string;
  /** Roll steps with a band: the qualified ID of the band set the step classified by, so an app names the band `bands.<set>.<band>.name` in the set's pack. */
  bandSet?: string;
  /** Roll steps classified by a band set with a `value`: that value, as data (orc-2e's degree of success as a rank). */
  bandValue?: unknown;
  /** Roll steps, a dice-less roll step's entry included: the roll's summary, worked out before the roll, so it matches what a pause for it showed. */
  summary?: RollSummary;
  /** Roll steps: each `atLeast` or `atMost` roll effect that changed the total, in the order applied (the highest `atLeast`, then the lowest `atMost`). `total` is the bounded total; `items` and `faces` are unchanged. */
  bounds?: {
    source: Source;
    op: 'atLeast' | 'atMost';
    value: number;
  }[];
  /** Roll steps made more than once (advantage or disadvantage `of: roll`): every whole roll, in roll order, with its total before bounds; `kept` marks the one kept, whose items are `items`. `faces` lists every roll's faces. Absent for a roll made once. */
  rolls?: {
    total: number;
    kept: boolean;
    items: RollItem[];
  }[];
  /** Roll steps: each roll tally with a non-zero value, with what contributed to it. */
  tallies?: {
    name: Name;
    value: number;
    sources: {
      source: Source;
      op: 'add' | 'atLeast' | 'atMost';
      value: number;
    }[];
  }[];
};

/** What a paused action is waiting for. */
export type ActionNeed = {
  /** Step path, e.g. `hit/confirm`, `panic/panic` or `saves[1]`. */
  step: string;
  action: DefiningAction;
  /** `dice`, `choice`, `allocate` (the app answers with `amounts`), or `handoff`: the app runs `run` on `participant`'s own character and answers with its outcome. */
  kind: 'dice' | 'choice' | 'allocate' | 'handoff';
  /** The dice to roll, in order; the app answers with one face per die. */
  dice?: {
    count: number;
    sides: number | 'F';
    tags?: Tags;
    zero?: boolean;
  }[];
  /** A dice pause for a random draw on a choice or allocate step: one die, as many sides as `among` has entries; the face picks among them. */
  draw?: Draw;
  /** The itemized roll so far, for display while waiting. */
  items?: RollItem[];
  /** Dice steps made more than once (advantage or disadvantage `of: roll`): `times` whole rolls of `items`, whose dice `dice` lists roll after roll, and the total kept: `high` or `low`. Absent for a roll made once. */
  repeat?: {
    times: number;
    keep: 'high' | 'low';
  };
  /** Dice steps: the summary of the roll the pause is for; a pause for more dice mid-roll carries the same one. To preview a roll, an app starts the action with `dice: 'pause'`, reads this and drops the result. */
  summary?: RollSummary;
  /** The offered option IDs, in order: written option IDs, qualified content IDs or instance IDs. A repeated step that has its `min` picks offers the reserved `#done` last. */
  options?: string[];
  /** The recommended option, if any; never `#done`. */
  recommended?: string;
  /** Choice steps over pending choices: the choice being asked, also on a random draw's dice pause there. The app names it with the choice's own text (`<owner>.choices.<id>.prompt`) and its options as it names `listOptions` results. */
  choice?: {
    path: ChoicePath;
    /** The key root of the choice's owner, qualified: the content ID (`5e-srd-5.1:classes.fighter`), `<pack>:rules` for a rules-level choice, and for a choice nested in an inline option the owner's root plus `.choices.<choice>.options.<option>`. */
    owner: string;
    /** The choice's ID: for a slot of a slotted choice, the slot's own (`class-feat-2`). */
    id: string;
    /** A slot of a slotted choice: the declared choice ID, whose prompt names it, and the slot's number, the prompt's `{slot}`. */
    slot?: {
      choice: string;
      number: number;
    };
    /** The choice's evaluated `min` picks, as `listOptions` gives it. */
    min?: number;
    /** The choice's evaluated `max` picks, as `listOptions` gives it; absent when unbounded. */
    max?: number;
    /** How many picks the choice has so far, on the proposed sheet, this step's earlier picks included. An app shows "pick 2 of 6" from `picked`, `min` and `max`. */
    picked?: number;
  };
  /** Allocation steps: what may be allocated. The app answers with `amounts`, a map of field ID to amount (fields left out get nothing). */
  allocate?: {
    /** The offered fields in order: the qualified ID, the computed value before the step, the input value before the step and, for a budget step, the most the field can take (the smaller of its `max` less its input value and the step's `limit`) and each amount's cost. */
    fields: {
      id: string;
      /** The field's computed value before the step: its input value with every effect applied. */
      value: number;
      /** The field's input value before the step (saved, else its default), before effects. The step's amounts add to it; `value` less `input` is what effects add. */
      input: number;
      limit?: number;
      /** Budget steps: `costs[n]` is what giving the field `n` costs, from 0 (always 0) to its `limit`, or to the budget when it has none, and to 100 at most; it stops before an amount whose cost fails to evaluate. The amounts' total cost is the sum of `costs[amount]`. An amount past the array may still be answered; the engine checks it. */
      costs?: number[];
    }[];
    /** Budget steps: the total to spend. Nothing is spent before the answer: the step is one checkpoint. */
    budget?: number;
    /** Budget steps: `all` or `upTo`. */
    spend?: 'all' | 'upTo';
    /** Values steps: the values to hand out, one field each, every value used once. */
    values?: number[];
    /** The recommended amounts, when the step has a usable recommendation. */
    recommended?: Amounts;
  };
  /** Handoffs: who runs the action. */
  participant?: Participant;
  /** Handoffs: the action to run on the participant, `action` the qualified ID of the step's `use`, `params` its evaluated parameters and `participants` (when the step passes any) the used action's roles, each a list of IDs: participants of the running action, or the running character's own `id`. The app passes their views to the run. */
  run?: {
    action: string;
    params: Record<string, unknown>;
    participants?: Record<string, string[]>;
  };
};

export type ActionResult =
  | {
      status: 'finished';
      outcome: Outcome;
      proposedChanges: {
        /** `self`, `target`, a role of the action, or `{ link }` with the qualified slot ID. */
        to:
          | Name
          | {
              link: SlotId;
            };
        /** The ID of the character the change is for: for `to: { link }`, the character filling that slot (its view's `id`), absent when the slot is empty; for a role (`target`, `helper`), the participant's view `id`, absent when no participant was given. The slot is qualified (`{ link: fitd-scoundrel:crew }`). */
        character?: string;
        /** The path of the `changes` step that proposed it (`deal`, `panic/stress`); a split adjust's changes share it. */
        step: string;
        change: Change;
      }[];
      log: LogEntry[];
    }
  | {
      status: 'paused';
      needs: ActionNeed;
      /** Everything needed to continue: the action, character, inputs (link views and participants included, so continueAction takes none) and position, handoff outcomes included. Plain data; engine-defined beyond being JSON. PROVISIONAL. */
      state: Record<string, unknown>;
      log: LogEntry[];
    }
  | EngineFailure;

/** A random draw: the die picks `among[face - 1]`, the option IDs a choice step offers (its source's, in order) or the field IDs an allocate step may give the next value or unit to, by qualified ID in field order. */
export type Draw = {
  among: string[];
};

/** An offer: a follow-up the character is offered, derived or ephemeral, with an action to start, changes to apply or a linked character to make. */
export type ListedFollowUp = {
  /** The offer's ID, which startAction's `action.followUp` takes: for an ephemeral offer its stored ID (which `dismissFollowUp` and `clearFollowUp` take too); for a derived one the follow-up's ID, with `@<instance ID>` when it is on a copy. */
  id: string;
  /** `derived` (a `while` follow-up, offered exactly while its condition holds; never stored or dismissed) or `ephemeral` (an `on` or `becomes` follow-up, stored until acted on or dismissed; a `becomes` one also until its condition is false). */
  kind: 'derived' | 'ephemeral';
  /** The follow-up's ID: `<pack>:<id>` for the rules', `<content or type qualified ID>#<id>` for content's. */
  followUp: string;
  /** For a follow-up declared on content: the content and copy it comes from, as computeSheet's sources name them. */
  source?: Source;
  /** `self`, or `{ link }` with the qualified slot ID. */
  to:
    | 'self'
    | {
        link: SlotId;
      };
  /** For `to: { link }`: the ID of the character filling the slot, absent when it is empty. */
  character?: string;
  /** The action to start, in the shape of startAction's `action` input, with `followUp` set to this offer's ID for the character's own offer: for an ephemeral one, the run then proposes the clearing change. */
  action?: {
    id: string;
    /** The copy the action belongs to, or the applied entry whose source offers it (`scope: applied`), as computeSheet lists it. */
    entry?: InstanceId;
    /** The content the action comes from, as computeSheet lists it: required for an action of picked or granted content, absent otherwise. */
    source?: QualifiedId;
    /** The offer this run takes up: the ID of an entry of computeSheet's `offers` for the character, as its `action` gives it. For an ephemeral offer, the finished run's proposed changes end with `{ type: clearFollowUp, id }` for `self` (step `''`), so applying them deletes the stored entry in the same batch; a failed run, or changes never applied, clear nothing. A derived offer needs no clearing: the action's changes end the condition. An ID the character isn't offered is `unknown-follow-up`. */
    followUp?: string;
  };
  /** With `action`: the parameters the follow-up fixes, evaluated (for an ephemeral offer, when it fired). Others are the app's to supply. */
  params?: Record<string, unknown>;
  /** The changes to apply, resolved on the current character, for a new applyChanges batch. For the character's own ephemeral offer they end with `clearFollowUp`, so applying them clears it. */
  changes?: Change[];
  /** A derived offer to make a linked character: make a character file with `creating: true` using `pack`, run the creation start `start` on it with `params` (guided, or automatic when the start is `random`), apply its changes, and save the new character's ID in this character's `links` under `link`, which ends the offer. Never with `action` or `changes`. */
  create?: {
    /** The empty slot, qualified. */
    link: SlotId;
    /** The creation start, `<pack>:<id>`: the ruleset's `creation` entry with that `pack` and `id`. */
    start: string;
    /** The start's pack: the pack the new character uses. */
    pack: PackId;
    /** The start's action's parameters the offer fixes, evaluated on this character; pass them over the start's own `params`. */
    params: Record<string, unknown>;
  };
  /** Whether the rules mandate it. Advisory: the engine blocks nothing, and an ephemeral one can still be dismissed. */
  required: boolean;
  /** For an ephemeral offer from `on`: the adjustment entry that triggered it, as the follow-up's formulas saw it as `change` (with `once`, the matching entries summed), and its field. Absent for `becomes` and derived offers. */
  cause?: {
    field: QualifiedId;
    by: number;
    requested: number;
    taken: number;
    reason: 'requested' | 'absorbed' | 'overflow' | 'reset' | 'carry';
    clamped: boolean;
    tags: Tag[];
  };
};

export type ApplyChangesInput = {
  ruleset: Ruleset;
  character: CharacterFile;
  changes: Change[];
  /** Strict mode: rules issues become errors and the batch is rejected. */
  strict?: boolean;
  links?: Links;
};

export type ApplyChangesOutput =
  | {
      ok: true;
      character: CharacterFile;
      /** The batch as applied: each `adjust` whose incoming-change effects rolled dice carries every face it used in `faces`, supplied and rolled. Apps log this, not their input, so a replay never rolls. A batch that rolled nothing comes back unchanged. */
      changes: Change[];
      issues: RulesIssue[];
      /** What adjust changes actually did after incoming-change effects, absorption, overflow and clamping: one entry per field touched, in order. A change aimed at copies by query adds `{ copies }`: the instance IDs it matched, in order (empty when none matched); one aimed at applied entries by query adds `{ applied }` the same way, and an `applyEffect` merged into an existing entry (`reapply`) adds `{ applied: [<that entry's ID>] }`. An incoming-change effect's `then` adds `{ key, value, source }` per state change it made, addressed as the setState that made it: `entry` (its own entry), `path` and `option` (its pick), or `grant` with the node (its grant's saved state); and `{ entry, removed: true, source }` when it removed its applied entry. */
      adjustments?: (
        | {
            field: string;
            /** The change actually applied to this field. */
            by: number;
            /** The amount before effects, absorption and clamping, on the field the change named. */
            requested?: number;
            /** On the `requested` entry: the amount after incoming-change effects and before absorbing, clamping and overflow. It differs from `requested` only when an incoming-change effect counted. */
            taken?: number;
            reason?: 'requested' | 'absorbed' | 'overflow' | 'reset' | 'carry';
            clamped?: boolean;
            tags?: Tags;
            /** On the `requested` entry: each dice `add` an incoming-change effect rolled, in instance order, with the effect's source, the dice as text, every face it used and the total. */
            rolled?: {
              source: Source;
              dice: string;
              faces: number[];
              total: number;
            }[];
          }
        | {
            entry?: InstanceId;
            path?: ChoicePath;
            option?: string | number;
            grant?: QualifiedId;
            key: Name;
            /** The state key's new value. */
            value: unknown;
            source: Source;
          }
        | {
            entry: InstanceId;
            removed: true;
            source: Source;
          }
        | {
            copies: InstanceId[];
          }
        | {
            applied: InstanceId[];
          }
      )[];
      /** The ephemeral follow-ups this batch stored, as computeSheet's `offers` lists them, in the order they were stored: the rules' in declaration order, then content's in instance order, each `on` follow-up once per matching adjustment in order. They are in the returned character too. Nothing here has been run or applied. */
      followUps?: ListedFollowUp[];
    }
  | {
      ok: false;
      errors: EngineError[];
      issues?: RulesIssue[];
    };

export type CheckReleaseInput = {
  previous: PackRelease;
  next: PackRelease;
  /** The releases each side's packs depend on, transitively, in load order; `[]` when absent. checkRelease loads each side with them, as loadRuleset does, to find the items that became standard. */
  dependencies?: {
    previous?: PackRelease[];
    next?: PackRelease[];
  };
};

export type CheckReleaseOutput = {
  ok: boolean;
  /** Shape changes (`standard-copy-added`), then interface changes: by kind in the order of upgrades.md's tables, then by ID. */
  changes: {
    kind:
      | 'content-removed'
      | 'content-type-changed'
      | 'field-removed'
      | 'field-type-changed'
      | 'state-removed'
      | 'choice-removed'
      | 'option-removed'
      | 'choice-added'
      | 'standard-copy-added'
      | 'content-type-removed'
      | 'item-field-removed'
      | 'item-field-values-removed'
      | 'tag-removed'
      | 'action-removed';
    id: string;
    data?: Record<string, unknown>;
  }[];
  /** The build check's errors, and the errors of a side that doesn't load, each with `data.release` (`previous` or `next`). */
  errors: EngineError[];
};

export type ComputeSheetInput = {
  ruleset: Ruleset;
  character: CharacterFile;
  /** The app's picks for competing options, as option IDs. Each competing group (the `set` effects on a field, or a `playerChooses` stacking group) applies the first of its options, in instance order, that is listed, else its recommended option. IDs that name no option are ignored. */
  competing?: string[];
  links?: Links;
};

/** Views of the characters filling the character's link slots, by qualified slot ID. The app takes each from that character's own computeSheet. The engine reads only the declared fields. */
export type Links = Record<string, View>;

/** Another character as values: its `id` and its computed values by field ID. A value is matched to a declared field by its field ID without the pack, so `values` may be computeSheet's (`fitd-crew:tier: 2`) or bare (`tier: 2`). */
export type View = {
  id: string;
  values?: Record<string, Literal>;
};

export type ComputeSheetOutput = {
  /** Every field's value with its breakdown, by qualified field ID. */
  values: Record<string, FieldValue>;
  /** Active effects. */
  effects: ActiveEffect[];
  /** Actions available now. */
  actions: {
    action: string;
    /** The copy that owns the action's content, or the applied entry whose source offers it (`scope: applied`). */
    entry?: InstanceId;
    /** For an action of content picked in a choice or granted to the entry (not the entry's own item), or of content with no entry at all (picked in a rules-level choice): the qualified ID of that content. Several picked items can then use the same shared action. */
    source?: QualifiedId;
  }[];
  /** Computed values on copies, by instance ID: for each copy that has any, `{ <name>: value }`. A value whose formula fails is left out, with a `formula-error` in `errors`. */
  copies?: Record<string, Record<string, Literal>>;
  /** Copies named by their state, by instance ID: for each copy whose item or content type has `nameFrom`, the value of that state key when it is a non-empty string. Apps show it as the copy's name in place of the item's (a choice's copy options included). */
  copyNames?: Record<string, string>;
  /** Every item the character has with templates, as merged, so an app shows the item as the rules read it: each copy with a saved or kept template, in instance order (`entry` its instance ID), then each piece of content without a copy (picked or granted) that content keeps templates on, in activation order, once per item (no `entry`). `templates` lists the templates in the order they apply, `tags` and `fields` are the merged item's (`item.tags` and each item field as `item` reads it; a dice field as canonical dice text). */
  templated?: {
    entry?: InstanceId;
    item: QualifiedId;
    templates: QualifiedId[];
    tags: string[];
    fields: Record<string, Literal>;
  }[];
  /** The character's standard copies, in instance order: each copy the rules or an active item give every character, by its instance ID (`entry`) and item, and whether the file saves it (`saved`). Unsaved copies are at their defaults and appear in `inventory` or `features` like any other. */
  standardCopies?: {
    entry: InstanceId;
    item: QualifiedId;
    saved: boolean;
  }[];
  /** Every content activation (engine-core.md, "Activation"), in instance order: each copy, template, granted, picked and applied piece of content the character has, once per activation. Inline options, the rules and applied content an immunity blocks are left out. A content group's `from: own` members are the holder activations whose item is of the group's type. */
  activations?: {
    /** The content's qualified ID (the base item; a template is its own activation). */
    item: QualifiedId;
    /** The owner copy's instance ID, or for applied content the applied entry's ID; absent for content picked or granted at the rules level. */
    entry?: InstanceId;
    /** How it was reached: `copy` (a `features` or `inventory` entry), `template` (applied to a copy), `grant` (granted by active content, its `when` holding), `pick` (picked in an applicable choice that activates its content) or `applied` (an `applied` entry, or a `scope: applied` grant of one). */
    via: 'copy' | 'template' | 'grant' | 'pick' | 'applied';
    /** `applied` for applied activations; absent for holder ones. */
    scope?: 'applied';
    /** The index in this list of the activation that granted it, owns the choice it was picked in, or owns the template (the nearest listed one, past an inline option); absent for copies, applied entries and content picked or granted at the rules level. */
    parent?: number;
    /** A template content keeps on the copy: the index in this list of the activation that keeps it. Absent for a saved template. */
    keptBy?: number;
    /** Picks: the choice path of the pick, the picked option last. Holder grants whose node is a pick (content granted by picked content or an inline option): that pick's path, which a grant's `setState` names with `path`, `option` and `grant`. */
    path?: ChoicePath;
  }[];
  /** Every applicable choice, answered or not, in pending order: the rules-level choices first, then each activation's own choices, each followed by those of what it picked, before those of the activations it grants. Inline options' choices and `activate: false` choices are included; a slotted choice is one entry per slot. `pending` is the open ones, in the same order. */
  choices?: ListedChoice[];
  /** Copy limits: for each content type with `copies`, in ruleset order, its limits and the character's copies of it (standard copies included), so an app shows Replace instead of Add once `count` reaches `max`, and an item with `perItem` copies already as held. */
  copyLimits?: {
    /** The content type, qualified. */
    type: string;
    max?: number;
    perItem?: number;
    /** How many copies of the type the character holds. */
    count: number;
    /** The copies, in instance order: `features`, then `inventory`. */
    entries: {
      entry: InstanceId;
      item: QualifiedId;
    }[];
  }[];
  /** Qualified IDs of the situational choices offered now (their `available` holds, or they have none), in rules order. */
  situational: QualifiedId[];
  /** Choices that apply and need picks, in a pre-order walk of the activations: the rules-level choices first, then each activation's own choices, each followed by those of what it picked, before those of the activations it grants. They are the `choices` entries with `open` true, with `picked` their number of picks. */
  pending: PendingChoice[];
  /** What the rules offer the character now: its stored ephemeral follow-ups in file order, then its derived offers whose condition holds, the rules' in declaration order and then content's in instance order. Derived from the character file alone, so every app, a reload and an import see the same list. An app runs any entry with startAction and its ID, and dismisses only ephemeral ones. */
  offers?: ListedFollowUp[];
  competing: CompetingOptions[];
  issues: RulesIssue[];
  /** Problems with the character file (runtime error codes). computeSheet never fails; it computes the sheet without the offending part. */
  errors?: EngineError[];
};

export type FieldValue = {
  value?: Literal;
  /** The value from the field's own formula or input, before effects. */
  base?: Literal;
  /** Each effect that changed the value, in application order ("AC 17 = 15 Mage Armor + 2 shield"). */
  breakdown?: {
    op: string;
    value?: Literal;
    source: Source;
  }[];
  /** The field's tags on this sheet, in order: its written tags, then those its `{ formula }` entries give, each once. When its computed tags fail, the written ones. Absent when the field has none. */
  tags?: Tag[];
  /** The field's name from its `nameFrom` string field, when that field's value is a non-empty string (a Lore's subject, "Absalom"). The field's text formats it as `{name}`. */
  name?: string;
  /** Set instead of `value` when this field could not be computed (a loop). Everything else still calculates. */
  error?: EngineError;
};

export type ActiveEffect = {
  source: Source;
  target?: unknown;
  op?: string;
  value?: unknown;
  /** Active but not counted, because of stacking. */
  suppressed?: boolean;
};

export type PendingChoice = {
  path: ChoicePath;
  min?: number;
  max?: number;
  picked?: number;
  /** A slot of a slotted choice: the declared choice ID, whose prompt names it, and the slot's number, the prompt's `{slot}`. */
  slot?: {
    choice: string;
    number: number;
  };
};

/** One choice of the choice list. */
export type ListedChoice = {
  path: ChoicePath;
  /** The key root of the choice's owner, qualified, as a choice step's `needs.choice.owner`: the content ID, `<pack>:rules` for a rules-level choice, and for a choice nested in an inline option the owner's root plus `.choices.<choice>.options.<option>`. The prompt is `<owner>.choices.<id>.prompt` (for a slot, under `slot.choice`). */
  owner: string;
  /** The choice's ID: for a slot of a slotted choice, the slot's own (`class-feat-2`). */
  id: string;
  /** A slot of a slotted choice: the declared choice ID, whose prompt names it, and the slot's number, the prompt's `{slot}`. */
  slot?: {
    choice: string;
    number: number;
  };
  /** The content type the choice draws from, qualified: a query's type, or the one type every item of a written list shares. Absent for inline options, value lists and a list of items of several types. What `hasChoice` in display hints reads. */
  type?: string;
  /** The evaluated minimum number of picks. */
  min: number;
  /** The evaluated maximum number of picks; absent when unbounded. */
  max?: number;
  /** The picked options, in the order saved: content IDs, inline option IDs or values, as `choose` names them. For a preset choice, the grant's. */
  picks: (string | number)[];
  /** Whether the choice is pending: required (`required` not false) with fewer picks than `min`. A preset choice never is. */
  open: boolean;
  /** `true` when a grant presets the choice (its `choices`): `picks` are the grant's, the choice is never open, and `choose` and `unchoose` on it are `preset-choice`. */
  preset?: true;
};

export type CompetingOptions = {
  field: string;
  /** The group's op: `set` for competing `set` effects, or the op of a `playerChooses` stacking group. */
  op: 'set' | 'add' | 'multiply' | 'atLeast' | 'atMost';
  /** For a `playerChooses` stacking group, its stack key as written (`source` for the reserved key). Absent for competing `set` effects. */
  stackKey?: string;
  options: {
    id: string;
    value: Literal;
    source: Source;
  }[];
  recommended: string;
  applied?: string;
};

export type ContinueActionInput = {
  ruleset: Ruleset;
  /** The paused result exactly as startAction or continueAction returned it. */
  paused: {
    status: 'paused';
  };
  answer: Answer;
  policy?: ActionPolicy;
};

export type ContinueActionOutput = ActionResult;

/** A shape, runtime or load error, returned as data with a stable code from `data/error-codes.json`. Apps render it from the code and data; the spec ships standard translations (`i18n/en.yaml`). */
export type EngineError = {
  code: string;
  /** JSON Pointer into the input that caused the error. */
  path?: string;
  data?: Record<string, unknown>;
};

export type ListOptionsInput = {
  ruleset: Ruleset;
  character: CharacterFile;
  choice: ChoicePath;
  links?: Links;
};

export type ListOptionsOutput =
  | {
      /** Every option, ineligible ones included with their reasons. The app decides whether to hide, grey out or allow them. */
      options: {
        option: string | number;
        eligible: boolean;
        picked?: boolean;
        recommended?: boolean;
        /** Exactly the rules issues applyChanges would report if this option were picked anyway. */
        reasons?: RulesIssue[];
      }[];
      min?: number;
      max?: number;
    }
  | {
      errors: EngineError[];
    };

export type LoadRulesetInput = {
  /** Pack releases in load order; later packs win. */
  packs: PackRelease[];
};

export type LoadRulesetOutput =
  | {
      ok: true;
      ruleset: Ruleset;
    }
  | EngineFailure;

export type EngineFailure = {
  ok: false;
  errors: EngineError[];
};

/** The game's rules object to a valid character (a feat needs Str 13; too many attuned items). Applied and reported, or rejected in strict mode. The same object is the reason listOptions gives for an ineligible option. */
export type RulesIssue = {
  /** A spec issue code from `data/rules-issue-codes.json`. */
  code: string;
  /** The pack-defined prerequisite, constraint or immunity ID, qualified (`5e-srd-5.1:attunement-limit`). */
  id?: string;
  source?: Source;
  data?: Record<string, unknown>;
};

/** PROVISIONAL: the output of loadRuleset, passed to every other call. Packs merged in load order, inheritance and overrides resolved, content-only queries resolved. Plain data so it can be cached or sent between machines. Its internal shape beyond these top-level properties is engine-defined: a ruleset is only portable between instances of the same engine. */
export type Ruleset = {
  specVersion: Semver;
  packs: {
    id: PackId;
    version: Semver;
    license: string;
    credit?: string;
    /** The pack's other license notices, by name, in the order written. */
    notices?: Record<string, string>;
  }[];
  /** The fields, by qualified ID. PROVISIONAL shape, except that a field with `members` carries `tagOptions`: every tag the ruleset declares (with the tags above each) that it takes, sorted, for an app's picker. Content types' item fields and actions' parameters with `members` carry it too. */
  fields: Record<
    string,
    {
      tagOptions?: Tag[];
    }
  >;
  /** The content types, by qualified ID. PROVISIONAL shape, except that a type with a copy limit carries it as written (`copies`), so an app reads it here. */
  contentTypes: Record<
    string,
    {
      copies?: Copies;
    }
  >;
  content: Record<string, unknown>;
  rules?: Record<string, unknown>;
  /** The creation starts: every pack's `creation` list in load order, a later start replacing an earlier one with the same `id` in its place. `action` is qualified; `pack` is the pack that declared the start, whose text names it (`creation.<id>.name`). */
  creation?: {
    id: Slug;
    action: string;
    params?: Record<string, unknown>;
    random: boolean;
    pack: PackId;
  }[];
  /** Overrides of the same property by two packs; the later pack won. */
  conflicts?: {
    target: string;
    property?: string;
    packs: string[];
  }[];
};

export type StartActionInput = {
  ruleset: Ruleset;
  character: CharacterFile;
  action: {
    id: string;
    /** The copy the action belongs to, or the applied entry whose source offers it (`scope: applied`), as computeSheet lists it. */
    entry?: InstanceId;
    /** The content the action comes from, as computeSheet lists it: required for an action of picked or granted content, absent otherwise. */
    source?: QualifiedId;
    /** The offer this run takes up: the ID of an entry of computeSheet's `offers` for the character, as its `action` gives it. For an ephemeral offer, the finished run's proposed changes end with `{ type: clearFollowUp, id }` for `self` (step `''`), so applying them deletes the stored entry in the same batch; a failed run, or changes never applied, clear nothing. A derived offer needs no clearing: the action's changes end the condition. An ID the character isn't offered is `unknown-follow-up`. */
    followUp?: string;
  };
  params?: Record<string, unknown>;
  /** Selected situational choices by qualified ID. */
  situational?: Record<string, Literal>;
  policy?: ActionPolicy;
  links?: Links;
  /** The other characters taking part, by role the action declares: per role, a list of views in order, each `{ id, values }` from that character's own computeSheet. IDs are unique across the call (`duplicate-id`). Values match the role's declared fields by field ID without the pack; a wrong type, or two values with one field ID, is `invalid-link-value`. An undeclared role, or a count outside the role's `min`/`max`, is `invalid-participants`. */
  participants?: Record<string, View[]>;
  /** Answers to replay, one per pause in order, each exactly as continueAction takes it. The result is what startAction then continueAction with each answer in turn would return, with the same policy and dice function: finished, paused at the first pause left unanswered, or a failure. An answer that doesn't fit its pause, or one left over after the action finishes, is `answer-mismatch` with `data.index` (its index here) and, for a pause, `data.needs`. Omitted or empty, startAction runs as without it. */
  answers?: Answer[];
};

export type StartActionOutput = ActionResult;

export type UpgradeInput = {
  from: Ruleset;
  to: Ruleset;
  character: CharacterFile;
};

export type UpgradeOutput =
  | {
      ok: true;
      character: CharacterFile;
      pending: PendingChoice[];
      /** What changed: the character computed under both versions. */
      report: {
        values?: {
          field: string;
          before?: Literal;
          after?: Literal;
        }[];
        /** Upgrade steps that changed this character, with the script each came from. */
        steps?: {
          pack: string;
          from: string;
          to: string;
          step: UpgradeStep;
        }[];
        /** The upgraded character's computeSheet errors (references no script handled). */
        errors?: EngineError[];
        /** Each place in the character's homebrew a step rewrote, in order. */
        homebrew?: {
          /** A JSON Pointer into the upgraded character. */
          path: string;
          step: UpgradeStep;
        }[];
      };
    }
  | EngineFailure;

/** A character field declared by the rules. Input fields are base state the player supplies and the character file saves; all other fields are derived (formula, effects, grants) and never saved. Text: `fields.<id>.name`, `fields.<id>.short`. */
export type Field = {
  type: ValueType;
  /** enum: the allowed values. */
  values?: Slug[];
  /** id/set: what the members are: a content type name, `field`, `tag` or `string`. */
  of?: Name;
  /** id/set of `tag`: which tags it takes. Without it, any declared tag. */
  members?: TagMembers;
  /** True for base state saved in the character file (ability scores, current HP). Input fields have no formula; effects still apply on top. */
  input?: boolean;
  /** Input fields: the value when the character file has none. */
  default?: Literal;
  /** Derived fields: how the value is computed. A field with neither `input` nor `formula` starts empty (sets) or at its default and is filled by effects. */
  formula?: Formula;
  /** Lowest valid value (a formula). Input values below it are runtime errors (`out-of-range`). */
  min?: Formula;
  /** Highest valid value (a formula). */
  max?: Formula;
  /** Tags that let queries, display groups and effects on sets of fields find the field. An entry may be `{ formula }`: evaluated on the character's sheet like the field's own formula, it gives one declared tag or a list of them. Effects on a set of fields, field parameters and allocate steps see the computed tags; queries over fields, display groups and the field functions' static filter see the written ones only. A failing tag formula fails the field. */
  tags?: TagList;
  /** Overrides the game's rounding for multiply effects on this field. */
  rounding?: Rounding;
  /** When several `set` effects compete for this field, which one the rules recommend. Default: the game's `settings.competing.recommend`. */
  recommend?: RecommendPolicy;
  deprecated?: Deprecation;
  /** A string field whose value names this field, for a field the player names (a Lore of a city). computeSheet gives the value as the field's `name` when it is a non-empty string, and the field's text (`fields.<id>.name`) formats it as `{name}`. */
  nameFrom?: FieldRef;
  /** Incoming decreases drain these input fields first, in order, down to their minimum, before this field (temporary hit points). Only for numeric input fields. */
  absorbedBy?: FieldRef[];
  /** What happens when an adjust takes this input field past a bound, instead of clamping: adjust `into` by `by` (default 1), then set this field to `reset`. The adjust on `into` is routed like any other (it can overflow in turn, up to `maxOverflowChain`). Excess beyond the bound is carried over only with `carry`. */
  overflow?: {
    /** Which bound. */
    at: 'max' | 'min';
    /** Trigger on reaching the bound, not only on passing it (Mothership: health reaching 0). Default false. */
    inclusive?: boolean;
    into: FieldRef;
    by?: Formula;
    reset: Formula;
    /** After the reset, the excess past the bound (the result less the bound: positive past `max`, negative past `min`) is routed into this field again as an adjust with `reason: carry`, so it can overflow in turn (FitD heat: 7 and 4 more is a wanted level and 2 heat). Default false: the excess is dropped. */
    carry?: boolean;
    tags?: Tags;
  }[];
  /** Bounds on the final value, after effects. A final value outside them is the rules issue `out-of-limits` (not clamped, not an error). Unlike `min`/`max`, which check an input's saved value. */
  limits?: {
    min?: Formula;
    max?: Formula;
  };
};

export type RecommendPolicy = 'highest' | 'lowest' | 'first' | 'last';

/** What the rules call for on a character: an action to run, changes to apply, or a linked character to make. Two kinds. A **derived** offer (`while`) is offered exactly as long as its condition holds; computeSheet derives it and nothing is stored. An **ephemeral** offer (`on`, an adjustment to a field; `becomes`, a condition false before a batch and true after it) is stored in the character file by the applyChanges that triggered it, until it is acted on or dismissed (a `becomes` one also until its condition is false). The engine never runs or applies either. Declared at the rules level, on a content type or on a content item; on content it applies while the character has the copy or pick, as effects do. A follow-up with no trigger (none of `on`, `becomes` and `while`) is offered only by an action proposing an `offerFollowUp` change that names it, and is then stored as an ephemeral one; an `on` or `becomes` one may be offered so too. */
export type FollowUp = {
  /** Unique among the rules' follow-ups, or within the content type or item. Text keys: `followUps.<id>.name` and `.description` (rules), `<contentId>.followUps.<id>.…` and `types.<type>.followUps.<id>.…` (both optional). */
  id: Slug;
  /** An ephemeral offer: fires once for each entry of the batch's `adjustments` on `field` whose tags include any of `tags` (a tag matches its subtags), or any entry on the field when `tags` is left out. Overflow entries count. In `when`, `params` and `changes`, `change` is that entry. With `once: true` it fires at most once per batch, when at least one entry matches, and `change` is the matching entries summed. */
  on?: {
    field: FieldRef;
    tags?: Tag[];
    /** Fire at most once per batch, on the matching entries summed: `by`, `requested` and `taken` the sums (an absent part counting 0), `tags` the union in entry order, `reason` the first entry's, `clamped` true if any entry's is. `when` is evaluated once, on the sum. A batch is one action's changes as the app applies them, so this is once per source when each attack is its own batch. Default false. */
    once?: boolean;
  };
  /** An ephemeral offer: fires once when this condition is false on the character before the batch and true after it, and is stored until acted on or dismissed, or until the condition is false after a batch; a copy still stored isn't stored again. For content the character didn't have before the batch, it counts as false before. */
  becomes?: Condition;
  /** A derived offer: offered whenever this condition holds on the character, derived by computeSheet and never stored, so a character set up by hand or imported sees it too. The condition must test the imbalance itself (experience earns more levels than the character has), not a proxy for it (experience changed since the last level-up), so taking the offer and editing the sheet by hand both end it. Re-evaluated after every change, so a level-up is offered one level at a time. */
  while?: Condition;
  /** Evaluated on the character after the whole batch (an ephemeral offer) or on the current character (a derived offer); the follow-up fires or is offered only when it holds. */
  when?: Condition;
  /** Whose follow-up it is: `self` (the default, the character the batch changed) or `{ link: <slot> }`, the character filling one of its link slots. A follow-up to a link names the linked character's action, fields and content by qualified ID. */
  to?:
    | 'self'
    | {
        link: Name;
      };
  /** The action to run: a rules action (local or qualified ID) or, on content, also the content's own action. */
  action?: string;
  /** Formulas for the action's parameters. Parameters it doesn't fix are left for the app to supply. */
  params?: Record<string, Formula>;
  /** Changes to apply, resolved like an action's `changes` step: formulas evaluated, fields qualified, `entry: self` the content's copy, `pick: self` and `grant: self` the pick or holder grant that made the content active, `path`, `option`, `picks` and `grants` passed on. No `split`. */
  changes?: ProposedChange[];
  /** A derived offer to make a new character for one of the character's empty link slots: the app makes a character file with `creating: true`, runs the named creation start on it with `params`, and saves the new character's ID in this character's `links`, which ends the offer. Only with `while`, and instead of `action`, `changes` and `to`. Offered while `while` and `when` hold and the slot is empty (no saved link and no view). */
  create?: {
    /** The empty link slot to fill: a slot the pack sees, by name (`hound`) or qualified ID. */
    link: string;
    /** The creation start to run on the new character: its `id` (`companion`), or `<pack>:<id>` with the pack that declares it. Its pack must be the slot's `pack` or one of that pack's dependencies, so a character using the slot's pack has it. */
    start: string;
    /** Formulas for the start's action's parameters, evaluated on this character; given over the start's own `params`. A formula that gives `null` leaves the parameter out. */
    params?: Record<string, Formula>;
  };
  /** Whether the rules mandate it: an app shouldn't let the player skip it. Advisory only: the engine blocks nothing, it is not a rules issue, and an ephemeral one can still be dismissed. Default false. */
  required?: boolean;
};

/** A formula in the OCF formula language (CEL-like syntax plus dice notation), defined in docs/formulas.md. In pack sources a formula is text, or a plain number or boolean (a formula with no inputs). Releases carry `compiled` formulas: canonical text plus the parsed tree. */
export type Formula = string | number | boolean;

/** A formula that must evaluate to true or false (`when`, `showWhen`, prerequisites, query `where`). */
export type Condition = Formula;

/** A formula containing dice notation, e.g. `1d8`, `2d20kh1 + abilities.str.mod`, `(actions.skirmish)d6kh1`. */
export type DiceFormula = Formula;

/** A parsed formula: plain JSON. See docs/formulas.md, "The tree". Trees produced by the parser round-trip exactly through the printer. */
export type FormulaTree =
  | IntNode
  | DecimalNode
  | StringNode
  | RefNode
  | BoolNode
  | NullNode
  | ListNode
  | NameNode
  | MemberNode
  | IndexNode
  | CallNode
  | UnaryNode
  | BinaryNode
  | ConditionalNode
  | DiceNode;

/** A formula as it appears in a release: canonical text plus its parsed tree. */
export type CompiledFormula = {
  text: string;
  tree?: FormulaTree;
};

export type IntNode = {
  type: 'int';
  value: number;
};

export type DecimalNode = {
  type: 'decimal';
  /** The literal's value, rounded to six places when parsed (docs/formulas.md, "Six places"). */
  value: number;
};

export type StringNode = {
  type: 'string';
  value: string;
};

/** An ID literal: `@classes.fighter`. Its value is a string, the content, field, content type, action or link slot ID resolved in the formula's pack (qualified). */
export type RefNode = {
  type: 'ref';
  id: string;
};

export type BoolNode = {
  type: 'bool';
  value: boolean;
};

export type NullNode = {
  type: 'null';
};

export type ListNode = {
  type: 'list';
  items: FormulaTree[];
};

export type NameNode = {
  type: 'name';
  path: string[];
};

export type MemberNode = {
  type: 'member';
  object: FormulaTree;
  name: string;
};

export type IndexNode = {
  type: 'index';
  object: FormulaTree;
  index: FormulaTree;
};

export type CallNode = {
  type: 'call';
  fn: string;
  args: FormulaTree[];
};

export type UnaryNode = {
  type: 'unary';
  op: '-' | '!';
  operand: FormulaTree;
};

export type BinaryNode = {
  type: 'binary';
  op: '||' | '&&' | '<' | '<=' | '>' | '>=' | '==' | '!=' | 'in' | '+' | '-' | '*' | '/' | '%';
  left: FormulaTree;
  right: FormulaTree;
};

export type ConditionalNode = {
  type: 'conditional';
  test: FormulaTree;
  then: FormulaTree;
  else: FormulaTree;
};

export type DiceNode = {
  type: 'dice';
  count: number | FormulaTree;
  sides: number | 'F';
  modifiers: DiceModifier[];
  /** A zero-based die (`d100z`): faces 0 to sides - 1. Present only when true. */
  zero?: true;
};

/** A character's own content and rules additions: a small pack that belongs to the character, built on the packs it pins. Engines load it as a last pack with the reserved ID `homebrew`, which depends on every pinned pack in pin order, so its definitions are `homebrew:<id>` and its references resolve in the homebrew first, then in the pinned packs. It may not override or hide pinned packs' content, nor change settings (`homebrew-not-allowed`). Its size is bounded by the safety limits `maxHomebrewItems` and `maxHomebrewFormulas`. */
export type CharacterHomebrew = {
  /** The language of the homebrew's own text. Required when `i18n` is present. */
  defaultLanguage?: LanguageTag;
  /** Rules-level definitions, in the shape of a rules document, without `settings`. */
  rules?: RulesDocument;
  /** Content items, each with its own `id` and `type`. `override` items are not allowed. */
  content?: (ContentItem & Record<string, unknown>)[];
  /** Translations by language tag, keyed exactly as in a pack's i18n files (`<id>.name`, `fields.<id>.name`). Engines never read them. */
  i18n?: Record<string, TranslationFile>;
};

/** All player-facing text for one pack in one language: a flat map from translation key to an ICU MessageFormat string. The language comes from the file name (`i18n/de.yaml`). A language may be split over several files (`i18n/de/*.yaml`); the build merges them. */
export type TranslationFile = Record<string, string>;

/** The single JSON document the build produces from a pack's source files, and the unit loadRuleset takes. Formulas stay as written; `formulas` maps each formula's text to its canonical text and parsed tree. */
export type PackRelease = {
  manifest: PackManifest;
  rules: RulesDocument;
  content: ContentItem[];
  upgrades?: UpgradeScript[];
  /** Translations bundled with this release, by language tag (normally only the default language). */
  i18n?: Record<string, TranslationFile>;
  /** Every formula in the release written as text, compiled: source text → { text (canonical), tree }. Ports can walk trees without a parser; formulas elsewhere in the release stay as written. */
  formulas?: Record<string, CompiledFormula>;
};

/** `pack.yaml`: identifies a content pack and declares its version, license, credit line and other license notices, dependencies, minimum spec version and default language. The pack's display name is the translation key `pack.name`. */
export type PackManifest = {
  /** `homebrew` is reserved for a character's own homebrew. */
  id: PackId;
  /** This pack's version. Every update gets a unique version; published versions never change. */
  version: Semver;
  /** The minimum OCF spec version this pack needs. loadRuleset refuses a pack that needs a newer spec. */
  specVersion: Semver;
  /** An SPDX license identifier (`CC-BY-4.0`, `CC0-1.0`), `ORC`, `OGL-1.0a` (the Open Game License v1.0a, which has no SPDX identifier), or `mechanics-only` for packs that carry no copyrighted text. */
  license: string;
  /** The credit line (attribution) the license requires. Required for CC-BY and ORC licenses; must reach downstream users. */
  credit?: string;
  /** Other legal notices the license requires besides `credit`, by name, in the order written. Legal text, shown verbatim and not translated; must reach downstream users after `credit`. An `ORC` pack must have `orc` (the ORC Notice), `reserved-material` and `expressly-designated` (the Expressly Designated Licensed Material notice); an `OGL-1.0a` pack must have `ogl-license` (the license's full text) and `section-15` (its COPYRIGHT NOTICE); other names may follow. */
  notices?: Record<string, string>;
  defaultLanguage: LanguageTag;
  /** Packs this pack builds on, by pack ID and version range. */
  dependencies?: Record<string, SemverRange>;
  /** Homebrew: content from dependencies to hide from this ruleset. */
  hides?: QualifiedId[];
  homepage?: string;
};

/** A link to a set of things, written as a rule instead of a list. Names a content type (or `field`, `template`, `contentType`, or `action` in an actions display group) and a `where` condition evaluated against each candidate as `item`. Queries that refer only to `item` are resolved once by loadRuleset after all packs are merged; queries that refer to the character run during computeSheet and listOptions. */
export type Query = {
  /** A content type name, or one of the built-in kinds `field`, `template` and `action` (an actions display group's members). */
  type: Name;
  where?: Condition;
};

/** One piece of an itemized roll, as structured data rather than a display string. Pieces that add together are separate items; each has exactly one source. Apps build their own labels. PROVISIONAL shape: the exact shape of roll items may still change. */
export type RollItem = {
  kind: 'flat' | 'dice';
  /** flat: the number. dice: the total after dice modifiers (present once rolled). Multiplied by `factor` when a `multiply` roll modifier applied. */
  value?: number;
  /** dice: how many dice are rolled (advantage on 1d20 gives count 2 with keepHighest 1). */
  count?: number;
  /** dice: faces per die, or `F` for Fate dice. */
  sides?: number | 'F';
  modifiers?: DiceModifier[];
  /** dice: every die rolled, in order, including dropped, rerolled and exploded dice. */
  faces?: RolledFace[];
  source: Source;
  tags?: Tags;
  /** On the item of a part that reads a field: the field's keyed `add` effects that counted on the sheet but lose to a roll effect with the same stack key, each `{ source, value }`. The item's `value` is the field's less these. Absent when none. */
  dropped?: {
    source: Source;
    value: number;
  }[];
  /** dice: zero-based faces (0 to sides - 1), from `dNz`. */
  zero?: boolean;
  /** `false` when the item was added by an effect, or comes from a roll part, with `multiplied: false`, so `multiplyDice` and `multiply` left it alone. Absent otherwise. */
  multiplied?: false;
  /** The product of the `multiply` roll modifiers' factors applied to the item; `value` is the multiplied value. Absent when none applied. */
  factor?: number;
  /** dice: -1 when the dice are subtracted (`- 1d4`). Default 1; `value` is already signed. */
  sign?: 1 | -1;
  /** On the first item of a part a `set` roll effect replaced, whose `source` is the effect's (or the field its value names): the part's items as built before, unrolled. Absent otherwise. */
  replaces?: RollItem[];
  /** dice: the die's sides before `stepDie` roll modifiers changed them; `sides` is the new size. Absent when unchanged. */
  steppedFrom?: number;
};

/** A standard dice modifier. Types are kept in sync with `data/dice-modifiers.json`. */
export type DiceModifier = {
  type:
    | 'keepHighest'
    | 'keepLowest'
    | 'dropHighest'
    | 'dropLowest'
    | 'explode'
    | 'explodeCompound'
    | 'reroll'
    | 'rerollOnce'
    | 'countSuccesses'
    | 'countFailures'
    | 'minimum'
    | 'maximum';
  /** keep/drop: how many dice. reroll, rerollOnce: at most this many of the initial dice matching the comparison are rerolled, lowest faces first (a `reroll` roll modifier's `count`; no dice notation). */
  count?: number;
  compare?: '=' | '<' | '<=' | '>' | '>=';
  target?: number;
};

export type RolledFace = {
  value: number;
  kept?: boolean;
  /** This die was replaced by a reroll. */
  rerolled?: boolean;
  /** This die was added by an explosion. */
  exploded?: boolean;
  success?: boolean;
  failure?: boolean;
  /** Where this die came from, when it differs from the item's own source (a pool die added by an effect). */
  source?: Source;
  /** This face was given by a `setFaces` roll modifier, not rolled. */
  set?: true;
};

/** The rules layer of a pack: fields and their formulas, content types, game settings, situational choices, result bands, shared actions, always-on effects, character-level choices, constraints and display hints. A pack may split its rules over several files in `rules/`; every section is optional and the build merges them. IDs must be unique across the merged result. */
export type RulesDocument = {
  /** Named lists of keys: any mapping key of the pack's rules documents that holds `{<name>}` stands for one entry per value, with `{<name>}` replaced in the key and in every string of the entry. Declared once per pack, in any rules document; seen by the pack and the packs that depend on it. A qualified name (`<pack>:<name>`) adds values to that pack's family. Expanded by the engine with the packs loaded together; a built release keeps it as written. */
  families?: Record<string, (string | number)[]>;
  /** Named sets of declared fields read from other characters: a link slot's or a participant role's `fields` may name one instead of declaring them again. Expanded before the pack loads. */
  viewFields?: Record<string, DeclaredFields>;
  fields?: Record<string, Field>;
  /** Link slots: named places for another character, such as a scoundrel's crew. A character file saves which character fills each slot (`links`), and the app passes that character's view (`{ id, values }`) to the calls. Formulas read it as `links.<slot>`. Slot IDs are names, qualified like field IDs. Text: `links.<slot>.name` (optional). */
  links?: Record<string, LinkSlot>;
  contentTypes?: Record<string, ContentType>;
  /** Item fields every template may set, by name, merged across packs: a name declared again must have the same `type` (and `of` and `values`), else the load error `template-field-mismatch`; the later declaration replaces the earlier. A copy's `item` has each one its content type doesn't declare: the last value its templates give, else the declaration's `default`, else it is absent. Each is named by `templateFields.<name>.name` (required) and `.description` (optional) in the declaring pack's text. */
  templateFields?: Record<string, ValueDecl>;
  settings?: Settings;
  situational?: SituationalChoice[];
  /** Roll tallies: named integer counters on a roll that effects add to without changing its total. Roll steps expose them as `steps.<id>.tallies.<name>`, result bands as `roll.tallies.<name>`. Text: `tallies.<name>.name` (optional). */
  rollTallies?: Name[];
  /** Named sets of result bands, e.g. FitD's 1–3 / 4–5 / 6 / critical. Bands are checked in order; the first whose `when` is true wins. Formulas see the roll as `roll` (`roll.total`, `roll.faces`, `roll.kept`) and the running action's `flags`, `params` and `steps` (provisional). A set is a list of bands, or `{ value, bands }`: `value` is evaluated once per classification, before the bands, which read it as `roll.value`. */
  resultBands?: Record<
    string,
    | BandList
    | {
        /** A formula in the band context, evaluated once each time the set classifies a roll; its bands read it as `roll.value`, and the roll step's result keeps it as `bandValue`. */
        value: Formula;
        bands: BandList;
      }
  >;
  /** Shared actions items and content types can `use`. A shared action has no `scope`: the `use` that lists it does. */
  actions?: Action[];
  /** Effects that are always active (critical hits doubling damage dice). */
  effects?: Effect[];
  /** What the rules say should happen next when a change does something to the character: listed by applyChanges, never run by it. */
  followUps?: FollowUp[];
  /** How a character is created: the starting points an app offers for a new character, each running a rules action. An app offers a guided run of every start, a random run of a start with `random`, and always a blank sheet (manual creation). A start's text is `creation.<id>.name`. Packs' lists are concatenated in load order, and a later start with the same `id` replaces the earlier one in its place. Without any start, characters are created by hand only. */
  creation?: CreationStart[];
  /** Content every character of the game holds a copy of, e.g. FitD's standard gear: queries that read only `item`, resolved by loadRuleset. Each match is a standard copy with the instance ID `<pack>-<local ID>`, the colon and dots as hyphens, in `inventory` for carried types and `features` otherwise; the character file saves it only once it differs from its defaults. */
  standardCopies?: Query[];
  /** Applied content every character of the game can't be affected by while the immunity's `when` holds, e.g. a monster's condition immunities listed in an input set field. Without `scope`: the rules are always a holder. */
  immuneTo?: Immunity[];
  /** Character-level choices (pick a playbook). */
  choices?: Choice[];
  /** Game rules checked against the current character. A failing check is a rules issue with code `constraint-failed` and this constraint's ID. With `copies`, the check runs once per copy of a content type, and each copy that fails is an issue of its own. */
  constraints?: {
    id: Slug;
    check: Condition;
    /** Values reported with the issue so the app can render it (`limit: 3`). */
    data?: Record<string, Formula>;
    /** Check each of the character's copies of this content type (`features` and `inventory`, standard copies included) whose `where` holds, with `item` and `self` that copy's item and copy, as a choice step over copies sees them (its computed values included). Each failing copy is its own `constraint-failed`, its instance ID in `data.entry` and its own `data` values evaluated for it. */
    copies?: {
      type: Ref;
      where?: Condition;
    };
  }[];
  display?: DisplayHints;
  /** The tags this pack declares. Every tag the pack uses (content, fields, rolls, effects, changes, `tag` set members) must be declared here or by a dependency. Declaring `damage.fire` also declares `damage`. Optional text: `tags.<tag>.name`. */
  tags?: Tag[];
};

/** Result bands, checked in order. */
export type BandList = {
  id: Slug;
  when: Condition;
  tags?: Tags;
}[];

export type Settings = {
  /** How the game rounds results of multiply effects and decimal division (5E rounds down). Default `floor`. */
  rounding?: Rounding;
  stacking?: {
    /** Policy for effects sharing a stack key that has no specific policy. Default `addAll`. */
    default?: StackingPolicy;
    /** Policy per stack key (`source`, `item`, `status`, …). */
    keys?: Record<string, StackingPolicy>;
  };
  competing?: {
    recommend?: RecommendPolicy;
  };
  /** How multiply effects on incoming changes round: `value` rounds the signed amount (default); `magnitude` rounds its size and restores the sign, so halving −11 damage gives −5 with `floor` (5E: round down the damage). */
  roundIncoming?: 'value' | 'magnitude';
  /** How opposing roll modifiers combine. `advantage`: `cancel` (default; advantage and disadvantage together cancel, and any number of sources give one extra die), `net` (the difference between the counts of sources decides the direction and number of extra dice), or `stack` (every source adds a die; both kinds together is an error in the pack). */
  rollModifiers?: {
    advantage?: 'cancel' | 'net' | 'stack';
  };
};

/** Kept in sync with `data/stacking-policies.json`. */
export type StackingPolicy = 'addAll' | 'highestOnly' | 'lowestOnly' | 'playerChooses';

export type LinkSlot = {
  /** The pack the linked character is expected to use. Optional, and not a dependency: any character whose view has the declared fields may fill the slot. When this pack is loaded alongside, loadRuleset and the build check each declared field against it (`link-field-mismatch`); the engine never checks the linked character's packs. */
  pack?: PackId;
  /** The fields this pack reads from the linked character, typed, so formulas type-check without the other pack; or the name of a `viewFields` set. */
  fields: DeclaredFields | ViewFieldsRef;
};

/** One way to start creating a character: a rules action, run on a character with `creating: true`. */
export type CreationStart = {
  /** The start's ID, unique across the loaded packs (a later pack's start with the same ID replaces it). Text: `creation.<id>.name` and, optionally, `creation.<id>.description`. */
  id: Slug;
  /** A rules action: a local or qualified action ID. Every parameter it requires must be given in `params`. */
  action: string;
  /** Parameters the start passes to the action, as literal values, so two starts can share one action. */
  params?: Record<string, Literal>;
  /** Default false. Set it only when the source creates characters at random: running the action with every checkpoint automatic (`{ dice: auto, choices: auto, allocations: auto }`) makes a character the source's own random creation could produce. Without it, an automatic run takes each step's recommendation, a default character rather than a random one. `pnpm validate` warns about a step that would pause in such a run: a choice step over a written list, or an `allocate` step, without `recommend`. */
  random?: boolean;
};

/** A choice the player or GM makes when a roll happens (advantage, cover, a GM's bonus, pushing yourself) or when a change arrives (a reaction that halves one attack's damage), declared in game data so apps can offer it without knowing the game. Formulas see the selected value as `situational.<id>`. */
export type SituationalChoice = {
  id: Name;
  type: 'boolean' | 'integer' | 'enum';
  /** Allowed values when `type` is `enum`. */
  values?: Slug[];
  default?: Literal;
  /** Roll tags this choice is offered for. A tag matches itself and every tag below it. */
  rolls?: Tags;
  /** Incoming changes this choice is offered for, matched as an incoming-change effect's target is: an `adjust` whose field is one of `fields` (if given) and with a tag matching one of `tags` (if given). The receiving player selects it on the change (`situational` on an `adjust`); its incoming-change effects then apply while that change is routed. */
  incoming?: {
    fields?: FieldRef[];
    tags?: Tags;
  };
  /** When the choice is offered: a condition on the character (fields and `character`), checked before any roll. Absent means always. */
  available?: Condition;
  /** Effects that apply while this choice is selected (boolean) or non-default (integer, enum): its roll effects on a roll it is selected for, its incoming-change effects on a change it is selected for. The selected value is visible as `situational.<id>`. */
  effects?: Effect[];
  label?: I18nKey;
};

/** Data, not code: moves saved characters from one pack version to the next when the saved state's shape changes. Scripts chain one version at a time. Steps are a fixed set kept in sync with `data/upgrade-steps.json`; computed defaults are formulas. */
export type UpgradeScript = {
  pack: PackId;
  from: Semver;
  to: Semver;
  steps: UpgradeStep[];
};

export type UpgradeStep = {
  op:
    | 'renameContent'
    | 'removeContent'
    | 'renameField'
    | 'removeField'
    | 'setDefault'
    | 'mapValues'
    | 'renameState'
    | 'removeState'
    | 'moveState'
    | 'renameChoice'
    | 'removeChoice'
    | 'renameOption'
    | 'requireChoice'
    | 'renameContentType'
    | 'renameItemField'
    | 'removeItemField'
    | 'mapItemValues'
    | 'renameTag'
    | 'renameAction'
    | 'adoptStandard';
  /** The old name. renameContent, renameField, renameContentType, renameItemField, renameTag, renameAction: the ID. renameState, moveState: the state key. renameChoice: the choice ID on `owner`, or a prefixed choice key as saved (`<qualified id>/<choice>`, a granted or template content's choice), whose picks in `owner`'s trees become its choice `to`. renameOption: the picked option. */
  from?: string;
  /** The new name, as for `from`. moveState: the target's state key (default `from`). renameOption: the replacing option; absent, the pick is removed. */
  to?: string;
  id?: string;
  field?: FieldRef;
  /** renameState, removeState, moveState: limits the step to content of this content type (with `item`, both must match). renameItemField, removeItemField, mapItemValues: the homebrew items' content type. */
  type?: Name;
  value?: Formula;
  map?: Record<string, Literal>;
  /** Choice steps: whose choice it is (absent: the rules). moveState: the owner of `choice`, whose pick of `option` in the copy's own choice tree, at any depth, receives the value (absent: a rules-level choice). A path names a choice nested in an inline option (see `choiceOwner`). */
  owner?: ChoiceOwner;
  /** removeChoice, renameOption, requireChoice: the choice on `owner`, as saved (a slot is its own key). moveState: the choice whose pick receives the value; a slotted one is searched slot by slot. */
  choice?: Slug;
  /** adoptStandard: the item whose standard copy an entry becomes. renameState, removeState, moveState: limits the step to content `item` and homebrew items extending it (with `type`, both must match). */
  item?: Ref;
  /** removeState: the state key to drop. */
  key?: Name;
  /** moveState: the granted content whose saved state on the copy (its `grants`) receives the value. */
  grant?: Ref;
  /** moveState: the picked option, in choice `choice` of `owner` (or the rules), whose pick receives the value. */
  option?: string | number;
};

/** Whose choice a step names: content (a local or qualified ID); for a choice nested in an inline option, that content then each choice and inline option down to it, joined by `/` (`classes.operative/specialization/ghost`). A path with an even number of parts starts at a rules-level choice (`motto/brave`). Absent: the rules. */
export type ChoiceOwner = Ref | string;

/** Codes in `data/error-codes.json`. */
export type ErrorCode =
  | 'invalid-shape'
  | 'unknown-change-type'
  | 'unknown-id'
  | 'unknown-field'
  | 'not-input-field'
  | 'wrong-type'
  | 'out-of-range'
  | 'not-owned'
  | 'duplicate-id'
  | 'standard-copy'
  | 'not-equippable'
  | 'unknown-state-key'
  | 'template-not-applicable'
  | 'unknown-choice'
  | 'invalid-option'
  | 'not-picked'
  | 'not-granted'
  | 'preset-choice'
  | 'pack-version-mismatch'
  | 'unknown-link'
  | 'homebrew-error'
  | 'invalid-link-value'
  | 'rules-issue'
  | 'creation-incomplete'
  | 'faces-required'
  | 'faces-mismatch'
  | 'spec-version-unsupported'
  | 'missing-dependency'
  | 'duplicate-pack'
  | 'homebrew-not-allowed'
  | 'duplicate-content-id'
  | 'unknown-reference'
  | 'circular-formula'
  | 'formula-error'
  | 'unknown-tally'
  | 'then-without-copy'
  | 'template-without-copy'
  | 'link-field-mismatch'
  | 'invalid-create-offer'
  | 'invalid-family'
  | 'link-start-mismatch'
  | 'invalid-item-field'
  | 'template-field-mismatch'
  | 'unknown-role'
  | 'circular-extends'
  | 'safety-limit-exceeded'
  | 'unknown-action'
  | 'situational-unavailable'
  | 'missing-param'
  | 'invalid-participants'
  | 'undeclared-result'
  | 'answer-mismatch'
  | 'proposed-changes-failed'
  | 'formula-syntax'
  | 'unknown-name'
  | 'unknown-function'
  | 'wrong-arity'
  | 'type-mismatch'
  | 'division-by-zero'
  | 'overflow'
  | 'no-such-key'
  | 'index-out-of-range'
  | 'invalid-face'
  | 'unknown-tag'
  | 'conflicting-roll-modifiers'
  | 'no-upgrade-path'
  | 'version-not-increased'
  | 'version-bump-too-small'
  | 'missing-upgrade-script'
  | 'upgrade-script-incomplete'
  | 'unknown-follow-up';

/** Codes in `data/rules-issue-codes.json`. */
export type RulesIssueCode =
  | 'prerequisite-not-met'
  | 'constraint-failed'
  | 'too-many-picks'
  | 'too-few-picks'
  | 'choice-not-applicable'
  | 'no-eligible-option'
  | 'option-not-eligible'
  | 'content-hidden'
  | 'immune'
  | 'already-picked'
  | 'out-of-limits'
  | 'too-many-copies';

import type { CharacterDoc } from './pack-types.ts';
import type { Ruleset } from './ruleset.ts';
import { offers, type ListedFollowUp } from './follow-ups.ts';
import { withHomebrew } from './homebrew.ts';
import { type Links, type ListedActivation, type ListedChoice, Sheet } from './sheet.ts';

export type {
  ActionAnswer,
  ActionInput,
  ActionResult,
  DiceFunction,
  LogEntry,
  Need,
  Policy,
  RollItem,
} from './actions.ts';
export { continueAction, diceFrom, randomDice, startAction } from './actions.ts';
export type { Adjustment, ApplyResult, Change } from './changes.ts';
export type { ListedFollowUp, StoredFollowUp } from './follow-ups.ts';
export type {
  CheckReleaseResult,
  ReleaseDependencies,
  ShapeChange,
  UpgradeReport,
  UpgradeResult,
} from './upgrade.ts';
export { checkRelease, upgrade } from './upgrade.ts';
export { applyChanges } from './changes.ts';
export type { HomebrewResult } from './homebrew.ts';
export { withHomebrew } from './homebrew.ts';
export type { EngineError, LoadResult, LoadRulesetOptions } from './load.ts';
export { loadRuleset } from './load.ts';
export type { ListOptionsResult, OptionResult } from './options.ts';
export { listOptions } from './options.ts';
export type * from './pack-types.ts';
export type { PackRelease, PackSource } from './release.ts';
export { buildRelease } from './release.ts';
export type { Ruleset } from './ruleset.ts';
export { resolveId } from './ruleset.ts';
export type {
  ChoicePath,
  CompetingOptions,
  CopyLimitStatus,
  Links,
  ListedActivation,
  ListedChoice,
  RulesIssue,
  Source,
  StandardCopy,
  View,
} from './sheet.ts';
export type { CharacterFile, FieldValue } from '@opencharacter/spec';

/**
 * computeSheet: every value with its breakdown, effects, actions, pending choices, offers, issues.
 * `competing` lists the app's picked competing-option IDs; each group applies the first of its
 * options that is listed, else its recommendation. `links` are the views of the characters
 * filling the link slots.
 */
export function computeSheet(
  ruleset: Ruleset,
  character: CharacterDoc,
  competing: readonly string[] = [],
  links: Links = {},
) {
  const layered = withHomebrew(ruleset, character);
  if (!layered.ok) {
    return {
      values: {} as ReturnType<Sheet['values']>,
      copies: {},
      copyNames: {} as Record<string, string>,
      standardCopies: [] as Sheet['standard'],
      activations: [] as ListedActivation[],
      choices: [] as ListedChoice[],
      copyLimits: [] as ReturnType<Sheet['copyLimits']>,
      effects: [],
      actions: [],
      situational: [],
      pending: [],
      offers: [] as ListedFollowUp[],
      competing: [],
      issues: [],
      errors: layered.errors,
    };
  }
  const sheet = new Sheet(layered.ruleset, character, competing, links);
  const values = sheet.values();
  // Computed values on copies come after every field.
  const copies = sheet.copies();
  const { pending } = sheet.pending();
  return {
    values,
    copies,
    copyNames: sheet.copyNames(),
    standardCopies: sheet.standard,
    activations: sheet.activationList(),
    choices: sheet.choiceList(),
    copyLimits: sheet.copyLimits(),
    effects: sheet.activeEffects(),
    actions: sheet.actions(),
    situational: sheet.situational(),
    pending,
    offers: offers(layered.ruleset, sheet),
    competing: sheet.competing,
    issues: sheet.issues(),
    errors: sheet.errors,
  };
}

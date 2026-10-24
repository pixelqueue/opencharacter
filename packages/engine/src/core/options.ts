import type { EngineError } from './load.ts';
import type { CharacterDoc, Choice } from './pack-types.ts';
import { type ChoicePath, type ChoiceRecord, type Links, type RulesIssue, Sheet } from './sheet.ts';
import { samePath, treeFor } from './tree.ts';
import * as f from '../formula/index.ts';
import type { Ruleset } from './ruleset.ts';
import { withHomebrew } from './homebrew.ts';

export interface OptionResult {
  option: string | number;
  eligible: boolean;
  picked: boolean;
  recommended: boolean;
  reasons: RulesIssue[];
}

export type ListOptionsResult =
  | { options: OptionResult[]; min: number; max?: number }
  | { errors: EngineError[] };

export function pickBounds(sheet: Sheet, record: ChoiceRecord): { min: number; max?: number } {
  const { choice, owner } = record;
  const pack = (choice as Choice & { pack?: string }).pack ?? owner.pack;
  const count = (formula: f.Node | string | number | boolean) => {
    try {
      const v = sheet.evaluate(formula as string, pack, record.roots);
      return v.kind === 'int' || v.kind === 'decimal' ? v.value : 0;
    } catch {
      return 0;
    }
  };
  if (typeof choice.pick === 'object') {
    const min = choice.pick.min === undefined ? 0 : count(choice.pick.min);
    return choice.pick.max === undefined ? { min } : { min, max: count(choice.pick.max) };
  }
  if (choice.pick === undefined) return { min: 1, max: 1 };
  const n = count(choice.pick);
  return { min: n, max: n };
}

/** listOptions: the options a choice offers, with what each would need. */
export function listOptions(
  ruleset: Ruleset,
  character: CharacterDoc,
  path: ChoicePath,
  links: Links = {},
): ListOptionsResult {
  const layered = withHomebrew(ruleset, character);
  if (!layered.ok) return { errors: layered.errors };
  ruleset = layered.ruleset;
  return optionsOn(ruleset, new Sheet(ruleset, character, [], links), path, links);
}

/**
 * listOptions on a sheet already computed for the character (`sheet.character`). With `open`,
 * only what offering the options needs: an option picked or already not eligible keeps
 * the reasons found so far, without the trial sheet for its prerequisites.
 */
export function optionsOn(
  ruleset: Ruleset,
  sheet: Sheet,
  path: ChoicePath,
  links: Links = {},
  open = false,
): ListOptionsResult {
  const { character } = sheet;
  const record = sheet.choices.find((r) => samePath(r.path, path));
  if (!record) return { errors: [{ code: 'unknown-choice', data: { path } }] };
  const { choice, owner } = record;
  const pack = (choice as Choice & { pack?: string }).pack ?? owner.pack;
  const from = choice.from;

  let candidates: { option: string | number; inQuery: boolean; sourceId?: string }[];
  if ('items' in from) candidates = from.items.map((id) => ({ option: id, inQuery: true }));
  else if ('values' in from)
    candidates = sheet
      .valueOptions(record)
      .map((v) => ({ option: v, inQuery: sheet.valueEligible(record, v) }));
  else if ('options' in from) {
    candidates = from.options.map((o) => ({
      option: o.id,
      inQuery: true,
      sourceId: `${owner.sourceId}/${choice.id}/${o.id}`,
    }));
  } else {
    const matches = new Set(
      safe(() => sheet.queryMatches(from.type, from.where, pack, sheet.ownRoots(record)), []),
    );
    const contentOnly =
      ruleset.queries[JSON.stringify([pack, from.type, from.where ?? null])] !== undefined;
    candidates = Object.values(ruleset.content)
      .filter(
        (item) =>
          !item.hidden && item.type === from.type && (!contentOnly || matches.has(item.qid)),
      )
      .map((item) => ({ option: item.qid, inQuery: matches.has(item.qid) }));
  }

  let recommended: unknown;
  if (choice.recommend !== undefined) {
    recommended = safe(
      () => f.toData(sheet.evaluate(choice.recommend as string, pack, sheet.ownRoots(record))),
      undefined,
    );
  }

  const options = candidates.map(({ option, inQuery, sourceId }): OptionResult => {
    const picked = record.picks.some((p) => p.option === option);
    const reasons: RulesIssue[] = [];
    const group = sheet.uniqueKey(record);
    // Repeatable content is exempt from exclusivity groups.
    if (group && !sheet.repeatable(option)) {
      const elsewhere = sheet.choices.find(
        (r) =>
          r !== record &&
          r.applicable &&
          sheet.uniqueKey(r) === group &&
          r.picks.some((p) => p.option === option),
      );
      if (elsewhere) {
        reasons.push({
          code: 'already-picked',
          id: `${owner.sourceId}/${choice.id}`,
          source: owner.source,
          data: { option, path: elsewhere.path },
        });
      }
    }
    if (!inQuery || (sourceId === undefined && !sheet.optionEligible(record, option)))
      reasons.push({
        code: 'option-not-eligible',
        id: `${owner.sourceId}/${choice.id}`,
        source: owner.source,
        data: { option },
      });
    // Evaluated as if the option were picked; a pick that isn't activated has none. Only an option
    // that declares prerequisites (itself or an inline option of its choices) can have any, so the
    // trial sheet is built for those alone.
    const declares =
      sourceId === undefined
        ? hasPrerequisites(ruleset.content[String(option)])
        : hasPrerequisites(
            'options' in from ? from.options.find((o) => o.id === option) : undefined,
          );
    // A choice that waives its picks' prerequisites has none to report.
    if (
      !('values' in from) &&
      choice.activate !== false &&
      choice.waivePrerequisites !== true &&
      declares &&
      !(open && (picked || reasons.length > 0))
    ) {
      const trial = structuredClone(character);
      const holder = treeFor(trial, path, true);
      if (holder) {
        const key = String(path.choice.at(-1));
        holder[key] = holder[key] ?? [];
        if (!holder[key].some((p) => p.option === option)) holder[key].push({ option });
      }
      const after = new Sheet(ruleset, trial, [], links);
      reasons.push(...after.prerequisiteIssues(sourceId ?? String(option)));
    }
    return {
      option,
      eligible: reasons.length === 0,
      picked,
      recommended: recommended === option,
      reasons,
    };
  });
  return { options, ...pickBounds(sheet, record) };
}

const listings = new WeakMap<Sheet, Map<string, ListOptionsResult>>();

/**
 * The options an action's pick over pending choices can offer, cached on the sheet by choice path
 * so an action's replays build each listing once. The result is shared: callers must not change it.
 */
export function openOptionsOn(
  ruleset: Ruleset,
  sheet: Sheet,
  path: ChoicePath,
  links: Links = {},
): ListOptionsResult {
  let byPath = listings.get(sheet);
  if (!byPath) listings.set(sheet, (byPath = new Map()));
  const key = JSON.stringify(path);
  let result = byPath.get(key);
  if (!result) byPath.set(key, (result = optionsOn(ruleset, sheet, path, links, true)));
  return result;
}

interface MayRequire {
  prerequisites?: unknown[];
  choices?: Choice[];
}

const declaresPrerequisites = new WeakMap<object, boolean>();

/**
 * Whether content or an inline option declares a prerequisite, itself or in an inline option of
 * its choices (at any depth): the only activations whose prerequisite issues listOptions reports
 * for it. Content it grants or picks is reported under its own ID.
 */
function hasPrerequisites(owner: MayRequire | undefined): boolean {
  if (!owner) return false;
  let has = declaresPrerequisites.get(owner);
  if (has === undefined) {
    has =
      (owner.prerequisites?.length ?? 0) > 0 ||
      (owner.choices ?? []).some(
        (c) =>
          // A choice that must have an option to pick is a prerequisite too.
          c.requiresOption === true ||
          ('options' in c.from && c.from.options.some((o) => hasPrerequisites(o))),
      );
    declaresPrerequisites.set(owner, has);
  }
  return has;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

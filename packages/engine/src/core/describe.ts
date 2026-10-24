import type { DescribeActionOutput, DescribedParam, DescribedRole } from '@opencharacter/spec';
import {
  type ActionRef,
  contentParamTakes,
  fieldParamTakes,
  findAction,
  ownerRoots,
  situationalRoot,
} from './actions.ts';
import { withHomebrew } from './homebrew.ts';
import type { CharacterDoc, Formula, ValueDecl } from './pack-types.ts';
import { resolveContent, resolveField, type Ruleset } from './ruleset.ts';
import { Failure, type Links, Sheet } from './sheet.ts';
import { outputData } from './views.ts';

export type { DescribedParam, DescribedRole };
export type DescribeActionResult = DescribeActionOutput;
export type ActionDescription = Extract<DescribeActionOutput, { action: unknown }>['action'];

/**
 * describeAction: an action computeSheet lists (`listed: false` ones too), with its parameters
 * as startAction reads them and its roles.
 */
export function describeAction(
  ruleset: Ruleset,
  character: CharacterDoc,
  action: Omit<ActionRef, 'followUp'>,
  links: Links = {},
): DescribeActionResult {
  const layered = withHomebrew(ruleset, character);
  if (!layered.ok) return { errors: layered.errors };
  ruleset = layered.ruleset;
  const { id, entry, source } = action;
  const sheet = new Sheet(ruleset, character, [], links);
  const listed = sheet
    .actions(true)
    .some((a) => a.action === id && a.entry === entry && a.source === source);
  const found = listed ? findAction(sheet, ruleset, id, entry, source) : undefined;
  if (!found)
    return {
      errors: [
        {
          code: 'unknown-action',
          data: { action: id, ...(entry ? { entry } : {}), ...(source ? { source } : {}) },
        },
      ],
    };
  const { def, definedBy, pack, activation, fixed } = found;
  const roots: Record<string, unknown> = {
    ...ownerRoots(activation ? sheet.actionRoots(activation) : sheet.rulesRoots()),
    situational: situationalRoot(ruleset, pack, {}),
  };
  const number = (formula: Formula | undefined) => {
    if (formula === undefined) return undefined;
    const v = attempt(() => sheet.evaluate(formula, pack, roots));
    return v && (v.kind === 'int' || v.kind === 'decimal') ? v.value : undefined;
  };

  const params = Object.entries(def.params ?? {}).map(([name, decl]): DescribedParam => {
    const out: DescribedParam = {
      name,
      type: decl.type as DescribedParam['type'],
      required: !decl.optional && decl.default === undefined && fixed[name] === undefined,
    };
    if (decl.of !== undefined) out.of = decl.of;
    if (decl.default !== undefined) out.default = decl.default;
    if (fixed[name] !== undefined) {
      out.fixed = true;
      const v = attempt(() => sheet.evaluate(fixed[name] as Formula, pack, roots));
      if (v) out.value = qualified(ruleset, decl, pack, outputData(v));
    }
    const min = number(decl.min);
    const max = number(decl.max);
    if (min !== undefined) out.min = min;
    if (max !== undefined) out.max = max;
    if (decl.values) out.values = [...decl.values];
    const options = paramOptions(ruleset, sheet, decl, pack, roots);
    if (options) out.options = options;
    if (decl.unique) out.unique = true;
    if (decl.label !== undefined) out.label = decl.label;
    return out;
  });

  const participants = Object.entries(def.participants ?? {}).map(
    ([role, decl]): DescribedRole => ({
      role,
      min: decl.min ?? 0,
      ...(decl.max !== undefined ? { max: decl.max } : {}),
      ...(decl.pack !== undefined ? { pack: decl.pack } : {}),
    }),
  );

  return {
    action: {
      action: id,
      ...(entry !== undefined ? { entry } : {}),
      ...(source !== undefined ? { source } : {}),
      definedBy,
      tags: [...(def.tags ?? [])],
      ...(def.results !== undefined ? { results: def.results } : {}),
      params,
      participants,
    },
  };
}

/** The IDs a reference parameter takes, in ruleset order; tags sorted. */
function paramOptions(
  ruleset: Ruleset,
  sheet: Sheet,
  decl: ValueDecl,
  pack: string,
  roots: Record<string, unknown>,
): string[] | undefined {
  if (!['id', 'set', 'list'].includes(decl.type) || !decl.of || decl.of === 'string')
    return undefined;
  if (decl.of === 'field')
    return Object.keys(ruleset.fields).filter((qid) =>
      attempt(() => fieldParamTakes(sheet, ruleset, decl, pack, qid)),
    );
  if (decl.of === 'tag') {
    if (decl.tagOptions) return [...decl.tagOptions];
    const all = new Set<string>();
    for (const tag of ruleset.tags) {
      const parts = tag.split('.');
      for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join('.'));
    }
    return [...all].toSorted();
  }
  return Object.values(ruleset.content)
    .filter(
      (item) =>
        !item.hidden &&
        item.type === decl.of &&
        attempt(() => contentParamTakes(sheet, ruleset, decl, pack, item, roots)),
    )
    .map((item) => item.qid);
}

/** A fixed field or content ID as startAction reads it: qualified. */
function qualified(ruleset: Ruleset, decl: ValueDecl, pack: string, value: unknown): unknown {
  if (decl.type !== 'id' || typeof value !== 'string' || !decl.of || decl.of === 'string')
    return value;
  if (decl.of === 'field') return resolveField(ruleset, value, pack) ?? value;
  if (decl.of === 'tag') return value;
  return resolveContent(ruleset, value, pack) ?? value;
}

function attempt<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (error) {
    if (error instanceof Failure) return undefined;
    throw error;
  }
}

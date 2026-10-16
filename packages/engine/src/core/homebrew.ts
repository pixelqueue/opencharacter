import type { EngineError } from '@opencharacter/spec';
import { LIMITS } from '../formula/limits.ts';
import { loadPacks } from './load.ts';
import type { CharacterDoc, ChoiceTree, ContentItem, RulesDoc } from './pack-types.ts';
import type { PackRelease } from './release.ts';
import type { Ruleset } from './ruleset.ts';

/** The reserved pack ID a character's homebrew loads as. */
export const HOMEBREW = 'homebrew';

export type HomebrewResult = { ok: true; ruleset: Ruleset } | { ok: false; errors: EngineError[] };

const layered = new WeakMap<Ruleset, Ruleset>();
/** The formulas each layered ruleset's homebrew writes as text (upgrade steps rewrite them). */
const formulaTexts = new WeakMap<Ruleset, ReadonlySet<string>>();
/** Layered rulesets by base ruleset, then by homebrew and pins (engines MAY cache them). */
const cache = new WeakMap<Ruleset, Map<string, HomebrewResult>>();

function definitions(rules: RulesDoc): number {
  let count = 0;
  for (const [key, value] of Object.entries(rules)) {
    if (key === 'display') {
      const display = value as NonNullable<RulesDoc['display']>;
      count += (display.groups ?? []).length + Object.keys(display.fields ?? {}).length;
    } else if (Array.isArray(value)) count += value.length;
    else if (typeof value === 'object' && value !== null) count += Object.keys(value).length;
  }
  return count;
}

export function homebrewItems(homebrew: NonNullable<CharacterDoc['homebrew']>): number {
  return (homebrew.content ?? []).length + definitions((homebrew.rules ?? {}) as RulesDoc);
}

/**
 * The ruleset with the character's homebrew loaded on top, as a last pack `homebrew` depending
 * on every pinned pack in pin order. Without homebrew, the ruleset itself. Errors are
 * `homebrew-error`, one per load error, with its code as `cause` and a path into the character.
 */
export function withHomebrew(ruleset: Ruleset, character: CharacterDoc): HomebrewResult {
  const homebrew = character.homebrew;
  if (!homebrew || layered.has(ruleset)) return { ok: true, ruleset };
  const rules = (homebrew.rules ?? {}) as RulesDoc;
  const content = (homebrew.content ?? []) as ContentItem[];
  const pins = character.packs.flatMap((pin) => {
    const pack = ruleset.packs.find((p) => p.id === pin.id);
    return pack ? [[pack.id, pack.version] as const] : [];
  });
  const key = JSON.stringify([pins, homebrew]);
  let byKey = cache.get(ruleset);
  const hit = byKey?.get(key);
  if (hit) return hit;
  const result = layer(ruleset, character, rules, content, Object.fromEntries(pins));
  if (!byKey) cache.set(ruleset, (byKey = new Map()));
  byKey.set(key, result);
  return result;
}

function fail(cause: string, path: string, detail: Record<string, unknown> = {}): EngineError {
  return { code: 'homebrew-error', path, data: { cause, detail } };
}

function layer(
  ruleset: Ruleset,
  character: CharacterDoc,
  rules: RulesDoc,
  content: ContentItem[],
  dependencies: Record<string, string>,
): HomebrewResult {
  const sources = ruleset.sources;

  const errors: EngineError[] = [];
  content.forEach((item, i) => {
    if (item.override !== undefined)
      errors.push(fail('homebrew-not-allowed', `/homebrew/content/${i}`, { property: 'override' }));
  });
  if (rules.settings !== undefined)
    errors.push(fail('homebrew-not-allowed', '/homebrew/rules/settings', { property: 'settings' }));
  if (content.length + definitions(rules) > LIMITS.maxHomebrewItems)
    errors.push(fail('safety-limit-exceeded', '/homebrew', { limit: 'maxHomebrewItems' }));
  if (errors.length > 0) return { ok: false, errors };

  const release: PackRelease = {
    manifest: {
      id: HOMEBREW,
      version: '0.0.0',
      specVersion: character.specVersion,
      license: 'none',
      defaultLanguage: character.homebrew?.defaultLanguage ?? 'en',
      dependencies,
    },
    rules,
    content,
  };
  const packs = [...sources, release];
  let formulas = 0;
  const texts = new Set<string>();
  const loaded = loadPacks(packs, {
    checkFormulasOf: new Set([HOMEBREW]),
    onFormula: (_pack, text) => {
      formulas++;
      texts.add(text);
    },
  });
  if (!loaded.ok) {
    const at = `/packs/${sources.length}`;
    return {
      ok: false,
      errors: loaded.errors.map((e) => {
        const path =
          e.path === at || e.path?.startsWith(`${at}/`)
            ? `/homebrew${e.path.slice(at.length)}`
            : '/homebrew';
        return fail(e.code, path, e.data ?? {});
      }),
    };
  }
  if (formulas > LIMITS.maxHomebrewFormulas)
    return {
      ok: false,
      errors: [fail('safety-limit-exceeded', '/homebrew', { limit: 'maxHomebrewFormulas' })],
    };
  layered.set(loaded.ruleset, ruleset);
  formulaTexts.set(loaded.ruleset, texts);
  return { ok: true, ruleset: loaded.ruleset };
}

export function withoutHomebrew(ruleset: Ruleset): Ruleset {
  return layered.get(ruleset) ?? ruleset;
}

/** The formulas a layered ruleset's homebrew writes as text (empty without homebrew). */
export function homebrewFormulas(ruleset: Ruleset): ReadonlySet<string> {
  return formulaTexts.get(ruleset) ?? new Set();
}

/**
 * Every `homebrew:` ID the rest of a character file names: entries' items and
 * templates, applied entries' sources, picked options at any depth, the owner part of prefixed
 * choice keys, members of saved sets, and saved values' keys.
 */
export function homebrewIdsInUse(character: CharacterDoc): Set<string> {
  const ids = new Set<string>();
  const prefix = `${HOMEBREW}:`;
  const note = (v: unknown) => {
    if (typeof v === 'string' && v.startsWith(prefix)) ids.add(v);
  };
  const walk = (tree: ChoiceTree | undefined) => {
    for (const [key, picks] of Object.entries(tree ?? {})) {
      if (key.includes('/')) note(key.slice(0, key.lastIndexOf('/')));
      for (const pick of picks) {
        note(pick.option);
        walk(pick.choices);
      }
    }
  };
  walk(character.choices);
  for (const entry of [...(character.features ?? []), ...(character.inventory ?? [])]) {
    note(entry.item);
    for (const t of entry.templates ?? []) note(t);
    walk(entry.choices);
  }
  for (const applied of character.applied ?? []) note(applied.source);
  for (const [key, value] of Object.entries(character.values ?? {})) {
    note(key);
    if (Array.isArray(value)) for (const v of value) note(v);
  }
  return ids;
}

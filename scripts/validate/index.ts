import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { CharacterChecker, PackChecker } from './checks.ts';
import {
  loadCharacter,
  fileVersion,
  loadPack,
  SchemaValidator,
  visibleFamilies,
  walkYaml,
  YamlCache,
  type LoadedPack,
} from './load.ts';
import { HOMEBREW, homebrewItems } from '../../packages/engine/src/core/homebrew.ts';
import { LIMITS } from '../../packages/engine/src/formula/limits.ts';
import { Reporter } from './report.ts';
import type { CharacterDoc, ContentItem, RulesDoc } from './types.ts';
import { Ruleset } from './ruleset.ts';
import { pendingVersions } from '../release/pending.ts';

const folders = (dir: string) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .toSorted((a, b) => a.localeCompare(b));

export interface ValidateOptions {
  /** Folder holding one sub-folder per pack. Default `<root>/packs`. */
  packs?: string;
  /** Folder holding character files. Default `<root>/examples/characters`. */
  characters?: string;
  /** Called with each pack's formulas as the validator reaches them (used by the pack build). */
  onFormula?: (packId: string, text: string) => void;
  /**
   * The version pending changesets give each pack (pack ID → version), so an upgrade script may go
   * to it. Default: read from `<root>/.changeset`.
   */
  pending?: ReadonlyMap<string, string>;
}

export interface ValidateResult {
  reporter: Reporter;
  packs: string[];
  loaded: LoadedPack[];
  /** Translation keys each pack's default language must have. */
  requiredKeys: Map<string, Set<string>>;
  characters: string[];
}

/**
 * A character's homebrew as a pack: the pack checks run on it, with the pinned
 * packs as its dependencies, then the character is checked with it loaded.
 */
function checkHomebrew(
  packs: LoadedPack[],
  character: CharacterDoc,
  file: string,
  reporter: Reporter,
): void {
  const homebrew = character.homebrew as NonNullable<CharacterDoc['homebrew']>;
  const at = `${file}#/homebrew`;
  const pack: LoadedPack = {
    dir: at,
    manifest: {
      id: HOMEBREW,
      version: '0.0.0',
      specVersion: character.specVersion,
      license: 'none',
      defaultLanguage: homebrew.defaultLanguage ?? 'en',
      dependencies: Object.fromEntries(character.packs.map((p) => [p.id, p.version])),
    },
    rules: homebrew.rules ? [{ file: `${at}/rules`, doc: homebrew.rules as RulesDoc }] : [],
    content: (homebrew.content ?? []).map((doc, i) => ({
      file: `${at}/content/${i}`,
      doc: doc as ContentItem,
    })),
    i18n: new Map(
      Object.entries(homebrew.i18n ?? {}).map(([language, doc]) => [
        language,
        [{ file: `${at}/i18n/${language}`, doc }],
      ]),
    ),
    upgrades: [],
  };
  // The packs' own problems were reported already; keep only the homebrew's.
  const scratch = new Reporter();
  const ruleset = new Ruleset([...packs, pack], scratch);
  for (const finding of scratch.errors)
    if (finding.file.startsWith(at)) reporter.error(finding.file, finding.message);
  let formulas = 0;
  new PackChecker(ruleset, reporter, HOMEBREW, () => formulas++, true).run();
  if (homebrewItems(homebrew) > LIMITS.maxHomebrewItems)
    reporter.error(
      at,
      `safety-limit-exceeded: more than maxHomebrewItems (${LIMITS.maxHomebrewItems})`,
    );
  if (formulas > LIMITS.maxHomebrewFormulas)
    reporter.error(
      at,
      `safety-limit-exceeded: more than maxHomebrewFormulas (${LIMITS.maxHomebrewFormulas})`,
    );
  new CharacterChecker(ruleset, reporter).run(character, file);
}

/** Compiled once: the schemas don't change while a process runs. */
let schemaValidator: SchemaValidator | undefined;

/** What one validated set of folders keeps for the next run. */
interface Memo {
  cache: YamlCache;
  /** The input files' versions at the last run, and that run's result. */
  last?: { fingerprint: string; result: ValidateResult };
}

const memos = new Map<string, Memo>();

/**
 * The version of every file a run can read (YAML files and `package.json`) under `dirs`: equal
 * fingerprints mean equal results.
 */
function fingerprint(dirs: string[]): string {
  const parts: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }).toSorted((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(path);
      } else if (entry.name.endsWith('.yaml') || entry.name === 'package.json') {
        parts.push(`${path}\0${fileVersion(path)}`);
      }
    }
  };
  for (const dir of dirs) {
    parts.push(`${dir}\0`);
    walk(dir);
  }
  return parts.join('\n');
}

/** A copy of a result, so a caller changing its copy can't change the next one. */
function copy(result: ValidateResult): ValidateResult {
  const reporter = new Reporter();
  for (const f of result.reporter.errors) reporter.error(f.file, f.message);
  for (const f of result.reporter.warnings) reporter.warn(f.file, f.message);
  return {
    reporter,
    packs: [...result.packs],
    loaded: result.loaded.map((p) => ({
      ...p,
      rules: [...p.rules],
      content: [...p.content],
      i18n: new Map([...p.i18n].map(([language, files]) => [language, [...files]])),
      upgrades: [...p.upgrades],
    })),
    requiredKeys: new Map([...result.requiredKeys].map(([id, keys]) => [id, new Set(keys)])),
    characters: [...result.characters],
  };
}

/**
 * Validates every pack (manifest, rules, content, i18n, upgrades) and character file under
 * `root` against the spec schemas, then checks that every referenced ID exists.
 *
 * Runs are cheap to repeat: parsed files are kept between runs and parsed again only
 * when they change on disk, and a run whose files are all unchanged returns a copy of the last
 * result. A run with `onFormula` always checks everything, so the callback sees every formula.
 */
export function validateRepo(root: string, options: ValidateOptions = {}): ValidateResult {
  const absRoot = resolve(root);
  const packsDir = options.packs ?? join(absRoot, 'packs');
  const charactersDir = options.characters ?? join(absRoot, 'examples', 'characters');
  const pending = options.pending ?? pendingVersions(absRoot);
  options = { ...options, pending };
  const key = [absRoot, packsDir, charactersDir, JSON.stringify([...pending])].join('\0');
  let memo = memos.get(key);
  if (!memo) memos.set(key, (memo = { cache: new YamlCache() }));
  if (options.onFormula) return run(absRoot, packsDir, charactersDir, options, memo.cache);
  const print = fingerprint([packsDir, charactersDir]);
  if (memo.last?.fingerprint === print) return copy(memo.last.result);
  const result = run(absRoot, packsDir, charactersDir, options, memo.cache);
  memo.last = { fingerprint: print, result: copy(result) };
  return result;
}

function run(
  absRoot: string,
  packsDir: string,
  charactersDir: string,
  options: ValidateOptions,
  cache: YamlCache,
): ValidateResult {
  const reporter = new Reporter();
  const schemas = (schemaValidator ??= new SchemaValidator());

  const packs: LoadedPack[] = [];
  // Families each pack sees, with the other packs' additions.
  const packDirs = existsSync(packsDir)
    ? folders(packsDir).flatMap((game) =>
        folders(join(packsDir, game))
          .map((name) => join(packsDir, game, name))
          .filter((dir) => existsSync(join(dir, 'pack.yaml'))),
      )
    : [];
  const families = visibleFamilies(packDirs, cache);
  if (existsSync(packsDir)) {
    for (const game of folders(packsDir)) {
      const gameDir = join(packsDir, game);
      if (existsSync(join(gameDir, 'pack.yaml'))) {
        reporter.error(
          relative(absRoot, join(gameDir, 'pack.yaml')),
          'packs live at packs/<game>/<pack>/, not directly in a game folder',
        );
        continue;
      }
      for (const name of folders(gameDir)) {
        const dir = join(gameDir, name);
        if (!existsSync(join(dir, 'pack.yaml'))) continue;
        const pack = loadPack(dir, absRoot, schemas, reporter, cache, families);
        if (pack) packs.push(pack);
      }
    }
  }

  const ruleset = new Ruleset(packs, reporter);
  const requiredKeys = new Map<string, Set<string>>();
  for (const pack of packs) {
    const id = pack.manifest.id;
    const checker = new PackChecker(
      ruleset,
      reporter,
      id,
      options.onFormula && ((text) => options.onFormula?.(id, text)),
      false,
      options.pending?.get(id),
    );
    checker.run();
    requiredKeys.set(id, checker.requiredKeys);
  }

  const characters: string[] = [];
  const characterChecker = new CharacterChecker(ruleset, reporter);
  for (const file of walkYaml(charactersDir)) {
    const character = loadCharacter(file, absRoot, schemas, reporter, cache);
    if (character?.doc.homebrew) checkHomebrew(packs, character.doc, character.file, reporter);
    else if (character) characterChecker.run(character.doc, character.file);
    characters.push(file);
  }
  cache.prune();

  return {
    reporter,
    packs: packs.map((p) => p.manifest.id),
    loaded: packs,
    requiredKeys,
    characters,
  };
}

/**
 * The runner for the shared conformance suite (packages/spec/tests/cases), split over several
 * test files in this folder so vitest runs them in parallel. `partition` puts every case
 * in exactly one part; `<part>.test.ts` runs that part, and `partition.test.ts` checks that the
 * files together run every case once.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { paths } from '@opencharacter/spec/node';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  type ActionAnswer,
  applyChanges,
  computeSheet,
  continueAction,
  diceFrom,
  listOptions,
  checkRelease,
  loadRuleset,
  type PackRelease,
  type Ruleset,
  startAction,
  upgrade,
} from '../../src/index.ts';
import { readPack } from '../packs.ts';

export const casesDir = join(paths.tests, 'cases');
const rulesets = new Map<string, Ruleset>();

type PackRef = { path: string } | { inline: PackRelease };

/** A pack release from a case: a pack source folder (built) or an inline release. */
function release(dir: string, ref: PackRef): PackRelease {
  return 'inline' in ref ? (ref.inline as PackRelease) : readPack(resolve(dir, ref.path));
}

function ruleset(dir: string, packs: PackRef[]): Ruleset {
  const key = JSON.stringify(packs.map((p) => ('inline' in p ? p.inline : resolve(dir, p.path))));
  let r = rulesets.get(key);
  if (!r) {
    const loaded = loadRuleset(packs.map((p) => release(dir, p)));
    if (!loaded.ok) throw new Error(`loadRuleset failed: ${JSON.stringify(loaded.errors)}`);
    r = loaded.ruleset;
    rulesets.set(key, r);
  }
  return r;
}

const yaml = (dir: string, name: string) => {
  const file = join(dir, name);
  return existsSync(file) ? parse(readFileSync(file, 'utf8')) : undefined;
};

const issueKeys = (issues: { code: string; id?: string }[]) =>
  issues.map((i) => (i.id === undefined ? { code: i.code } : { code: i.code, id: i.id }));

/** Keys each call's `case.yaml` and `expected.yaml` may use. Anything else is a mistake in the case. */
const caseKeys: Record<string, string[]> = {
  computeSheet: ['packs', 'input'],
  listOptions: ['packs', 'input'],
  applyChanges: ['packs', 'input'],
  startAction: ['packs', 'input', 'answers'],
  upgrade: ['from', 'to'],
  checkRelease: ['previous', 'next', 'dependencies'],
  loadRuleset: ['packs'],
};
const expectedKeys: Record<string, string[]> = {
  computeSheet: [
    'values',
    'effects',
    'pending',
    'issues',
    'actions',
    'situational',
    'errors',
    'competing',
    'valueErrors',
    'copies',
    'copyNames',
    'standardCopies',
    'copyLimits',
    'pendingSlots',
    'activations',
    'choices',
    'offers',
  ],
  listOptions: ['options', 'min', 'max', 'errors'],
  applyChanges: ['ok', 'errors', 'issues', 'adjustments', 'followUps', 'character', 'changes'],
  startAction: ['status', 'outcome', 'proposedChanges', 'needs', 'log', 'errors', 'errorData'],
  upgrade: ['ok', 'errors', 'character', 'pending', 'report'],
  checkRelease: ['ok', 'changes', 'errors'],
  loadRuleset: ['errors', 'conflicts', 'creation', 'packs'],
};

function licenseParts(packs: readonly object[]): unknown[] {
  return (packs as Record<string, unknown>[]).map((p) => ({
    id: p.id,
    version: p.version,
    license: p.license,
    ...(p.credit === undefined ? {} : { credit: p.credit }),
    ...(p.notices === undefined ? {} : { notices: Object.entries(p.notices as object) }),
  }));
}

function checkKeys(what: string, data: object, allowed: string[]): void {
  const unknown = Object.keys(data).filter((k) => !allowed.includes(k));
  expect(unknown, `unknown keys in ${what}`).toEqual([]);
}

function run(dir: string): void {
  const spec = yaml(dir, 'case.yaml');
  const expected = yaml(dir, 'expected.yaml') ?? {};
  const character = yaml(dir, 'character.yaml');
  const input = spec.input ?? {};
  const allowed = caseKeys[spec.call];
  if (!allowed) throw new Error(`unknown call ${spec.call}`);
  checkKeys('case.yaml', spec, ['description', 'specVersion', 'call', ...allowed]);
  checkKeys('expected.yaml', expected, expectedKeys[spec.call] ?? []);
  if (spec.call === 'upgrade') {
    const result = upgrade(ruleset(dir, spec.from), ruleset(dir, spec.to), character);
    if (!result.ok) {
      expect(result.errors.map((e) => e.code)).toEqual(expected.errors);
      return;
    }
    expect(expected.errors).toBeUndefined();
    if (expected.ok !== undefined) expect(result.ok).toBe(expected.ok);
    for (const [key, value] of Object.entries(
      (expected.character ?? {}) as Record<string, unknown>,
    )) {
      expect((result.character as unknown as Record<string, unknown>)[key], key).toEqual(value);
    }
    if (expected.pending)
      expect((result.pending as { path: unknown }[]).map((p) => p.path)).toEqual(expected.pending);
    const report = (expected.report ?? {}) as Record<string, unknown>;
    if (report.values) expect(result.report.values).toEqual(report.values);
    if (report.steps) {
      expect(
        result.report.steps.map((s) => ({ pack: s.pack, from: s.from, to: s.to, op: s.step.op })),
      ).toEqual(report.steps);
    }
    if (report.errors) expect(result.report.errors.map((e) => e.code)).toEqual(report.errors);
    if (report.homebrew) {
      expect(result.report.homebrew.map((h) => ({ path: h.path, op: h.step.op }))).toEqual(
        report.homebrew,
      );
    }
    return;
  }
  if (spec.call === 'checkRelease') {
    const deps = (spec.dependencies ?? {}) as { previous?: PackRef[]; next?: PackRef[] };
    const result = checkRelease(release(dir, spec.previous), release(dir, spec.next), {
      previous: (deps.previous ?? []).map((p) => release(dir, p)),
      next: (deps.next ?? []).map((p) => release(dir, p)),
    });
    if (expected.ok !== undefined) expect(result.ok).toBe(expected.ok);
    if (expected.changes)
      expect(result.changes.map((c) => ({ kind: c.kind, id: c.id }))).toEqual(expected.changes);
    if (expected.errors) expect(result.errors.map((e) => e.code)).toEqual(expected.errors);
    return;
  }
  if (spec.call === 'loadRuleset') {
    const result = loadRuleset((spec.packs as PackRef[]).map((p) => release(dir, p)));
    if (result.ok) {
      expect(expected.errors).toBeUndefined();
      if (expected.conflicts) expect(result.ruleset.conflicts).toEqual(expected.conflicts);
      if (expected.creation) expect(result.ruleset.creation).toEqual(expected.creation);
      if (expected.packs) {
        expect(licenseParts(result.ruleset.packs)).toEqual(licenseParts(expected.packs as []));
      }
      return;
    }
    expect(
      result.errors.map((e) => ({
        code: e.code,
        ...(e.data?.cause === undefined ? {} : { cause: e.data.cause }),
        ...(e.path === undefined ? {} : { path: e.path }),
      })),
    ).toEqual(expected.errors);
    return;
  }
  const r = ruleset(dir, spec.packs);

  if (spec.call === 'computeSheet') {
    const sheet = computeSheet(r, character, input.competing ?? [], input.links ?? {});
    type Value = {
      value?: unknown;
      base?: unknown;
      breakdown?: unknown;
      tags?: unknown;
      name?: unknown;
      error?: { code: string };
    };
    for (const [field, want] of Object.entries((expected.values ?? {}) as Record<string, Value>)) {
      checkKeys(`values.${field}`, want, ['value', 'base', 'breakdown', 'tags', 'name', 'error']);
      const got = sheet.values[field] as Value | undefined;
      expect(got, field).toBeDefined();
      if (want.error) expect(got?.error?.code, field).toBe(want.error.code);
      else expect(got?.value, field).toEqual(want.value);
      if ('base' in want) expect(got?.base, `${field} base`).toEqual(want.base);
      if ('breakdown' in want) expect(got?.breakdown, `${field} breakdown`).toEqual(want.breakdown);
      if ('tags' in want) expect(got?.tags ?? [], `${field} tags`).toEqual(want.tags);
      if ('name' in want) expect(got?.name ?? null, `${field} name`).toEqual(want.name);
    }
    if (expected.effects) expect(sheet.effects).toEqual(expected.effects);
    if (expected.pending) expect(sheet.pending.map((p) => p.path)).toEqual(expected.pending);
    if (expected.pendingSlots)
      expect(sheet.pending.map((p) => p.slot ?? null)).toEqual(expected.pendingSlots);
    if (expected.issues) expect(issueKeys(sheet.issues)).toEqual(issueKeys(expected.issues));
    if (expected.actions) expect(sheet.actions).toEqual(expected.actions);
    if (expected.situational) expect(sheet.situational).toEqual(expected.situational);
    if (expected.copies) expect(sheet.copies).toEqual(expected.copies);
    if (expected.copyNames) expect(sheet.copyNames).toEqual(expected.copyNames);
    if (expected.standardCopies) expect(sheet.standardCopies).toEqual(expected.standardCopies);
    if (expected.activations) expect(sheet.activations).toEqual(expected.activations);
    if (expected.choices) expect(sheet.choices).toEqual(expected.choices);
    if (expected.copyLimits) expect(sheet.copyLimits).toEqual(expected.copyLimits);
    if (expected.offers) expect(sheet.offers).toEqual(expected.offers);
    if (expected.errors) expect(sheet.errors.map((e) => e.code)).toEqual(expected.errors);
    if (expected.valueErrors)
      expect(
        Object.entries(sheet.values)
          .filter(([, v]) => (v as { error?: unknown }).error !== undefined)
          .map(([field]) => field),
      ).toEqual(expected.valueErrors);
    type Competing = {
      field: string;
      op?: string;
      stackKey?: string;
      options?: unknown[];
      recommended?: string;
      applied?: string;
    };
    const wanted = (expected.competing ?? []) as Competing[];
    for (const field of new Set(wanted.map((w) => w.field))) {
      const want = wanted.filter((w) => w.field === field);
      const got = sheet.competing.filter((c) => c.field === field);
      expect(got.length, `competing entries for ${field}`).toBe(want.length);
      want.forEach((w, i) => {
        checkKeys(`competing ${field}`, w, [
          'field',
          'op',
          'stackKey',
          'options',
          'recommended',
          'applied',
        ]);
        const g = got[i];
        if (w.op) expect(g?.op).toBe(w.op);
        if ('stackKey' in w) expect(g?.stackKey).toBe(w.stackKey);
        // Options are option IDs, or `{ id, value }` to check the values too.
        if (w.options)
          expect(
            g?.options.map((o, j) =>
              typeof w.options?.[j] === 'string' ? o.id : { id: o.id, value: o.value },
            ),
          ).toEqual(w.options);
        if (w.recommended) expect(g?.recommended).toBe(w.recommended);
        if (w.applied) expect(g?.applied).toBe(w.applied);
      });
    }
    return;
  }

  if (spec.call === 'listOptions') {
    const result = listOptions(r, character, input.choice, input.links ?? {});
    if ('errors' in result) {
      expect(result.errors.map((e) => e.code)).toEqual(expected.errors);
      return;
    }
    expect(expected.errors).toBeUndefined();
    if (expected.options) {
      expect(
        result.options.map((o) => ({
          option: o.option,
          eligible: o.eligible,
          picked: o.picked,
          recommended: o.recommended,
          reasons: issueKeys(o.reasons),
        })),
      ).toEqual(
        (expected.options as { reasons?: { code: string; id?: string }[] }[]).map((o) => ({
          ...o,
          reasons: issueKeys(o.reasons ?? []),
        })),
      );
    }
    if (expected.min !== undefined) expect(result.min).toBe(expected.min);
    if (expected.max !== undefined) expect(result.max).toBe(expected.max);
    return;
  }

  if (spec.call === 'applyChanges') {
    const changes = yaml(dir, 'changes.yaml');
    const faces = yaml(dir, 'dice.yaml') as number[] | undefined;
    const dice = faces ? diceFrom(faces) : undefined;
    const result = applyChanges(
      r,
      character,
      changes,
      input.strict ?? false,
      input.links ?? {},
      dice,
    );
    expect(result.ok).toBe(expected.ok);
    if (!result.ok) {
      if (expected.errors) expect(result.errors.map((e) => e.code)).toEqual(expected.errors);
      if (expected.issues)
        expect(issueKeys(result.issues ?? [])).toEqual(issueKeys(expected.issues));
      return;
    }
    if (expected.issues) expect(issueKeys(result.issues)).toEqual(issueKeys(expected.issues));
    if (expected.adjustments) expect(result.adjustments).toEqual(expected.adjustments);
    if (expected.followUps) expect(result.followUps).toEqual(expected.followUps);
    if (expected.changes) expect(result.changes).toEqual(expected.changes);
    for (const [key, value] of Object.entries(
      (expected.character ?? {}) as Record<string, unknown>,
    )) {
      // `null` means the key is absent from the file.
      const actual = (result.character as unknown as Record<string, unknown>)[key];
      if (value === null) expect(actual, key).toBeUndefined();
      else expect(actual, key).toEqual(value);
    }
    return;
  }
  if (spec.call === 'startAction') {
    const faces = (yaml(dir, 'dice.yaml') ?? []) as number[];
    const dice = diceFrom(faces);
    let result = startAction(r, character, input, dice);
    const answers = (spec.answers ?? []) as ActionAnswer[];
    let used = 0;
    for (const answer of answers) {
      if (!('status' in result) || result.status !== 'paused') break;
      result = continueAction(r, result, answer, input.policy, dice);
      used++;
    }
    if (answers.length > 0) {
      const replayed = startAction(r, character, { ...input, answers }, diceFrom(faces));
      if ('ok' in result || used < answers.length) {
        expect('ok' in replayed, 'replay fails too').toBe(true);
        if ('ok' in replayed && 'ok' in result)
          expect(replayed.errors.map((e) => e.code)).toEqual(result.errors.map((e) => e.code));
      } else expect(replayed, 'replay equals the loop').toEqual(result);
    }
    if ('ok' in result) {
      expect(result.errors.map((e: { code: string }) => e.code)).toEqual(expected.errors);
      // Each error's data, on the keys listed (a replay's `index` and `needs`).
      if (expected.errorData)
        expect(result.errors.map((e) => e.data ?? {})).toMatchObject(expected.errorData);
      return;
    }
    expect(expected.errors).toBeUndefined();
    if (expected.status) expect(result.status).toBe(expected.status);
    if (result.status === 'finished') {
      if (expected.outcome) expect(result.outcome).toEqual(expected.outcome);
      if (expected.proposedChanges)
        expect(result.proposedChanges).toEqual(expected.proposedChanges);
    } else if (expected.needs) {
      expect(result.needs).toMatchObject(expected.needs);
    }
    if (expected.log) {
      expect(result.log.length, 'log length').toBe(expected.log.length);
      (expected.log as Record<string, unknown>[]).forEach((want, i) => {
        const got = result.log[i] as unknown as Record<string, unknown>;
        for (const key of [
          'step',
          'action',
          'kind',
          'by',
          'faces',
          'draw',
          'option',
          'index',
          'choice',
          'participant',
          'outcome',
          'amounts',
          'total',
          'band',
          'bandSet',
          'bandValue',
          'summary',
        ]) {
          // `null` in the case means the key is absent (a roll with no dice has no faces).
          if (key in want) expect(got[key] ?? null, `log[${i}].${key}`).toEqual(want[key]);
        }
        if ('bounds' in want) expect(got.bounds ?? [], `log[${i}].bounds`).toEqual(want.bounds);
        if ('tallies' in want) expect(got.tallies ?? [], `log[${i}].tallies`).toEqual(want.tallies);
        if ('items' in want)
          expect(got.items, `log[${i}].items`).toMatchObject(want.items as object);
      });
    }
    return;
  }
  throw new Error(`unknown call ${spec.call}`);
}

/** The case areas this runner covers (`formulas` has its own test, formula-conformance). */
export const areas = ['loads', 'sheets', 'options', 'changes', 'actions', 'upgrades'] as const;
type Area = (typeof areas)[number];

export function caseNames(area: string): string[] {
  const dir = join(casesDir, area);
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((n) => existsSync(join(dir, n, 'case.yaml')))
        .toSorted()
    : [];
}

/**
 * How many files run orc-2e's action cases. Its whole-pack creation and level-up cases take
 * seconds each: most of the suite's time.
 */
const orcActionFiles = 6;
const orc = (n: string) => n.startsWith('orc-');
const slow = (n: string) => n.includes('level-up');

export type Part = { area: Area; cases: string[] }[];

/**
 * Every case, assigned to one part by area and pack prefix. orc-2e's action cases are dealt
 * round-robin over several parts, level-up cases first, so the slow ones spread out. A new case
 * folder lands in a part with no change here.
 */
export function partition(): Map<string, Part> {
  const parts = new Map<string, Part>();
  const add = (part: string, area: Area, name: string) => {
    const list = parts.get(part) ?? [];
    let entry = list.find((e) => e.area === area);
    if (!entry) list.push((entry = { area, cases: [] }));
    entry.cases.push(name);
    parts.set(part, list);
  };
  for (const area of areas) {
    const names = caseNames(area);
    if (area === 'sheets') {
      for (const n of names) add(orc(n) ? 'sheets-orc' : 'sheets-other', area, n);
    } else if (area === 'actions') {
      const pf = names.filter(orc);
      [...pf.filter(slow), ...pf.filter((n) => !slow(n))].forEach((n, i) =>
        add(`actions-orc-${(i % orcActionFiles) + 1}`, area, n),
      );
      for (const n of names) if (!orc(n)) add('actions-other', area, n);
    } else {
      for (const n of names) add(area, area, n);
    }
  }
  return parts;
}

/** Runs one part's cases, named as before the split: `engine conformance: <area>` › `<case>`. */
export function conformance(part: string): void {
  const entries = partition().get(part);
  if (!entries) throw new Error(`no conformance part ${part}`);
  for (const { area, cases } of entries) {
    const dir = join(casesDir, area);
    describe(`engine conformance: ${area}`, () => {
      // A orc-2e level-up or whole-pack creation case takes up to 20 s alone, and about twice
      // that with every core busy running the other parts: far past the 5 s default.
      it.each(cases)('%s', (name) => run(join(dir, name)), 60_000);
    });
  }
}

function packFolders(packsDir: string): Map<string, string> {
  const byId = new Map<string, string>();
  for (const game of readdirSync(packsDir)) {
    const gameDir = join(packsDir, game);
    if (!statSync(gameDir).isDirectory()) continue;
    for (const name of readdirSync(gameDir)) {
      const manifest = join(gameDir, name, 'pack.yaml');
      if (existsSync(manifest))
        byId.set(parse(readFileSync(manifest, 'utf8')).id, join(game, name));
    }
  }
  return byId;
}

export function exampleCharacters(): void {
  describe('example characters', () => {
    it('compute without errors', () => {
      const examples = join(paths.root, '..', '..', 'examples', 'characters');
      const packsDir = join(paths.root, '..', '..', 'packs');
      const packPaths = packFolders(packsDir);
      for (const file of readdirSync(examples)) {
        const character = parse(readFileSync(join(examples, file), 'utf8'));
        const r = ruleset(
          packsDir,
          character.packs.map((p: { id: string }) => ({ path: packPaths.get(p.id) as string })),
        );
        const sheet = computeSheet(r, character);
        expect(sheet.errors, file).toEqual([]);
        const broken = Object.entries(sheet.values).filter(
          ([, v]) => (v as { error?: unknown }).error,
        );
        expect(broken, file).toEqual([]);
      }
    }, 30_000);
  });
}

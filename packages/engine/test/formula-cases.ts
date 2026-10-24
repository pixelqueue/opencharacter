import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from '@opencharacter/spec/node';
import { parse as parseYaml } from 'yaml';
import * as f from '../src/formula/index.ts';

export interface FieldSpec {
  type: string;
  value?: unknown;
  tags?: string[];
}

export interface FormulaCase {
  name: string;
  parse?: string;
  evaluate?: string;
  check?: string;
  roll?: string;
  tree?: unknown;
  print?: string;
  error?: string;
  fields?: Record<string, FieldSpec>;
  roots?: Record<string, unknown> | string[];
  rootTypes?: Record<string, unknown>;
  character?:
    | false
    | {
        copies?: CaseCopy[];
        picks?: CasePick[];
        grants?: CasePick[];
        /** Each content's choices' picks over its activations, for `picksOf(content, choice)`. */
        contentPicks?: Record<string, Record<string, (string | number)[]>>;
        /** Content items by ID, for `itemField` and `itemTags`: `tags` and `fields`. */
        content?: Record<string, { tags?: string[]; fields?: Record<string, unknown> }>;
        choices?: string[];
      };
  /** An activation condition: what activation decides isn't bound. */
  activation?: boolean;
  /** The formula's owner's choices and their picks; giving it binds `picksOf`. */
  picks?: Record<string, (string | number)[]>;
  /** The picks of content the owner grants, by content and choice; binds `grantedPicksOf`. */
  granted?: Record<string, Record<string, (string | number)[]>>;
  value?: unknown;
  valueType?: string;
  expect?: string;
  type?: string;
  faces?: number[];
  total?: number;
  terms?: unknown[];
}

export interface CaseCopy {
  type: string;
  id?: string;
  item?: string;
  tags?: string[];
  equipped?: boolean;
  quantity?: number;
  templates?: string[];
  state?: Record<string, unknown>;
  fields?: Record<string, unknown>;
}

export interface CasePick {
  type: string;
  item?: string;
  tags?: string[];
  state?: Record<string, unknown>;
  fields?: Record<string, unknown>;
}

export interface CaseFile {
  file: string;
  description: string;
  cases: FormulaCase[];
}

export function loadCaseFiles(): CaseFile[] {
  const dir = join(paths.tests, 'cases', 'formulas');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .toSorted()
    .map((name) => {
      const doc = parseYaml(readFileSync(join(dir, name), 'utf8')) as Omit<CaseFile, 'file'>;
      return { file: name, ...doc };
    });
}

function fieldValue(spec: FieldSpec): f.Value | undefined {
  if (spec.value === undefined) return undefined;
  const v = spec.value;
  switch (spec.type) {
    case 'integer':
      return { kind: 'int', value: v as number };
    case 'decimal':
      return { kind: 'decimal', value: v as number };
    case 'dice': {
      const tree = f.parse(String(v));
      if (!tree.ok) throw new Error(`bad dice field value ${String(v)}`);
      const value = f.evaluate(tree.value, { field: () => undefined, roots: {} });
      if (!value.ok) throw new Error(`bad dice field value ${String(v)}`);
      return value.value;
    }
    default:
      return f.fromData(v);
  }
}

function pickViews(picks: CasePick[] | undefined, what: string) {
  return (picks ?? []).map((pick, i) => ({
    item: `test:${pick.type}-${what}-${i + 1}`,
    tags: [],
    state: {},
    fields: {},
    ...pick,
  }));
}

function characterQueries(c: FormulaCase): f.CharacterQueries | undefined {
  if (c.character === false) return undefined;
  const copies = c.character?.copies ?? [];
  const picks = pickViews(c.character?.picks, 'pick');
  const grants = pickViews(c.character?.grants, 'grant');
  // The content types of the character's choices bind `hasChoice`.
  const choices = c.character?.choices;
  const specs = c.fields ?? {};
  const fields = Object.entries(specs).map(([id, spec]) => ({
    id,
    type: spec.type,
    tags: spec.tags ?? [],
  }));
  return {
    ...(choices ? { hasChoice: (type: string) => choices.includes(type) } : {}),
    fields: () => fields,
    fieldValue: (id) => {
      const value = Object.hasOwn(specs, id) ? fieldValue(specs[id] as FieldSpec) : undefined;
      if (value === undefined) throw new Error(`case field ${id} has no value`);
      return value;
    },
    picks: () => picks,
    contentItem: (id: string) => {
      const item = c.character ? c.character.content?.[id] : undefined;
      return item ? { tags: item.tags ?? [], fields: item.fields ?? {} } : undefined;
    },
    ...(c.activation
      ? {}
      : {
          grants: () => grants,
          contentPicks: (content: string, choice: string) =>
            c.character ? (c.character.contentPicks?.[content]?.[choice] ?? []) : [],
        }),
    countEquipped: (type) => copies.filter((copy) => copy.type === type && copy.equipped).length,
    countState: (key) => copies.filter((copy) => copy.state?.[key] === true).length,
    sumState: (type, key) =>
      copies
        .filter((copy) => copy.type === type)
        .reduce((sum, copy) => sum + Number(copy.state?.[key] ?? 0), 0),
    copies: () =>
      copies.map((copy, i) => ({
        id: `copy-${i + 1}`,
        item: `test:${copy.type}-${i + 1}`,
        tags: [],
        equipped: false,
        quantity: 1,
        templates: [],
        state: {},
        fields: {},
        ...copy,
      })),
  };
}

export function evalContext(c: FormulaCase): f.EvalContext {
  const fields = c.fields ?? {};
  const roots = Array.isArray(c.roots)
    ? Object.fromEntries(c.roots.map((r) => [r, {}]))
    : (c.roots ?? {});
  const character = characterQueries(c);
  return {
    field: (id) => (Object.hasOwn(fields, id) ? fieldValue(fields[id] as FieldSpec) : undefined),
    roots: {
      ...roots,
      ...(c.picks ? { [f.OWNER_PICKS]: c.picks } : {}),
      ...(c.granted ? { [f.OWNER_GRANTED]: c.granted } : {}),
    },
    ...(character ? { character } : {}),
  };
}

export function checkContext(c: FormulaCase): f.CheckContext {
  const fields = c.fields ?? {};
  const roots = Array.isArray(c.roots) ? c.roots : Object.keys(c.roots ?? {});
  return {
    field: (id) =>
      Object.hasOwn(fields, id) ? f.fieldFormulaType((fields[id] as FieldSpec).type) : undefined,
    roots: new Set(roots),
    rootTypes: Object.fromEntries(
      Object.entries(c.rootTypes ?? {}).map(([k, v]) => [k, toType(v)]),
    ),
    character: c.character !== false,
    ...(c.character && c.character.choices ? { choices: true } : {}),
    ...(c.activation ? { activation: true } : {}),
    ...(c.picks || c.granted ? { picks: true } : {}),
  };
}

/** A type written in a case: a type name (`int`, `list<string>`) or `{ object, open? }`. */
function toType(written: unknown): f.FType {
  if (typeof written === 'string') return f.parseTypeName(written);
  const { object, open } = written as { object: Record<string, unknown>; open?: boolean };
  const members = Object.fromEntries(Object.entries(object).map(([k, v]) => [k, toType(v)]));
  return open ? { object: members, open: true } : { object: members };
}

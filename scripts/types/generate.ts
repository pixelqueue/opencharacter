import {
  fixedSetIds,
  type JsonSchema,
  loadSchemas,
  SCHEMA_BASE,
} from '../../packages/spec/src/node.ts';

// Generates TypeScript types from the spec's JSON Schemas. The schemas use a small part of
// JSON Schema, and one house pattern that off-the-shelf generators can't read: an `allOf` of
// `if: { properties: { <key>: { const } } }, then: { $ref: <variant> }` that picks a variant by a
// discriminator. That becomes a discriminated union. `if`/`then` pairs that only add requirements
// to a base shape ("an enum field needs `values`") are skipped, so those types are a little looser
// than their schemas. Runtime checks stay the schemas' job.

type Schema = Record<string, unknown> | boolean;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Keywords that make a node a schema rather than a folder of `$defs` (`$defs/nodes`). */
const SCHEMA_KEYWORDS = [
  'type',
  'properties',
  '$ref',
  'oneOf',
  'anyOf',
  'allOf',
  'enum',
  'const',
  'items',
  'additionalProperties',
];

/** Type names that differ from the defaults (see `defaultName`). */
const NAMES: Record<string, string> = {
  'change.schema.json#/$defs/set': 'SetChange',
  'change.schema.json#/$defs/adjust': 'AdjustChange',
  'change.schema.json#/$defs/addItem': 'AddItemChange',
  'change.schema.json#/$defs/removeItem': 'RemoveItemChange',
  'change.schema.json#/$defs/equip': 'EquipChange',
  'change.schema.json#/$defs/setState': 'SetStateChange',
  'change.schema.json#/$defs/adjustState': 'AdjustStateChange',
  'change.schema.json#/$defs/template': 'TemplateChange',
  'change.schema.json#/$defs/applyEffect': 'ApplyEffectChange',
  'change.schema.json#/$defs/removeEffect': 'RemoveEffectChange',
  'change.schema.json#/$defs/toggleEffect': 'ToggleEffectChange',
  'change.schema.json#/$defs/choose': 'ChooseChange',
  'change.schema.json#/$defs/setExtension': 'SetExtensionChange',
  'change.schema.json#/$defs/setHomebrew': 'SetHomebrewChange',
  'change.schema.json#/$defs/proposed': 'ProposedChange',
  'change.schema.json#/$defs/copies': 'CopiesQuery',
  'change.schema.json#/$defs/limit': 'CopiesLimit',
  'character.schema.json#/$defs/pick': 'ChoicePick',
  'character.schema.json#/$defs/state': 'EntryState',
  'upgrade.schema.json#/$defs/step': 'UpgradeStep',
  'spec-upgrade.schema.json#/$defs/step': 'SpecUpgradeStep',
  'export.schema.json#/$defs/pack': 'ExportPack',
  'export.schema.json#/$defs/reference': 'ExportPackReference',
  'export.schema.json#/$defs/embedded': 'ExportEmbeddedPack',
  'export.schema.json#/$defs/integrity': 'PackIntegrity',
  'spec-upgrade.schema.json#/$defs/path': 'SpecUpgradePath',
  'action.schema.json#/$defs/step': 'Step',
  'action.schema.json#/$defs/steps': 'Steps',
  'formula.schema.json': 'Formula',
  'formula.schema.json#/$defs/dice': 'DiceFormula',
  'formula.schema.json#/$defs/tree': 'FormulaTree',
  'formula.schema.json#/$defs/compiled': 'CompiledFormula',
  'engine/action-run.schema.json#/$defs/result': 'ActionResult',
  'engine/action-run.schema.json#/$defs/need': 'ActionNeed',
  'engine/action-run.schema.json#/$defs/policy': 'ActionPolicy',
  'engine/load-ruleset.schema.json#/$defs/failure': 'EngineFailure',
  'roll-item.schema.json#/$defs/face': 'RolledFace',
  'effect.schema.json#/$defs/target': 'EffectTarget',
  'display.schema.json#/$defs/group': 'DisplayGroup',
  'engine/apply-changes.schema.json#/$defs/followUp': 'ListedFollowUp',
  'character.schema.json#/$defs/followUp': 'StoredFollowUp',
};

/** Names a module may not declare without hiding a TypeScript global. */
const RESERVED = new Set([
  'Array',
  'Boolean',
  'Date',
  'Error',
  'Function',
  'Map',
  'Number',
  'Object',
  'Omit',
  'Partial',
  'Pick',
  'Promise',
  'Readonly',
  'Record',
  'Required',
  'Set',
  'String',
  'Symbol',
]);

/** Fixed sets that no schema lists as an enum, emitted as unions of their IDs. */
const CODE_SETS: [string, string][] = [
  ['ErrorCode', 'error-codes'],
  ['RulesIssueCode', 'rules-issue-codes'],
];

const pascal = (s: string) =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');

/** A pointer like `/$defs/nodes/int` as its segments. */
const segments = (pointer: string) =>
  pointer
    .split('/')
    .slice(1)
    .map((s) => s.replaceAll('~1', '/').replaceAll('~0', '~'));

const literal = (v: unknown) => JSON.stringify(v);
const union = (parts: string[]) => {
  const unique = [...new Set(parts)];
  if (unique.includes('unknown')) return 'unknown';
  return unique.length === 0 ? 'never' : unique.join(' | ');
};
const paren = (t: string) => (/[|&]/.test(t) ? `(${t})` : t);
const propKey = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
const doc = (node: unknown, indent: string) => {
  if (!isObj(node) || typeof node.description !== 'string') return '';
  const text = node.description.replaceAll('*/', '*\\/');
  return `${indent}/** ${text} */\n`;
};

const isSchema = (node: Schema) =>
  typeof node === 'boolean' || SCHEMA_KEYWORDS.some((k) => k in node);
/** An `if`/`then` constraint with no shape of its own (`effect.schema.json#/$defs/tallyOps`). */
const isConstraint = (node: unknown): boolean => isObj(node) && 'if' in node && !hasShape(node);

interface Location {
  file: string;
  pointer: string;
}

const keyOf = (l: Location) => (l.pointer ? `${l.file}#${l.pointer}` : l.file);

export function generate(schemas: Map<string, JsonSchema> = loadSchemas()): string {
  const byFile = schemas;

  function at(loc: Location): Schema {
    let node: unknown = byFile.get(loc.file);
    if (node === undefined) throw new Error(`no schema ${loc.file}`);
    for (const seg of segments(loc.pointer)) node = (node as Record<string, unknown>)[seg];
    if (node === undefined) throw new Error(`no node at ${keyOf(loc)}`);
    return node as Schema;
  }

  function resolve(ref: string, from: Location): Location {
    const base = `${SCHEMA_BASE}${from.file}`;
    const url = new URL(ref, base);
    const [href = '', hash = ''] = url.href.split('#');
    return { file: href.slice(SCHEMA_BASE.length), pointer: decodeURIComponent(hash) };
  }

  // Every `$ref` target outside `if` keywords. A def in a `$defs` folder (`$defs/nodes/int`) is
  // emitted only when something refers to it this way, so `$defs/is/*` (used only in `if`) isn't.
  const referenced = new Set<string>();
  for (const [file] of byFile) {
    const visit = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!isObj(node)) return;
      if (typeof node.$ref === 'string')
        referenced.add(keyOf(resolve(node.$ref, { file, pointer: '' })));
      for (const [k, v] of Object.entries(node)) if (k !== 'if') visit(v);
    };
    visit(byFile.get(file));
  }

  const named = new Map<string, Location>();
  for (const [file, schema] of byFile) {
    if (isSchema(schema as Schema)) named.set(file, { file, pointer: '' });
    const walk = (defs: unknown, pointer: string) => {
      if (!isObj(defs)) return;
      for (const [name, def] of Object.entries(defs)) {
        const p = `${pointer}/${name}`;
        if (!isObj(def) || isConstraint(def)) continue;
        const nested = pointer !== '/$defs';
        if (!isSchema(def)) walk(def, p);
        else if (!nested || referenced.has(keyOf({ file, pointer: p })))
          named.set(keyOf({ file, pointer: p }), { file, pointer: p });
      }
    };
    walk(schema.$defs, '/$defs');
  }

  function defaultName(loc: Location): string {
    const schema = byFile.get(loc.file) as Record<string, unknown>;
    const title = pascal(String(schema.title ?? loc.file.replace(/\.schema\.json$/, '')));
    if (!loc.pointer) return title;
    const segs = segments(loc.pointer);
    const last = segs.at(-1)!;
    if (loc.file.startsWith('engine/') && ['input', 'output'].includes(last))
      return title + pascal(last);
    if (segs.includes('nodes')) return `${pascal(last)}Node`;
    return pascal(last);
  }

  const names = new Map<string, string>();
  const taken = new Map<string, string>();
  for (const [key, loc] of named) {
    const name = NAMES[key] ?? defaultName(loc);
    if (RESERVED.has(name))
      throw new Error(`${key}: "${name}" hides a TypeScript global; add it to NAMES`);
    const other = taken.get(name);
    if (other) throw new Error(`${key} and ${other} are both "${name}"; add one to NAMES`);
    taken.set(name, key);
    names.set(key, name);
  }

  // `if`/`then` dispatch: an allOf whose every item picks a whole variant by one discriminator.
  interface Dispatch {
    key: string;
    arms: { values: unknown[]; variant: Location }[];
  }
  function dispatchOf(node: Record<string, unknown>, loc: Location): Dispatch | undefined {
    const all = node.allOf;
    if (!Array.isArray(all) || all.length === 0) return undefined;
    let key: string | undefined;
    const arms: Dispatch['arms'] = [];
    for (const item of all) {
      if (!isObj(item) || !isObj(item.if) || !isObj(item.then)) return undefined;
      // The condition may be inline or a `$ref` (`change.schema.json#/$defs/is/set`).
      const cond0 = typeof item.if.$ref === 'string' ? at(resolve(item.if.$ref, loc)) : item.if;
      if (!isObj(cond0)) return undefined;
      const props = cond0.properties;
      if (!isObj(props) || Object.keys(props).length !== 1) return undefined;
      const [k, cond] = Object.entries(props)[0]!;
      if (!isObj(cond)) return undefined;
      const values = 'const' in cond ? [cond.const] : Array.isArray(cond.enum) ? cond.enum : null;
      if (!values || typeof item.then.$ref !== 'string') return undefined;
      if (key !== undefined && key !== k) return undefined;
      key = k;
      arms.push({ values, variant: resolve(item.then.$ref, loc) });
    }
    return key === undefined ? undefined : { key, arms };
  }

  // Discriminator values a dispatch target takes, so its own type names them.
  const discriminators = new Map<string, { key: string; values: unknown[] }>();
  for (const loc of named.values()) {
    const node = at(loc);
    if (!isObj(node)) continue;
    const d = dispatchOf(node, loc);
    if (!d) continue;
    for (const arm of d.arms) {
      const k = keyOf(arm.variant);
      const prev = discriminators.get(k);
      discriminators.set(k, { key: d.key, values: [...(prev?.values ?? []), ...arm.values] });
    }
  }

  function typeOf(node: Schema, loc: Location, indent: string): string {
    if (node === true) return 'unknown';
    if (node === false) return 'never';

    if (typeof node.$ref === 'string') {
      const target = resolve(node.$ref, loc);
      const name = names.get(keyOf(target));
      return name ?? typeOf(at(target), target, indent);
    }
    if ('const' in node) return literal(node.const);
    if (Array.isArray(node.enum)) return union(node.enum.map(literal));

    const dispatch = dispatchOf(node, loc);
    if (dispatch)
      return union(
        dispatch.arms.map(
          (arm) => names.get(keyOf(arm.variant)) ?? typeOf(at(arm.variant), arm.variant, indent),
        ),
      );

    for (const k of ['oneOf', 'anyOf'] as const) {
      const options = node[k];
      if (!Array.isArray(options)) continue;
      // Branches that only require properties of the surrounding object narrow it; skip them.
      const shapes = options.filter((o) => isObj(o) && isSchema(o) && !onlyRequires(o));
      if (shapes.length === 0) break;
      const base = withoutKeys(node, [k]);
      const branches = union(
        shapes.map((o, i) =>
          typeOf(o as Schema, { ...loc, pointer: `${loc.pointer}/${k}/${i}` }, indent),
        ),
      );
      return isSchema(base) && hasShape(base)
        ? `${paren(typeOf(base, loc, indent))} & ${paren(branches)}`
        : branches;
    }

    if (Array.isArray(node.allOf)) {
      const parts = node.allOf
        .filter(
          (o) =>
            isObj(o) &&
            !isConstraint(o) &&
            !(typeof o.$ref === 'string' && isConstraint(at(resolve(o.$ref, loc)))) &&
            isSchema(o),
        )
        .map((o, i) =>
          typeOf(o as Schema, { ...loc, pointer: `${loc.pointer}/allOf/${i}` }, indent),
        );
      const base = withoutKeys(node, ['allOf']);
      if (hasShape(base)) parts.unshift(typeOf(base, loc, indent));
      if (parts.length > 0) return parts.map(paren).join(' & ');
    }

    const types = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];
    if (types.length > 1) return union(types.map((t) => typeOf({ ...node, type: t }, loc, indent)));
    switch (types[0]) {
      case 'string':
        return 'string';
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'null':
        return 'null';
      case 'array': {
        const items = node.items;
        return items === undefined || items === true
          ? 'unknown[]'
          : `${paren(typeOf(items as Schema, { ...loc, pointer: `${loc.pointer}/items` }, indent))}[]`;
      }
      case 'object':
        return objectType(node, loc, indent);
    }
    if (isObj(node.properties) || 'additionalProperties' in node)
      return objectType(node, loc, indent);
    return 'unknown';
  }

  function objectType(node: Record<string, unknown>, loc: Location, indent: string): string {
    const props = isObj(node.properties) ? node.properties : {};
    const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
    const disc = discriminators.get(keyOf(loc));
    const inner = `${indent}  `;
    const lines: string[] = [];
    for (const [k, schema] of Object.entries(props)) {
      const ploc = {
        ...loc,
        pointer: `${loc.pointer}/properties/${k.replaceAll('~', '~0').replaceAll('/', '~1')}`,
      };
      let t: string;
      let optional = !required.has(k);
      if (disc && disc.key === k) {
        t = union(disc.values.map(literal));
        optional = false;
      } else t = typeOf(schema as Schema, ploc, inner);
      lines.push(`${doc(schema, inner)}${inner}${propKey(k)}${optional ? '?' : ''}: ${t};`);
    }
    if (disc && !(disc.key in props))
      lines.unshift(`${inner}${propKey(disc.key)}: ${union(disc.values.map(literal))};`);
    const extra = node.additionalProperties;
    if (extra !== false) {
      const t =
        extra === undefined || extra === true
          ? 'unknown'
          : typeOf(
              extra as Schema,
              { ...loc, pointer: `${loc.pointer}/additionalProperties` },
              inner,
            );
      if (lines.length === 0) return `Record<string, ${t}>`;
      if (extra !== undefined) lines.push(`${inner}[key: string]: ${t};`);
    }
    return lines.length === 0 ? 'Record<string, never>' : `{\n${lines.join('\n')}\n${indent}}`;
  }

  const out: string[] = [
    '// Generated from packages/spec/schemas by `pnpm types`. Do not edit.',
    "// See scripts/types/generate.ts for what is and isn't carried over from the schemas.",
    '',
  ];
  for (const [key, loc] of named) {
    const node = at(loc);
    out.push(`${doc(node, '')}export type ${names.get(key)} = ${typeOf(node, loc, '')};`, '');
  }
  for (const [name, set] of CODE_SETS)
    out.push(
      `/** Codes in \`data/${set}.json\`. */`,
      `export type ${name} = ${union(fixedSetIds(set).map(literal))};`,
      '',
    );
  return out.join('\n');
}

/** A branch that only requires (or forbids) properties of its parent object, narrowing it. */
function onlyRequires(node: Record<string, unknown>): boolean {
  return (
    'required' in node &&
    (node.type === undefined || node.type === 'object') &&
    Object.keys(node).every((k) => ['required', 'not', 'type', 'description'].includes(k))
  );
}

function withoutKeys(node: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(node).filter(([k]) => !keys.includes(k)));
}

/** Whether a schema says anything about its value's shape, beyond annotations. */
function hasShape(node: Record<string, unknown>): boolean {
  return ['type', 'properties', 'additionalProperties', 'items', '$ref', 'enum', 'const'].some(
    (k) => k in node,
  );
}

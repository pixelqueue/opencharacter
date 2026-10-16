// Schema-driven forms: the pure part. Resolves the spec's JSON Schemas ($ref across files,
// allOf/if-then, anyOf/oneOf) into what a form needs, and turns edits into minimal YAML ops.

export type Schema = { [key: string]: unknown };

/** A schema node together with the `$id` of the file it came from (to resolve relative $refs). */
export interface At {
  node: Schema;
  base: string;
  /** Reached through formula.schema.json: edit as a formula. */
  formula?: boolean;
}

const FORMULA = 'formula.schema.json';

function pointer(doc: Schema, path: string): Schema {
  let node: unknown = doc;
  for (const raw of path.split('/').filter(Boolean)) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    node = (node as Record<string, unknown>)?.[key];
  }
  if (!node || typeof node !== 'object') throw new Error(`no schema at #${path}`);
  return node as Schema;
}

export class Registry {
  constructor(private readonly schemas: Record<string, Schema>) {}

  doc(id: string): At {
    const node = this.schemas[id];
    if (!node) throw new Error(`unknown schema ${id}`);
    return { node, base: id };
  }

  /**
   * Follows `$ref`s. A node with a `$ref` plus other keywords is the referenced schema with those
   * keywords on top (a `$ref` to a tag list with `minItems`, say).
   */
  resolve(at: At): At {
    let current = at;
    for (let i = 0; i < 32 && typeof current.node.$ref === 'string'; i++) {
      const url = new URL(current.node.$ref as string, current.base);
      const [file, frag = ''] = url.href.split('#');
      const doc = this.schemas[file as string];
      if (!doc) throw new Error(`unknown schema ${file}`);
      const target = pointer(doc, frag);
      const { $ref: _ref, ...siblings } = current.node;
      const formula =
        current.formula ||
        ((file as string).endsWith(FORMULA) &&
          ['', '/$defs/condition', '/$defs/dice'].includes(frag));
      current = {
        node: { ...target, ...siblings },
        base: file as string,
        ...(formula ? { formula: true } : {}),
      };
    }
    return current;
  }

  child(parent: At, node: unknown): At {
    return this.resolve({ node: node as Schema, base: parent.base });
  }
}

export type Kind =
  | 'formula'
  | 'enum'
  | 'const'
  | 'union'
  | 'object'
  | 'map'
  | 'array'
  | 'boolean'
  | 'number'
  | 'string'
  | 'json';

export function kindOf(at: At): Kind {
  const n = at.node;
  if (at.formula) return 'formula';
  if (Array.isArray(n.enum)) return 'enum';
  if ('const' in n) return 'const';
  // A node with its own properties is an object; an anyOf/oneOf beside them only constrains which
  // keys may appear (content items: a new item or an override), it isn't a choice of shapes.
  if ((Array.isArray(n.anyOf) || Array.isArray(n.oneOf)) && !n.properties) return 'union';
  if (n.type === 'object' || n.properties || n.additionalProperties) {
    return !n.properties && n.additionalProperties && typeof n.additionalProperties === 'object'
      ? 'map'
      : 'object';
  }
  if (n.type === 'array') return 'array';
  if (n.type === 'boolean') return 'boolean';
  if (n.type === 'integer' || n.type === 'number') return 'number';
  if (n.type === 'string') return 'string';
  return 'json';
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function matches(reg: Registry, at: At, value: unknown): boolean {
  const n = at.node;
  if (at.formula)
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  if (Array.isArray(n.enum)) return (n.enum as unknown[]).includes(value);
  if ('const' in n) return n.const === value;
  const options = (n.anyOf ?? n.oneOf) as unknown[] | undefined;
  if (options) return options.some((v) => matches(reg, reg.child(at, v), value));
  switch (n.type) {
    case 'object':
      return (
        isObject(value) && ((n.required as string[] | undefined) ?? []).every((k) => k in value)
      );
    case 'array':
      return Array.isArray(value);
    case 'string':
      return (
        typeof value === 'string' &&
        (typeof n.pattern !== 'string' || new RegExp(n.pattern).test(value))
      );
    case 'integer':
      return Number.isInteger(value);
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    default:
      if (n.properties) return isObject(value);
      return true;
  }
}

/** The variants of a union node, resolved, with nested unions flattened into one list. */
export function variants(reg: Registry, at: At): At[] {
  return (((at.node.anyOf ?? at.node.oneOf) as unknown[]) ?? []).flatMap((v) => {
    const child = reg.child(at, v);
    return kindOf(child) === 'union' && !child.formula ? variants(reg, child) : [child];
  });
}

export function variantFor(reg: Registry, at: At, value: unknown): number {
  const list = variants(reg, at);
  const i = list.findIndex((v) => matches(reg, v, value));
  return i >= 0 ? i : 0;
}

export function label(at: At): string {
  const n = at.node;
  if (typeof n.title === 'string') return n.title;
  if (at.formula) return 'formula';
  if ('const' in n) return String(n.const);
  if (n.type === 'object' && Array.isArray(n.required) && n.required.length > 0)
    return `{ ${(n.required as string[]).join(', ')} }`;
  if (n.type === 'array') return 'list';
  if (typeof n.description === 'string')
    return n.description.split(/[.:]/)[0]?.slice(0, 40) ?? 'option';
  return String(n.type ?? 'value');
}

export interface Property {
  name: string;
  at: At;
  required: boolean;
}

export function properties(reg: Registry, at: At, value: unknown): Property[] {
  const props = new Map<string, At>();
  const required = new Set<string>();
  const add = (node: At) => {
    for (const [name, p] of Object.entries(
      (node.node.properties as Record<string, unknown>) ?? {},
    )) {
      const resolved = reg.child(node, p);
      // A bare `true` (allow anything) never replaces a real definition.
      if (p === true && props.has(name)) continue;
      props.set(name, resolved);
    }
    for (const r of (node.node.required as string[]) ?? []) required.add(r);
  };
  const visit = (node: At) => {
    add(node);
    for (const part of (node.node.allOf as unknown[]) ?? []) {
      const p = part as Schema;
      if (p.if) {
        const cond = reg.child(node, p.if);
        const branch = conditionHolds(reg, cond, value) ? p.then : p.else;
        if (branch) visit(reg.child(node, branch));
      } else {
        visit(reg.child(node, part));
      }
    }
  };
  visit(at);
  return [...props.entries()].map(([name, a]) => ({ name, at: a, required: required.has(name) }));
}

function conditionHolds(reg: Registry, cond: At, value: unknown): boolean {
  if (!isObject(value)) return false;
  for (const r of (cond.node.required as string[]) ?? []) if (!(r in value)) return false;
  for (const [name, p] of Object.entries((cond.node.properties as Record<string, unknown>) ?? {})) {
    if (!(name in value)) return false;
    if (!matches(reg, reg.child(cond, p), value[name])) return false;
  }
  return true;
}

export function initial(reg: Registry, at: At): unknown {
  const n = at.node;
  if ('default' in n) return n.default;
  if (at.formula) return '';
  if (Array.isArray(n.enum)) return n.enum[0];
  if ('const' in n) return n.const;
  const list = variants(reg, at);
  if (list.length > 0) return initial(reg, list[0] as At);
  switch (kindOf(at)) {
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const p of properties(reg, at, {})) if (p.required) out[p.name] = initial(reg, p.at);
      return out;
    }
    case 'map':
      return {};
    case 'array':
      return [];
    case 'boolean':
      return false;
    case 'number':
      return 0;
    default:
      return '';
  }
}

export interface Op {
  path: (string | number)[];
  value?: unknown;
  delete?: boolean;
}

/** The smallest ops from `before` to `after`: objects key by key (so comments survive), else replaced. */
export function diff(before: unknown, after: unknown, path: (string | number)[] = []): Op[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (isObject(before) && isObject(after) && path.length >= 0) {
    const ops: Op[] = [];
    for (const key of Object.keys(before))
      if (!(key in after)) ops.push({ path: [...path, key], delete: true });
    for (const [key, value] of Object.entries(after))
      ops.push(...diff(before[key], value, [...path, key]));
    return ops;
  }
  if (path.length === 0)
    return Object.keys((after as object) ?? {}).map((key) => ({
      path: [key],
      value: (after as Record<string, unknown>)[key],
    }));
  return after === undefined ? [{ path, delete: true }] : [{ path, value: after }];
}

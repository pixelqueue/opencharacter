import type { ContentItem, RulesDoc } from './pack-types.ts';

export interface FamilyProblem {
  where: { rules: number } | { content: number };
  message: string;
}

const PLACEHOLDER = /\{([a-z][a-zA-Z0-9]*)\}/g;

type Families = Map<string, string[]>;
type ViewFields = Map<string, Record<string, unknown>>;

/**
 * Expands a pack's families and shared view fields in its rules documents and content items,
 * returning new documents without `viewFields`; `families` stays, since formulas read it
 * (`fieldOf`, `keysOf`).
 *
 * - `families: { <name>: [values] }` names lists of keys. A rules mapping key holding `{<name>}`
 *   is replaced, in its place, by one entry per value (per combination, the first placeholder
 *   outermost), with `{<name>}` replaced in every string of the entry, keys included.
 * - `viewFields: { <name>: { <field>: decl } }` names sets of declared fields; a `fields` given
 *   as a string (a link slot's, a participant role's, in rules or content) is that set.
 */
export function expandFamilies(
  rules: readonly RulesDoc[],
  content: readonly ContentItem[],
  /** The families the pack sees, by name (loadRuleset's, with other packs'); else its own. */
  visible?: ReadonlyMap<string, string[]>,
): { rules: RulesDoc[]; content: ContentItem[]; problems: FamilyProblem[] } {
  const problems: FamilyProblem[] = [];
  const families: Families = new Map(visible ?? []);
  const views: ViewFields = new Map();
  rules.forEach((doc, i) => {
    for (const [name, values] of Object.entries(doc.families ?? {})) {
      // A qualified name adds to another pack's family; `visible` has the sum.
      if (visible || name.includes(':')) continue;
      if (families.has(name))
        problems.push({ where: { rules: i }, message: `family "${name}" is declared twice` });
      families.set(name, values.map(String));
    }
    for (const [name, set] of Object.entries(doc.viewFields ?? {})) {
      if (views.has(name))
        problems.push({ where: { rules: i }, message: `view fields "${name}" are declared twice` });
      views.set(name, set as Record<string, unknown>);
    }
  });
  const expand = (value: unknown, keys: boolean, report: (message: string) => void) =>
    walk(value, keys ? families : new Map(), views, report);
  return {
    rules: rules.map((doc, i) => {
      const { families: declared, viewFields: _v, ...rest } = doc;
      const out = expand(rest, true, (message) =>
        problems.push({ where: { rules: i }, message }),
      ) as RulesDoc;
      return declared ? { families: declared, ...out } : out;
    }),
    content: content.map(
      (item, i) =>
        expand(item, false, (message) =>
          problems.push({ where: { content: i }, message }),
        ) as ContentItem,
    ),
    problems,
  };
}

function walk(
  value: unknown,
  families: Families,
  views: ViewFields,
  report: (message: string) => void,
): unknown {
  if (Array.isArray(value)) return value.map((v) => walk(v, families, views, report));
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    let v = raw;
    if (key === 'fields' && typeof v === 'string') {
      const set = views.get(v);
      if (!set) report(`no view fields named "${v}"`);
      v = set ?? {};
    }
    const names =
      families.size === 0
        ? []
        : [...new Set([...key.matchAll(PLACEHOLDER)].map((m) => m[1] as string))];
    if (names.length === 0) {
      out[key] = walk(v, families, views, report);
      continue;
    }
    const unknown = names.filter((n) => !families.has(n));
    if (unknown.length > 0) {
      report(`"${key}": no family named ${unknown.map((n) => `"${n}"`).join(', ')}`);
      continue;
    }
    for (const binding of bindings(names, families)) {
      const id = substitute(key, binding) as string;
      if (Object.hasOwn(out, id) || (Object.hasOwn(value, id) && id !== key)) {
        report(`"${key}" gives "${id}" twice`);
        continue;
      }
      out[id] = walk(substitute(v, binding), families, views, report);
    }
  }
  return out;
}

function bindings(names: string[], families: Families): Record<string, string>[] {
  let out: Record<string, string>[] = [{}];
  for (const name of names)
    out = out.flatMap((b) => (families.get(name) ?? []).map((v) => ({ ...b, [name]: v })));
  return out;
}

function substitute(value: unknown, binding: Record<string, string>): unknown {
  if (typeof value === 'string')
    return value.replace(PLACEHOLDER, (whole, name: string) => binding[name] ?? whole);
  if (Array.isArray(value)) return value.map((v) => substitute(v, binding));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      substitute(k, binding) as string,
      substitute(v, binding),
    ]),
  );
}

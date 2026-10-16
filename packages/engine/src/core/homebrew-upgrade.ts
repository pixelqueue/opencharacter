import type { UpgradeStep } from '@opencharacter/spec';
import * as f from '../formula/index.ts';
import type { Node } from '../formula/index.ts';
import { HOMEBREW } from './homebrew.ts';
import type { CharacterDoc, ValueDecl } from './pack-types.ts';
import {
  resolveAction,
  resolveContent,
  resolveField,
  resolveType,
  type Ruleset,
} from './ruleset.ts';

type Kind = 'content' | 'field' | 'type' | 'action' | 'tag';
type Json = unknown;
type Obj = Record<string, Json>;

/** Keys whose string value is a reference of a kind, and keys whose string list members are. */
const VALUE_KEYS: Record<Kind, ReadonlySet<string>> = {
  content: new Set(['extends', 'item']),
  field: new Set(['target', 'field', 'into']),
  type: new Set(['type', 'of']),
  action: new Set(['use', 'action']),
  tag: new Set(),
};
const LIST_KEYS: Record<Kind, ReadonlySet<string>> = {
  content: new Set(['items']),
  field: new Set(['fields', 'absorbedBy']),
  type: new Set(),
  action: new Set(),
  tag: new Set(['tags', 'choices']),
};
/** Value kinds an item field's `of` may name that aren't content types. */
const BUILT_IN_OF = new Set(['field', 'tag', 'string']);

const isObj = (v: Json): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const pointer = (parts: readonly (string | number)[]) =>
  parts.map((p) => `/${String(p).replaceAll('~', '~0').replaceAll('/', '~1')}`).join('');
const localOf = (qid: string) => qid.slice(qid.indexOf(':') + 1);
const str = (v: unknown) => v as string;

interface Rename {
  kind: Kind;
  from: string;
  to: string;
}

function mapTree(node: Node, fn: (n: Node) => Node): Node {
  const m = (n: Node) => mapTree(n, fn);
  let out: Node;
  switch (node.type) {
    case 'list':
      out = { ...node, items: node.items.map(m) };
      break;
    case 'member':
      out = { ...node, object: m(node.object) };
      break;
    case 'index':
      out = { ...node, object: m(node.object), index: m(node.index) };
      break;
    case 'call':
      out = { ...node, args: node.args.map(m) };
      break;
    case 'unary':
      out = { ...node, operand: m(node.operand) };
      break;
    case 'binary':
      out = { ...node, left: m(node.left), right: m(node.right) };
      break;
    case 'conditional':
      // oxlint-disable-next-line unicorn/no-thenable
      out = { ...node, test: m(node.test), then: m(node.then), else: m(node.else) };
      break;
    case 'dice':
      out = typeof node.count === 'number' ? node : { ...node, count: m(node.count) };
      break;
    default:
      out = node;
  }
  return fn(out);
}

/**
 * Rewrites one character's homebrew, step by step, against the ruleset it loaded on before the
 * upgrade. Each method returns the JSON Pointers (into the character) it rewrote.
 */
export class HomebrewRewriter {
  private readonly types: (string | undefined)[];
  private readonly oldTypes: (string | undefined)[];
  private readonly formulas: Set<string>;

  constructor(
    private readonly character: CharacterDoc,
    private readonly from: Ruleset,
    private readonly to: Ruleset,
    formulas: ReadonlySet<string>,
  ) {
    this.oldTypes = (character.homebrew?.content ?? []).map(
      (item) => from.content[`${HOMEBREW}:${item.id}`]?.type,
    );
    this.types = [...this.oldTypes];
    this.formulas = new Set(formulas);
  }

  /** A homebrew item's content type, as renamed so far; undefined for other content. */
  typeOf(qid: string): string | undefined {
    if (!qid.startsWith(`${HOMEBREW}:`)) return undefined;
    const i = (this.character.homebrew?.content ?? []).findIndex(
      (item) => `${HOMEBREW}:${item.id}` === qid,
    );
    return i < 0 ? undefined : this.types[i];
  }

  apply(step: UpgradeStep, pack: string): string[] {
    const homebrew = this.character.homebrew as Obj | undefined;
    if (!homebrew) return [];
    const q = (local: string) => (local.includes(':') ? local : `${pack}:${local}`);
    switch (step.op) {
      case 'renameContent':
        return this.rename({ kind: 'content', from: q(str(step.from)), to: q(str(step.to)) });
      case 'renameField':
        return this.rename({ kind: 'field', from: q(str(step.from)), to: q(str(step.to)) });
      case 'renameContentType': {
        const rename = { kind: 'type' as const, from: q(str(step.from)), to: q(str(step.to)) };
        const paths = this.rename(rename);
        this.types.forEach((t, i) => {
          if (t === rename.from) this.types[i] = rename.to;
        });
        return paths;
      }
      case 'renameAction':
        return this.rename({ kind: 'action', from: q(str(step.from)), to: q(str(step.to)) });
      case 'renameTag':
        return this.rename({ kind: 'tag', from: str(step.from), to: str(step.to) });
      case 'renameState':
        return this.onItems(step.type === undefined ? undefined : q(step.type), (item, at) => {
          const paths: string[] = [];
          const state = item.state;
          const key = str(step.from);
          if (isObj(state) && Object.hasOwn(state, key)) {
            item.state = renameKey(state, key, str(step.to));
            paths.push(pointer([...at, 'state', key]));
          }
          return [...paths, ...this.rootRename(item, at, 'self', key, str(step.to))];
        });
      case 'renameItemField':
        return this.onItems(q(str(step.type)), (item, at) => {
          const paths: string[] = [];
          const fields = item.fields;
          const key = str(step.from);
          if (isObj(fields) && Object.hasOwn(fields, key)) {
            item.fields = renameKey(fields, key, str(step.to));
            paths.push(pointer([...at, 'fields', key]));
          }
          return [...paths, ...this.rootRename(item, at, 'item', key, str(step.to))];
        });
      case 'removeItemField':
        return this.onItems(q(str(step.type)), (item, at) => {
          const fields = item.fields;
          const key = str(step.field);
          if (!isObj(fields) || !Object.hasOwn(fields, key)) return [];
          delete fields[key];
          return [pointer([...at, 'fields', key])];
        });
      case 'mapItemValues':
        return this.onItems(q(str(step.type)), (item, at) => {
          const fields = item.fields;
          const key = str(step.field);
          const map = step.map ?? {};
          if (!isObj(fields) || !Object.hasOwn(fields, key)) return [];
          const one = (v: Json) => (Object.hasOwn(map, String(v)) ? map[String(v)] : v);
          const value = fields[key];
          const mapped = Array.isArray(value) ? value.map(one) : one(value);
          if (JSON.stringify(mapped) === JSON.stringify(value)) return [];
          fields[key] = mapped;
          return [pointer([...at, 'fields', key])];
        });
      default:
        return [];
    }
  }

  /** Runs `fn` on each homebrew content item of the type (every item when `type` is absent). */
  private onItems(type: string | undefined, fn: (item: Obj, at: (string | number)[]) => string[]) {
    const content = (this.character.homebrew?.content ?? []) as Obj[];
    return content.flatMap((item, i) =>
      type === undefined || this.types[i] === type ? fn(item, ['homebrew', 'content', i]) : [],
    );
  }

  /** Renames `<root>.<from>` to `<root>.<to>` in the formulas inside one homebrew item. */
  private rootRename(item: Obj, at: (string | number)[], root: string, from: string, to: string) {
    const paths: string[] = [];
    const visit = (value: Json, parts: (string | number)[], set: (v: Json) => void) => {
      if (typeof value === 'string') {
        const next = this.formula(value, (n) =>
          n.type === 'name' && n.path[0] === root && n.path[1] === from
            ? { ...n, path: [root, to, ...n.path.slice(2)] }
            : n,
        );
        if (next !== undefined) {
          set(next);
          paths.push(pointer(parts));
        }
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => visit(v, [...parts, i], (w) => (value[i] = w)));
      } else if (isObj(value)) {
        for (const [k, v] of Object.entries(value)) visit(v, [...parts, k], (w) => (value[k] = w));
      }
    };
    for (const [k, v] of Object.entries(item)) visit(v, [...at, k], (w) => (item[k] = w));
    return paths;
  }

  /** A formula written as text, rewritten by `fn`; undefined when it isn't one or is unchanged. */
  private formula(text: string, fn: (n: Node) => Node): string | undefined {
    if (!this.formulas.has(text)) return undefined;
    const tree = f.parse(text);
    if (!tree.ok) return undefined;
    const next = mapTree(tree.value, fn);
    if (JSON.stringify(next) === JSON.stringify(tree.value)) return undefined;
    const printed = f.print(next);
    this.formulas.add(printed);
    return printed;
  }

  /**
   * Whether a reference names `qid`: it is `qid`, or `qid`'s local ID that the homebrew's scope
   * doesn't resolve to anything else on the old ruleset.
   */
  private matches(kind: Exclude<Kind, 'tag'>, ref: string, qid: string): boolean {
    if (ref === qid) return true;
    if (ref.includes(':') || ref !== localOf(qid)) return false;
    const resolve = {
      content: resolveContent,
      field: resolveField,
      type: resolveType,
      action: resolveAction,
    }[kind];
    const found = resolve(this.from, ref, HOMEBREW);
    return found === undefined || found === qid;
  }

  private refMatches(rename: Rename, ref: string): boolean {
    return rename.kind === 'tag'
      ? ref === rename.from
      : this.matches(rename.kind, ref, rename.from);
  }

  /** The formula rewrite for a rename: names for fields, string literals for the others. */
  private formulaFn(rename: Rename, key: string | undefined): (n: Node) => Node {
    return (n) => {
      if (
        rename.kind === 'field' &&
        n.type === 'name' &&
        this.matches('field', n.path.join('.'), rename.from)
      )
        return { ...n, path: localOf(rename.to).split('.') };
      if (n.type !== 'string') return n;
      const hit =
        rename.kind === 'tag'
          ? n.value === rename.from
          : rename.kind === 'field' || rename.kind === 'action'
            ? false
            : n.value === rename.from ||
              // An applyEffect's or action step's `source` names content as written.
              (rename.kind === 'content' &&
                key === 'source' &&
                this.matches('content', n.value, rename.from));
      return hit ? { ...n, value: rename.to } : n;
    };
  }

  private rename(rename: Rename): string[] {
    const homebrew = this.character.homebrew as Obj;
    const paths: string[] = [];
    const visit = (
      value: Json,
      parts: (string | number)[],
      key: string | undefined,
      set: (v: Json) => void,
    ) => {
      if (typeof value === 'string') {
        if (
          key !== undefined &&
          VALUE_KEYS[rename.kind].has(key) &&
          this.refMatches(rename, value)
        ) {
          set(rename.to);
          paths.push(pointer(parts));
          return;
        }
        const next = this.formula(value, this.formulaFn(rename, key));
        if (next !== undefined) {
          set(next);
          paths.push(pointer(parts));
        }
        return;
      }
      if (Array.isArray(value)) {
        const listed = key !== undefined && LIST_KEYS[rename.kind].has(key);
        value.forEach((v, i) => {
          if (listed && typeof v === 'string' && this.refMatches(rename, v)) {
            value[i] = rename.to;
            paths.push(pointer([...parts, i]));
          } else visit(v, [...parts, i], undefined, (w) => (value[i] = w));
        });
        return;
      }
      if (!isObj(value)) return;
      // Field IDs as keys: an allocate step's `recommend` and the rules' display hints.
      const keyed =
        rename.kind === 'field' &&
        (key === 'recommend' || (key === 'fields' && parts.at(-2) === 'display'));
      for (const k of Object.keys(value)) {
        if (keyed && this.refMatches(rename, k)) {
          const renamed = renameKey(value, k, rename.to);
          for (const name of Object.keys(value)) delete value[name];
          Object.assign(value, renamed);
          paths.push(pointer([...parts, k]));
          continue;
        }
        visit(value[k], [...parts, k], k, (w) => (value[k] = w));
      }
    };
    if (isObj(homebrew.rules))
      visit(homebrew.rules, ['homebrew', 'rules'], undefined, (w) => (homebrew.rules = w));
    const content = (homebrew.content ?? []) as Obj[];
    content.forEach((item, i) => {
      const at = ['homebrew', 'content', i];
      paths.push(...this.itemFields(item, i, at, rename));
      for (const k of Object.keys(item)) {
        if (k === 'fields') continue;
        visit(item[k], [...at, k], k, (w) => (item[k] = w));
      }
    });
    return paths;
  }

  /** Item field values that name content, fields or tags, by the item's type's declarations. */
  private itemFields(item: Obj, i: number, at: (string | number)[], rename: Rename): string[] {
    const fields = item.fields;
    if (!isObj(fields)) return [];
    const type = this.types[i];
    const oldType = this.oldTypes[i];
    // The item field as the new ruleset declares it, else as the old one did.
    const declOf = (name: string): ValueDecl | undefined =>
      (type ? this.to.contentTypes[type]?.fields?.[name] : undefined) ??
      (oldType ? this.from.contentTypes[oldType]?.fields?.[name] : undefined);
    const paths: string[] = [];
    for (const [name, value] of Object.entries(fields)) {
      const decl = declOf(name);
      const of = decl?.of;
      const kind: Kind | undefined =
        of === 'field'
          ? 'field'
          : of === 'tag'
            ? 'tag'
            : of && !BUILT_IN_OF.has(of)
              ? 'content'
              : undefined;
      if (kind !== rename.kind) {
        if (typeof value === 'string') {
          const next = this.formula(value, this.formulaFn(rename, name));
          if (next !== undefined) {
            fields[name] = next;
            paths.push(pointer([...at, 'fields', name]));
          }
        }
        continue;
      }
      const one = (v: Json) =>
        typeof v === 'string' && this.refMatches(rename, v) ? rename.to : v;
      const mapped = Array.isArray(value) ? value.map(one) : one(value);
      if (JSON.stringify(mapped) !== JSON.stringify(value)) {
        fields[name] = mapped;
        paths.push(pointer([...at, 'fields', name]));
      }
    }
    return paths;
  }
}

function renameKey(obj: Obj, from: string, to: string): Obj {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k === from ? to : k, v]));
}

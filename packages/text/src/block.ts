// A block's arguments are read from its message, so every one it names is given (absent: empty).

import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

/** The argument names a message uses, or the parse error. */
export function messageArguments(
  message: string,
): { ok: true; args: string[] } | { ok: false; error: string } {
  let ast: MessageFormatElement[];
  try {
    ast = parse(message, { ignoreTag: true });
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  const args = new Set<string>();
  const walk = (elements: MessageFormatElement[]) => {
    for (const el of elements) {
      if (
        el.type === TYPE.argument ||
        el.type === TYPE.number ||
        el.type === TYPE.date ||
        el.type === TYPE.time
      )
        args.add(el.value);
      else if (el.type === TYPE.select || el.type === TYPE.plural) {
        args.add(el.value);
        for (const option of Object.values(el.options)) walk(option.value);
      } else if (el.type === TYPE.tag) walk(el.children);
    }
  };
  walk(ast);
  return { ok: true, args: [...args] };
}

export type BlockArgument =
  | { kind: 'name' }
  | { kind: 'tags'; names: boolean }
  | { kind: 'text'; text: string }
  | { kind: 'self'; key: string; names: boolean }
  | { kind: 'field'; field: string; names: boolean }
  | { kind: 'tag'; spelled: string }
  | { kind: 'has'; of: BlockArgument };

/** ICU argument names can't hold `.` or `-`: `trait.cantrip` is `tag_trait_cantrip`. */
export function spellTag(tag: string): string {
  return tag.replace(/[.-]/g, '_');
}

/** Whether a tag, or one below it, matches the spelling (pack prefix ignored), as tag targets do. */
export function holdsTag(tags: readonly string[], spelled: string): boolean {
  return tags.some((t) => {
    const parts = t.slice(t.indexOf(':') + 1).split('.');
    return parts.some((_, i) => spellTag(parts.slice(0, i + 1).join('.')) === spelled);
  });
}

/** Reads an argument name; a declared item field wins over the `has_`, `tag_` and `_name` forms. */
export function blockArgument(
  arg: string,
  isField: (name: string) => boolean,
): BlockArgument | undefined {
  if (arg === 'name') return { kind: 'name' };
  if (arg === 'tags') return { kind: 'tags', names: false };
  if (arg === 'tags_name') return { kind: 'tags', names: true };
  if (arg.startsWith('texts_') && arg.length > 6) return { kind: 'text', text: arg.slice(6) };
  if (isField(arg)) return { kind: 'field', field: arg, names: false };
  if (arg.startsWith('has_')) {
    const of = blockArgument(arg.slice(4), isField);
    return of && of.kind !== 'has' ? { kind: 'has', of } : undefined;
  }
  if (arg.startsWith('tag_') && arg.length > 4) return { kind: 'tag', spelled: arg.slice(4) };
  if (arg.startsWith('self_') && arg.length > 5) {
    const key = arg.slice(5);
    return key.endsWith('_name') && key.length > 5
      ? { kind: 'self', key: key.slice(0, -5), names: true }
      : { kind: 'self', key, names: false };
  }
  if (arg.endsWith('_name') && isField(arg.slice(0, -5)))
    return { kind: 'field', field: arg.slice(0, -5), names: true };
  return undefined;
}

export type HeadlineArgument =
  | { kind: 'field'; spelled: string; as: 'value' | 'name' | 'text' }
  | { kind: 'type'; type: string; as: 'names' | 'count' | 'each' }
  | { kind: 'link'; slot: string }
  | { kind: 'has'; of: HeadlineArgument };

export interface HeadlineScope {
  field(spelled: string): boolean;
  type(name: string): boolean;
  link(name: string): boolean;
}

function suffixed<T extends string>(
  rest: string,
  holds: (name: string) => boolean,
  suffixes: readonly T[],
): { base: string; as: T | undefined } | undefined {
  if (holds(rest)) return { base: rest, as: undefined };
  for (const s of suffixes) {
    const base = rest.slice(0, -s.length - 1);
    if (rest.endsWith(`_${s}`) && holds(base)) return { base, as: s };
  }
  return undefined;
}

/** Reads a headline argument; a name the scope holds as written wins over a suffix. */
export function headlineArgument(arg: string, scope: HeadlineScope): HeadlineArgument | undefined {
  if (arg.startsWith('has_')) {
    const of = headlineArgument(arg.slice(4), scope);
    return of && of.kind !== 'has' ? { kind: 'has', of } : undefined;
  }
  if (arg.startsWith('field_')) {
    const hit = suffixed(arg.slice(6), (n) => scope.field(n), ['name', 'text'] as const);
    return hit && { kind: 'field', spelled: hit.base, as: hit.as ?? 'value' };
  }
  if (arg.startsWith('type_')) {
    const hit = suffixed(arg.slice(5), (n) => scope.type(n), ['count', 'each'] as const);
    return hit && { kind: 'type', type: hit.base, as: hit.as ?? 'names' };
  }
  if (arg.startsWith('link_') && scope.link(arg.slice(5)))
    return { kind: 'link', slot: arg.slice(5) };
  return undefined;
}

// Pack text and the spec's standard text for the player's languages, ICU-formatted, falling back
// to any language the bundle holds.

import { IntlMessageFormat } from 'intl-messageformat';
import type { EngineError, RollSummary, RulesIssue } from '@opencharacter/spec';
import {
  blockArgument,
  headlineArgument,
  holdsTag,
  messageArguments,
  spellTag,
  type BlockArgument,
  type HeadlineArgument,
} from './block.ts';
import { diceText, type DiceLike, type Repeat } from './dice.ts';
import {
  actionKey,
  addedOptionKey,
  bandKey,
  blockKey,
  choicePromptKey,
  contentKey,
  doneKey,
  donePendingKey,
  fieldKey,
  fieldValueKey,
  inlineOptionKey,
  issueKey,
  packKey,
  paramKey,
  paramValueKey,
  situationalKey,
  situationalValueKey,
  stateValueKey,
  stepKey,
  tagKey,
  templateFieldKey,
  typeBlockKey,
  typeFieldKey,
  typeKey,
  valueKey,
  writtenOptionKey,
  type ChoiceRef,
  split,
  type MessageRef,
} from './keys.ts';

/** One language's messages: a flat map of key to ICU message. */
export type Messages = Readonly<Record<string, string>>;

/** Values for a message's ICU arguments. Lists are joined; other non-primitives are left out. */
export type Args = Readonly<Record<string, unknown>>;

export interface TextOptions {
  /** Languages in lookup order, the player's first; the first sets number and plural rules. */
  languages: readonly string[];
  /** Pack text by language, then pack ID (`@opencharacter/packs/i18n/<lang>`); homebrew under `homebrew`. */
  packs: Readonly<Record<string, Readonly<Record<string, Messages>>>>;
  /** The spec's standard text by language (`{ en: specEn }`). */
  spec: Readonly<Record<string, Messages>>;
  /** `ruleset.contentTypes`, for blocks' field defaults; else pass the type to `contentBlock`. */
  contentTypes?: Readonly<Record<string, BlockType>>;
  /** `ruleset.content`, for a headline's content of a type. */
  content?: Readonly<Record<string, HeadlineItem>>;
  /** Field display hints (`ruleset.rules.display`), for a headline's `field_<field>_text`. */
  display?: { fields?: Readonly<Record<string, FieldHint>> } | undefined;
}

export interface HeadlineItem {
  type?: string;
  fields?: Readonly<Record<string, unknown>>;
  tags?: readonly string[];
}

export interface FieldHint {
  format?: unknown;
  unit?: string;
  /** The pack whose rules give the hint, whose text names its unit. */
  pack?: string;
}

/** computeSheet's output, the parts a headline reads. */
export interface HeadlineSheet {
  values: Readonly<Record<string, { value?: unknown }>>;
  activations?: readonly { item: string; entry?: string; via: string; scope?: string }[];
  copies?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

export interface CharacterCopy {
  id: string;
  item: string;
  templates?: readonly string[];
  fields?: Readonly<Record<string, unknown>>;
  state?: Readonly<Record<string, unknown>>;
}

export interface HeadlineCharacter {
  packs?: readonly { id: string }[];
  features?: readonly CharacterCopy[];
  inventory?: readonly CharacterCopy[];
  homebrew?: unknown;
}

export interface HeadlineOptions {
  /**
   * The names of the characters filling the link slots, by slot ID (qualified or local), for a
   * headline's `link_<slot>`. The app holds characters' names; the format doesn't.
   */
  links?: Readonly<Record<string, string>>;
}

export interface CopyRef {
  item: string;
  templates?: readonly string[];
  /** computeSheet's `copyNames[id]`; replaces the item's name when non-empty. */
  name?: string | undefined;
}

/** A content item as the ruleset holds it; `id` and `type` qualified, or local to `pack`. */
export interface BlockItem {
  id: string;
  pack?: string;
  /** The content type, or `template`. */
  type: string;
  fields?: Readonly<Record<string, unknown>>;
  tags?: readonly string[];
  /** A template's `appliesTo`: the (first) type names the template's `{name}`. */
  appliesTo?: { type?: string } | readonly { type?: string }[];
}

/** A copy of the item; `computed` is computeSheet's `copies[<entry>]`. */
export interface BlockCopy {
  templates?: readonly string[];
  /** The merged item's tags (computeSheet's `templated`), in place of the item's. */
  tags?: readonly string[];
  fields?: Readonly<Record<string, unknown>>;
  state?: Readonly<Record<string, unknown>>;
  computed?: Readonly<Record<string, unknown>>;
}

export interface BlockType {
  fields?: Readonly<Record<string, { default?: unknown }>>;
}

/** Where an option was offered, so its kind can be told from its ID. */
export interface OptionContext {
  /** `needs.action`: its written options' key root. */
  action?: string;
  /** `needs.choice`: its inline options' and values' key root. */
  choice?: ChoiceRef;
  /** The character's copies by instance ID, for a step over copies. */
  copies?: Readonly<Record<string, CopyRef>>;
  /** Whether an ID is content; defaults to "has a pack prefix". */
  isContent?: (id: string) => boolean;
}

export interface RollTarget {
  band: string;
  name: string;
  /**
   * The pack's band condition, else the spec's `compare.<code>` text per test. Absent when the
   * condition isn't plain comparisons, or the band holds regardless of the roll.
   */
  condition?: string;
}

/** Lookups fall back to the ID (or value) when no language has the key, unless noted. */
export interface Text {
  readonly languages: readonly string[];
  /** `undefined` when no language has the key. */
  message(pack: string, key: string, args?: Args): string | undefined;
  specMessage(key: string, args?: Args): string | undefined;
  lookup(ref: MessageRef, args?: Args): string | undefined;
  pack(id: string): string;
  /** `{ base }` for a template. */
  content(id: string, args?: Args): string;
  /** Its own `name` when non-empty, else its item's, then each template's with `{base}`. */
  copy(copy: CopyRef): string;
  /** `name` is the field's `name` from computeSheet, the text's `{name}`. */
  field(id: string, options?: { short?: boolean; name?: string | undefined }): string;
  fieldValue(id: string, value: string): string;
  /** `action` as in `needs.action`. A parameter with its own `label` key: use `lookup`. */
  param(action: string, param: string): string;
  paramDescription(action: string, param: string): string | undefined;
  paramValue(action: string, param: string, value: string): string;
  type(id: string): string;
  typeField(type: string, field: string): string;
  typeFieldDescription(type: string, field: string): string | undefined;
  /** `id` is `<pack>:<name>`. */
  templateField(id: string): string;
  templateFieldDescription(id: string): string | undefined;
  /** `id` qualified, or local with `pack` the pack to look in. */
  tag(id: string, pack?: string): string;
  /** A set field's member or a stored value: content, else a field, else a tag, else the ID. */
  setMember(id: string, pack?: string): string;
  action(id: string): string;
  /** From the choice's owner (never its path), `{slot}` filled for a slot. */
  choicePrompt(choice: ChoiceRef): string;
  /** Else the action's name. */
  stepPrompt(need: { action: string; step: string }): string;
  /** Else the action's name. */
  stepName(need: { action: string; step: string }): string;
  /**
   * An option's label, whatever its kind: `#done`, an added option, content, a copy (in
   * `context.copies`), an inline option or value of `context.choice`, or a written option of
   * `context.action`. A value or written option without its own text is named as `setMember`.
   */
  option(id: string | number, context?: OptionContext): string;
  band(bandSet: string, band: string): string;
  /** The bands a roll summary can still reach. */
  rollTargets(summary: RollSummary): RollTarget[];
  /**
   * "2d100, keep lowest", "4dF"; flat items are left out. With `repeat` (a dice pause's), the
   * roll made more than once: "2d6, rolled twice, keep the lower total".
   */
  dice(items: readonly DiceLike[], repeat?: Repeat): string;
  /** The whole roll: the dice, then the flat items' sum, "2d10 + 25"; `repeat` as for `dice`. */
  roll(items: readonly DiceLike[], repeat?: Repeat): string;
  value(type: string, name: string, value: string, of?: 'fields' | 'state'): string;
  /** The item's own state value names first, else its `type`'s. */
  stateValue(item: string, key: string, value: string, type?: string): string;
  /** A choice with its own `label` key: use `lookup`. */
  situational(id: string): string;
  situationalValue(id: string, value: string): string;
  /**
   * Markdown: the item's own block, else its type's, filled from the item, the copy and the
   * type's field defaults. A template has only its own block. `undefined` when none formats.
   */
  contentBlock(item: BlockItem, copy?: BlockCopy, type?: BlockType): string | undefined;
  /** Markdown: the block and the description, either alone; `undefined` when neither. */
  contentCard(item: BlockItem, copy?: BlockCopy, type?: BlockType): string | undefined;
  /**
   * One line of plain text from the last of the character's packs with a `headline` (homebrew
   * last). `undefined` when none has one, it doesn't format, or it words nothing yet.
   */
  headline(
    sheet: HeadlineSheet,
    character?: HeadlineCharacter,
    options?: HeadlineOptions,
  ): string | undefined;
  /** The pack's own text, else the spec's; an engine error words as the error, else `errors.other`. */
  issue(issue: RulesIssue | EngineError): string;
  /**
   * The spec's text, by the variant its data picks (`errors.out-of-range.min`,
   * `errors.safety-limit-exceeded.<limit>`); a code without text, or whose text misses an
   * argument, as `errors.other`.
   */
  error(error: EngineError | RulesIssue): string;
}

type Found = { message: string; language: string };

const empty: Messages = {};

/** Builds a text bundle for a language order from pack text and the spec's standard text. */
export function createText(options: TextOptions): Text {
  const languages = [...options.languages];
  const locale = languages[0] ?? 'en';
  const order = (byLanguage: Readonly<Record<string, unknown>>): string[] => [
    ...languages,
    ...Object.keys(byLanguage).filter((l) => !languages.includes(l)),
  ];
  const packOrder = order(options.packs);
  const specOrder = order(options.spec);
  const cache = new Map<string, IntlMessageFormat>();

  const findPack = (pack: string, key: string): Found | undefined => {
    for (const language of packOrder) {
      const message = (options.packs[language]?.[pack] ?? empty)[key];
      if (message !== undefined) return { message, language };
    }
    return undefined;
  };
  const findSpec = (key: string): Found | undefined => {
    for (const language of specOrder) {
      const message = (options.spec[language] ?? empty)[key];
      if (message !== undefined) return { message, language };
    }
    return undefined;
  };

  const format = (
    found: Found | undefined,
    args: Args = {},
    strict = false,
  ): string | undefined => {
    if (!found) return undefined;
    const id = `${found.language}\u0000${found.message}`;
    let compiled = cache.get(id);
    try {
      if (!compiled) {
        compiled = new IntlMessageFormat(found.message, found.language, undefined, {
          ignoreTag: true,
        });
        cache.set(id, compiled);
      }
      const out = compiled.format(icuArgs(args, found.language));
      return Array.isArray(out) ? out.join('') : String(out);
    } catch {
      // A message that doesn't parse, or misses an argument: show it as written.
      return strict ? undefined : found.message;
    }
  };

  const message = (pack: string, key: string, args?: Args) => format(findPack(pack, key), args);
  const specMessage = (key: string, args?: Args) => format(findSpec(key), args);
  const unworded = (code: string) => specMessage('errors.other', { code }) ?? code;
  const lookup = (ref: MessageRef, args?: Args) =>
    ref.pack === null ? specMessage(ref.key, args) : message(ref.pack, ref.key, args);

  const content = (id: string, args?: Args) => lookup(contentKey(id), args) ?? id;
  // `<item>#<option>` a content type adds: named by the type, found through `options.content`.
  const lookupTypeOption = (option: string) => {
    const hash = option.lastIndexOf('#');
    const typeId = options.content?.[option.slice(0, hash)]?.type;
    if (typeId === undefined) return undefined;
    const [pack, local] = split(typeId);
    return message(pack, `types.${local}.options.${option.slice(hash + 1)}.name`);
  };
  const field = (id: string, opts?: { short?: boolean; name?: string | undefined }) => {
    const args = { name: opts?.name ?? '' };
    const out =
      (opts?.short ? lookup(fieldKey(id, true), args) : undefined) ?? lookup(fieldKey(id), args);
    return out === undefined ? id : out.trim() || id;
  };
  const type = (id: string) => lookup(typeKey(id)) ?? id;
  const tag = (id: string, pack?: string) => lookup(tagKey(id, pack)) ?? id;
  const setMember = (id: string, pack?: string) => {
    const qualified = id.includes(':') || !pack ? id : `${pack}:${id}`;
    return (
      lookup(contentKey(qualified)) ?? lookup(fieldKey(qualified)) ?? lookup(tagKey(id, pack)) ?? id
    );
  };
  const action = (id: string) => lookup(actionKey(id)) ?? id;
  const value = (typeId: string, name: string, v: string, of: 'fields' | 'state' = 'fields') =>
    lookup(valueKey(typeId, name, v, of)) ?? v;

  const blockArgs = (
    template: string,
    item: BlockItem,
    qid: string,
    typeId: string,
    copy: BlockCopy | undefined,
    typeDef: BlockType | undefined,
  ): Args | undefined => {
    const parsed = messageArguments(template);
    if (!parsed.ok) return undefined;
    const pack = split(qid)[0];
    // A template's fields are formulas over the item it's applied to: only literal numbers and
    // booleans are values of its own.
    const isTemplate = item.type === 'template';
    const itemTags = copy?.tags ?? item.tags ?? [];
    const written = (name: string): unknown => {
      const v = item.fields?.[name];
      return isTemplate && typeof v !== 'number' && typeof v !== 'boolean' ? undefined : v;
    };
    const fieldValue = (name: string): unknown =>
      copy?.fields?.[name] ?? written(name) ?? typeDef?.fields?.[name]?.default;
    const isField = (name: string) =>
      (typeDef?.fields !== undefined && Object.hasOwn(typeDef.fields, name)) ||
      fieldValue(name) !== undefined;
    const names = (v: unknown, of: 'fields' | 'state', name: string): unknown => {
      if (Array.isArray(v)) return v.map((x) => names(x, of, name));
      const own =
        v === undefined || v === null
          ? undefined
          : ((of === 'state' ? lookup(stateValueKey(qid, name, String(v))) : undefined) ??
            lookup(valueKey(typeId, name, String(v), of)));
      if (own !== undefined || typeof v !== 'string') return own ?? v;
      return setMember(v, pack);
    };
    const read = (a: BlockArgument): unknown => {
      switch (a.kind) {
        case 'name': {
          if (isTemplate) {
            // A template's name on its type's name: "Flaming Weapon".
            const applies = item.appliesTo;
            const on = Array.isArray(applies)
              ? applies[0]?.type
              : (applies as { type?: string })?.type;
            const base = on ? type(on.includes(':') || !pack ? on : `${pack}:${on}`) : '';
            return content(qid, { base });
          }
          return copy?.templates
            ? text.copy({ item: qid, templates: copy.templates })
            : content(qid);
        }
        case 'tags':
          return a.names ? itemTags.map((t) => tag(t, pack)) : itemTags;
        case 'text':
          return lookup(contentKey(qid, `texts.${a.text}`));
        case 'self': {
          const v = copy?.computed?.[a.key] ?? copy?.state?.[a.key];
          return a.names ? names(v, 'state', a.key) : v;
        }
        case 'field': {
          const v = fieldValue(a.field);
          return a.names ? names(v, 'fields', a.field) : v;
        }
        case 'tag':
          return holdsTag(itemTags, a.spelled);
        case 'has': {
          const v = read(a.of);
          return !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length));
        }
      }
    };
    const out: Record<string, unknown> = {};
    for (const arg of parsed.args) {
      const a = blockArgument(arg, isField);
      const v = a ? read(a) : undefined;
      out[arg] = v === undefined || v === null ? '' : v;
    }
    return out;
  };

  const contentBlock = (item: BlockItem, copy?: BlockCopy, typeDef?: BlockType) => {
    const qid = item.id.includes(':') || !item.pack ? item.id : `${item.pack}:${item.id}`;
    const typeId = item.type.includes(':') || !item.pack ? item.type : `${item.pack}:${item.type}`;
    const ownRef = blockKey(qid);
    const typeRef = item.type === 'template' ? undefined : typeBlockKey(typeId);
    const found =
      (ownRef.pack ? findPack(ownRef.pack, ownRef.key) : undefined) ??
      (typeRef?.pack ? findPack(typeRef.pack, typeRef.key) : undefined);
    if (!found) return undefined;
    const decl = typeDef ?? options.contentTypes?.[typeId];
    const args = blockArgs(found.message, item, qid, typeId, copy, decl);
    const out = args && format(found, args, true)?.trim();
    return out || undefined;
  };

  const valueNames = (v: unknown, fieldPack: string): unknown =>
    Array.isArray(v)
      ? v.map((x) => valueNames(x, fieldPack))
      : typeof v === 'string' && v !== ''
        ? setMember(v, fieldPack)
        : v;

  const numberText = (n: number) => new Intl.NumberFormat(locale).format(n);
  const formatted = (n: number, style: unknown): string => {
    if (style === 'signed') return n > 0 ? `+${numberText(n)}` : numberText(n);
    if (style === 'percent') return `${numberText(n)}%`;
    if (style === 'fraction') {
      const whole = Math.trunc(n);
      const rest = Math.abs(n - whole);
      if (rest < 1e-9) return numberText(whole);
      for (const d of [2, 3, 4, 5, 6, 8, 10, 12, 16]) {
        const num = Math.round(rest * d);
        if (Math.abs(rest * d - num) < 1e-6)
          return whole === 0
            ? `${n < 0 ? '-' : ''}${num}/${d}`
            : `${numberText(whole)} ${num}/${d}`;
      }
    }
    return numberText(n);
  };

  const headline: Text['headline'] = (sheet, character, opts = {}) => {
    // The packs in the character's order, homebrew last; without a character, the packs whose
    // fields the sheet has.
    const sequence = character?.packs
      ? [...character.packs.map((p) => p.id), ...(character.homebrew ? ['homebrew'] : [])]
      : [...new Set(Object.keys(sheet.values).map((id) => split(id)[0]))];
    const pack = sequence.findLast((p) => findPack(p, 'headline') !== undefined);
    if (pack === undefined) return undefined;
    const found = findPack(pack, 'headline')!;
    const parsed = messageArguments(found.message);
    if (!parsed.ok) return undefined;
    const rank = (qid: string) => {
      const p = split(qid)[0];
      return p === pack ? -1 : sequence.includes(p) ? sequence.indexOf(p) : sequence.length;
    };
    const nearest = (ids: string[]) => ids.toSorted((a, b) => rank(a) - rank(b))[0];

    const fieldIds = Object.keys(sheet.values);
    const fieldOf = (spelled: string) =>
      nearest(fieldIds.filter((id) => spellTag(split(id)[1]) === spelled));
    const items = options.content ?? {};
    const typeIds = options.contentTypes
      ? Object.keys(options.contentTypes)
      : [...new Set(Object.values(items).flatMap((i) => (i.type ? [i.type] : [])))];
    const typeOf = (name: string) => nearest(typeIds.filter((id) => split(id)[1] === name));
    const copies = new Map(
      [...(character?.features ?? []), ...(character?.inventory ?? [])].map((c) => [c.id, c]),
    );
    const separator = findPack(pack, 'headline.separator');
    const join = (list: readonly string[]) =>
      separator
        ? list.join(format(separator) ?? separator.message)
        : new Intl.ListFormat(found.language, { type: 'unit' }).format(list);

    const members = (name: string) => {
      const qid = typeOf(name);
      return (sheet.activations ?? []).filter((a) => {
        const t = items[a.item]?.type;
        return a.scope !== 'applied' && qid !== undefined && t === qid;
      });
    };
    const memberName = (a: { item: string; entry?: string; via: string }) => {
      const copy = a.via === 'copy' && a.entry !== undefined ? copies.get(a.entry) : undefined;
      return copy?.templates?.length
        ? text.copy({ item: a.item, templates: copy.templates })
        : content(a.item);
    };
    /** By its own `<id>.headline`, else its type's, with a block's arguments; else its name. */
    const memberLine = (a: { item: string; entry?: string; via: string }) => {
      const item = items[a.item];
      const typeId = item?.type;
      const ownRef = contentKey(a.item, 'headline');
      const piece =
        (ownRef.pack ? findPack(ownRef.pack, ownRef.key) : undefined) ??
        (typeId ? findPack(split(typeId)[0], `types.${split(typeId)[1]}.headline`) : undefined);
      if (!item || !typeId || !piece) return memberName(a);
      const own = a.via === 'copy' && a.entry !== undefined ? copies.get(a.entry) : undefined;
      const copy: BlockCopy | undefined = own && {
        ...(own.templates ? { templates: own.templates } : {}),
        ...(own.fields ? { fields: own.fields } : {}),
        ...(own.state ? { state: own.state } : {}),
        ...(sheet.copies?.[own.id] ? { computed: sheet.copies[own.id] } : {}),
      };
      const blockItem: BlockItem = {
        id: a.item,
        type: typeId,
        ...(item.fields ? { fields: item.fields } : {}),
        ...(item.tags ? { tags: item.tags } : {}),
      };
      const args = blockArgs(
        piece.message,
        blockItem,
        a.item,
        typeId,
        copy,
        options.contentTypes?.[typeId],
      );
      return (args && format(piece, args, true)?.trim()) || memberName(a);
    };
    const shown = (v: unknown, qid: string): unknown => {
      if (Array.isArray(v)) return v.map((x) => shown(x, qid));
      if (typeof v !== 'number') return valueNames(v, split(qid)[0]);
      const hint = options.display?.fields?.[qid];
      const out = formatted(v, hint?.format);
      const unit = hint?.unit
        ? lookup({ pack: hint.pack ?? split(qid)[0], key: `units.${hint.unit}.short` })
        : undefined;
      return unit ? `${out} ${unit}` : out;
    };

    const scope = {
      field: (s: string) => !!fieldOf(s),
      type: (n: string) => !!typeOf(n),
      link: () => true,
    };
    const read = (a: HeadlineArgument): unknown => {
      switch (a.kind) {
        case 'field': {
          const qid = fieldOf(a.spelled)!;
          const v = sheet.values[qid]?.value;
          return a.as === 'name'
            ? valueNames(v, split(qid)[0])
            : a.as === 'text'
              ? shown(v, qid)
              : v;
        }
        case 'type': {
          const list = members(a.type);
          if (a.as === 'count') return list.length;
          return list.map(a.as === 'each' ? memberLine : memberName);
        }
        case 'link': {
          const names = opts.links ?? {};
          const key = Object.keys(names).find((k) => k === a.slot || split(k)[1] === a.slot);
          return key === undefined ? undefined : names[key];
        }
        case 'has': {
          const v = read(a.of);
          return !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length));
        }
      }
    };
    const args: Record<string, unknown> = {};
    for (const arg of parsed.args) {
      const a = headlineArgument(arg, scope);
      const v = a ? read(a) : undefined;
      args[arg] = v === undefined || v === null ? '' : Array.isArray(v) ? join(v.map(String)) : v;
    }
    const out = format(found, args, true)?.replace(/\s+/g, ' ').trim();
    return out || undefined;
  };

  const named = (data: Args = {}): Args =>
    Object.fromEntries(
      Object.entries(data).map(([k, v]) => {
        if (typeof v !== 'string' || !v.includes(':')) return [k, v];
        return [k, lookup(contentKey(v)) ?? lookup(fieldKey(v)) ?? lookup(typeKey(v)) ?? v];
      }),
    );

  // The spec's text for a code, by the variant its data picks; text that misses an argument is
  // `errors.other`, never the raw template.
  const standard = (
    error: EngineError | RulesIssue,
    first: 'errors' | 'issues',
    second: 'errors' | 'issues',
  ): string => {
    const data: Args = error.data ?? {};
    const args = named(data);
    const keys = [
      ...variants(error.code, data).map((v) => `errors.${error.code}.${v}`),
      `${first}.${error.code}`,
      `${second}.${error.code}`,
    ];
    for (const key of keys) {
      const found = findSpec(key);
      if (!found) continue;
      const out = format(found, args, true);
      if (out !== undefined) return out;
    }
    return unworded(error.code);
  };

  const text: Text = {
    languages,
    message,
    specMessage,
    lookup,
    pack: (id) => lookup(packKey(id)) ?? id,
    content,
    copy(copy) {
      if (copy.name?.trim()) return copy.name;
      let name = content(copy.item);
      for (const template of copy.templates ?? []) name = content(template, { base: name });
      return name;
    },
    field,
    fieldValue: (id, v) => lookup(fieldValueKey(id, v)) ?? v,
    param: (actionId, param) => lookup(paramKey(actionId, param)) ?? param,
    paramDescription: (actionId, param) => lookup(paramKey(actionId, param, 'description')),
    paramValue: (actionId, param, v) => lookup(paramValueKey(actionId, param, v)) ?? v,
    stateValue: (item, key, v, typeId) =>
      lookup(stateValueKey(item, key, v)) ??
      (typeId ? lookup(valueKey(typeId, key, v, 'state')) : undefined) ??
      v,
    situational: (id) => lookup(situationalKey(id)) ?? id,
    situationalValue: (id, v) => lookup(situationalValueKey(id, v)) ?? v,
    type,
    typeField: (typeId, name) => lookup(typeFieldKey(typeId, name)) ?? name,
    typeFieldDescription: (typeId, name) => lookup(typeFieldKey(typeId, name, 'description')),
    templateField: (id) => lookup(templateFieldKey(id)) ?? split(id)[1],
    templateFieldDescription: (id) => lookup(templateFieldKey(id, 'description')),
    tag,
    setMember,
    action,
    choicePrompt(choice) {
      const ref = choicePromptKey(choice);
      return lookup(ref, choice.slot ? { slot: choice.slot.number } : {}) ?? choice.id;
    },
    stepPrompt: (need) => lookup(stepKey(need)) ?? action(need.action),
    stepName: (need) => lookup(stepKey(need, 'name')) ?? action(need.action),
    option(id, context = {}) {
      const option = String(id);
      if (option === '#done')
        return (context.choice ? lookup(donePendingKey) : undefined) ?? lookup(doneKey) ?? option;
      if (option.includes('#'))
        return lookup(addedOptionKey(option)) ?? lookupTypeOption(option) ?? option;
      const copy = context.copies?.[option];
      if (copy) return text.copy(copy);
      const isContent = context.isContent ?? ((x: string) => x.includes(':'));
      if (isContent(option)) return content(option);
      if (context.choice)
        return (
          lookup(inlineOptionKey(context.choice, id)) ??
          setMember(option, split(context.choice.owner)[0])
        );
      if (context.action)
        return (
          lookup(writtenOptionKey(context.action, option)) ??
          setMember(option, split(context.action)[0])
        );
      return option;
    },
    band: (bandSet, band) => lookup(bandKey(bandSet, band)) ?? band,
    rollTargets(summary) {
      const set = summary.bandSet;
      if (!set) return [];
      return (summary.bands ?? []).map(({ band, tests }) => {
        const args: Record<string, number> = {};
        (tests ?? []).forEach((t, i) => {
          if (i === 0) args.value = t.value;
          args[`value${i + 1}`] = t.value;
        });
        // A band that compares nothing (`tests: []`: it holds regardless of the roll) has no
        // condition text; one whose condition isn't plain comparisons (no `tests`) keeps the pack's.
        const own =
          tests !== undefined && tests.length === 0
            ? undefined
            : lookup(bandKey(set, band, 'condition'), args);
        const parts = (tests ?? []).map(
          (t) => specMessage(`compare.${t.compare}`, { value: t.value }) ?? '',
        );
        const condition =
          own ??
          (parts.length > 0
            ? new Intl.ListFormat(locale, { type: 'conjunction' }).format(parts)
            : undefined);
        return {
          band,
          name: lookup(bandKey(set, band)) ?? band,
          ...(condition === undefined ? {} : { condition }),
        };
      });
    },
    dice: (items, repeat) => diceText(items, specMessage, repeat),
    roll: (items, repeat) => diceText(items, specMessage, repeat, numberText),
    value,
    contentBlock,
    headline,
    contentCard(item, copy, typeDef) {
      const block = contentBlock(item, copy, typeDef);
      const qid = item.id.includes(':') || !item.pack ? item.id : `${item.pack}:${item.id}`;
      const description = lookup(contentKey(qid, 'description'))?.trim() || undefined;
      return block && description ? `${block}\n\n${description}` : (block ?? description);
    },
    issue(issue) {
      const data = { ...issue.data };
      const own = issueKey(issue);
      if (own) {
        // A copy limit's text takes `max` and `count`; an item's limit is `perItem`.
        const args = issue.code === 'too-many-copies' ? { ...data, max: data.limit } : data;
        const found =
          own.pack === null ? undefined : format(findPack(own.pack, own.key), args, true);
        if (found !== undefined) return found;
      }
      return standard(issue, 'issues', 'errors');
    },
    error: (error) => standard(error, 'errors', 'issues'),
  };
  return text;
}

/** The variants of a code's standard text its data picks, most specific first. */
function variants(code: string, data: Args): string[] {
  if (code === 'out-of-range') {
    const min = data.min !== undefined;
    const max = data.max !== undefined;
    return min === max ? [] : [min ? 'min' : 'max'];
  }
  if (code === 'safety-limit-exceeded' && typeof data.limit === 'string') return [data.limit];
  return [];
}

function icuArgs(args: Args, language: string): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (Array.isArray(v))
      out[k] = new Intl.ListFormat(language, { type: 'unit' }).format(v.map(String));
  }
  return out;
}

// Where each kind of engine output finds its text. Every function returns `{ pack, key }`, the
// key local to `pack`, or `{ pack: null, key }` for the spec's own text. No lookup happens here,
// so an app with its own formatter can use the keys alone.

/** Where a message lives: a pack's text, or the spec's standard text (`pack` is `null`). */
export interface MessageRef {
  pack: string | null;
  key: string;
}

/** A choice as computeSheet's `choices` and a pause's `needs.choice` name it. */
export interface ChoiceRef {
  /** The qualified key root of the choice's owner (`mothership-1e:classes.marine`, `<pack>:rules`). */
  owner: string;
  /** The choice's ID; for a slot, the slot's own (`spellbook-3`). */
  id: string;
  slot?: { choice: string; number: number };
}

export function split(qualified: string): [pack: string, local: string] {
  const i = qualified.indexOf(':');
  return i < 0 ? ['', qualified] : [qualified.slice(0, i), qualified.slice(i + 1)];
}

export const packKey = (pack: string): MessageRef => ({ pack, key: 'pack.name' });

export function contentKey(id: string, suffix = 'name'): MessageRef {
  const [pack, local] = split(id);
  return { pack, key: `${local}.${suffix}` };
}

export function fieldKey(id: string, short = false): MessageRef {
  const [pack, local] = split(id);
  return { pack, key: `fields.${local}.${short ? 'short' : 'name'}` };
}

/** A local `tag` (as a set field's members hold them) is looked up in `defaultPack`. */
export function tagKey(tag: string, defaultPack = ''): MessageRef {
  const [pack, local] = split(tag);
  return { pack: pack || defaultPack, key: `tags.${local}.name` };
}

export function fieldValueKey(id: string, value: string): MessageRef {
  const [pack, local] = split(id);
  return { pack, key: `fields.${local}.values.${value}.name` };
}

export function typeKey(id: string): MessageRef {
  const [pack, local] = split(id);
  return { pack, key: `types.${local}.name` };
}

export function actionRoot(action: string): MessageRef {
  const [pack, local] = split(action);
  const hash = local.indexOf('#');
  return {
    pack,
    key: hash < 0 ? `actions.${local}` : `${local.slice(0, hash)}.actions.${local.slice(hash + 1)}`,
  };
}

/** A parameter with its own `label` key is named by that key instead. */
export function paramKey(
  action: string,
  param: string,
  suffix: 'name' | 'description' = 'name',
): MessageRef {
  const root = actionRoot(action);
  return { pack: root.pack, key: `${root.key}.params.${param}.${suffix}` };
}

export function paramValueKey(action: string, param: string, value: string): MessageRef {
  const root = actionRoot(action);
  return { pack: root.pack, key: `${root.key}.params.${param}.values.${value}.name` };
}

export function actionKey(action: string): MessageRef {
  const root = actionRoot(action);
  return { pack: root.pack, key: `${root.key}.name` };
}

export function stepId(step: string): string {
  const last = step.slice(step.lastIndexOf('/') + 1);
  return last.replace(/\[\d+\]$/, '');
}

export function stepKey(
  need: { action: string; step: string },
  suffix: 'prompt' | 'name' = 'prompt',
): MessageRef {
  const root = actionRoot(need.action);
  return { pack: root.pack, key: `${root.key}.steps.${stepId(need.step)}.${suffix}` };
}

export function writtenOptionKey(action: string, option: string): MessageRef {
  const root = actionRoot(action);
  return { pack: root.pack, key: `${root.key}.options.${option}.name` };
}

export function addedOptionKey(option: string): MessageRef {
  const hash = option.lastIndexOf('#');
  const [pack, local] = split(option.slice(0, hash));
  return { pack, key: `${local}.options.${option.slice(hash + 1)}.name` };
}

export const doneKey: MessageRef = { pack: null, key: 'actions.options.done.name' };

/** `#done` over pending choices ("Skip the rest"): ends the whole step. */
export const donePendingKey: MessageRef = { pack: null, key: 'actions.options.done.pending.name' };

/** Built from the choice's owner, never its path; a slot uses the declared choice's ID. */
export function choicePromptKey(choice: ChoiceRef): MessageRef {
  const [pack, owner] = split(choice.owner);
  return { pack, key: `${owner}.choices.${choice.slot?.choice ?? choice.id}.prompt` };
}

export function inlineOptionKey(choice: ChoiceRef, option: string | number): MessageRef {
  const [pack, owner] = split(choice.owner);
  return {
    pack,
    key: `${owner}.choices.${choice.slot?.choice ?? choice.id}.options.${option}.name`,
  };
}

export function bandKey(
  bandSet: string,
  band: string,
  suffix: 'name' | 'condition' = 'name',
): MessageRef {
  const [pack, set] = split(bandSet);
  return { pack, key: `bands.${set}.${band}.${suffix}` };
}

/**
 * A prerequisite's owner, from the issue's `<owner>/<prerequisite>` ID: content, or an inline option
 * (`<item>/<choice>/<option>`), whose key root is `<item>.choices.<choice>.options.<option>`.
 */
export function prerequisiteOwner(
  id: string,
): { pack: string; root: string; inline: boolean } | undefined {
  const [pack, local] = split(id);
  const parts = local.split('/');
  if (parts.length < 2) return undefined;
  const [item, ...path] = parts.slice(0, -1);
  let root = item as string;
  for (let i = 0; i + 1 < path.length; i += 2)
    root += `.choices.${path[i] as string}.options.${path[i + 1] as string}`;
  return { pack, root, inline: path.length > 0 };
}

/** A rules issue's own key in its pack, or `undefined` when the spec's `issues.<code>` applies. */
export function issueKey(issue: { code: string; id?: string }): MessageRef | undefined {
  if (!issue.id) return undefined;
  const [pack, local] = split(issue.id);
  switch (issue.code) {
    case 'prerequisite-not-met': {
      const owner = prerequisiteOwner(issue.id);
      if (!owner) return undefined;
      return {
        pack,
        key: `${owner.root}.prerequisites.${local.slice(local.lastIndexOf('/') + 1)}`,
      };
    }
    case 'constraint-failed':
      return { pack, key: `constraints.${local}` };
    case 'too-many-copies':
      return { pack, key: `types.${local}.copies` };
    default:
      return undefined;
  }
}

export function blockKey(id: string): MessageRef {
  return contentKey(id, 'block');
}

export function typeBlockKey(type: string): MessageRef {
  const [pack, local] = split(type);
  return { pack, key: `types.${local}.block` };
}

export function valueKey(
  type: string,
  name: string,
  value: string,
  of: 'fields' | 'state' = 'fields',
): MessageRef {
  const [pack, local] = split(type);
  return { pack, key: `types.${local}.${of}.${name}.values.${value}.name` };
}

export function stateValueKey(id: string, key: string, value: string): MessageRef {
  return contentKey(id, `state.${key}.values.${value}.name`);
}

export function situationalKey(id: string): MessageRef {
  const [pack, local] = split(id);
  return { pack, key: `situational.${local}.name` };
}

export function situationalValueKey(id: string, value: string): MessageRef {
  const [pack, local] = split(id);
  return { pack, key: `situational.${local}.values.${value}.name` };
}

export function typeFieldKey(
  type: string,
  field: string,
  suffix: 'name' | 'description' = 'name',
): MessageRef {
  const [pack, local] = split(type);
  return { pack, key: `types.${local}.fields.${field}.${suffix}` };
}

export function templateFieldKey(id: string, suffix: 'name' | 'description' = 'name'): MessageRef {
  const [pack, name] = split(id);
  return { pack, key: `templateFields.${name}.${suffix}` };
}

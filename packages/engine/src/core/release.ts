import type { ContentItem, I18nDoc, PackManifest, RulesDoc, UpgradeDoc } from './pack-types.ts';

/** A pack's source documents, as read from its folder (pack.yaml, rules/, content/, i18n/). */
export interface PackSource {
  manifest: PackManifest;
  rules: RulesDoc[];
  content: ContentItem[];
  i18n?: Record<string, I18nDoc>;
  upgrades?: UpgradeDoc[];
}

/** A pack release (packages/spec/schemas/pack-release.schema.json): one JSON document. */
export interface PackRelease {
  manifest: PackManifest;
  rules: RulesDoc;
  content: ContentItem[];
  /** Compiled formulas: source text → canonical text and parsed tree. */
  formulas?: Record<string, { text: string; tree: unknown }>;
  i18n?: Record<string, I18nDoc>;
  upgrades?: UpgradeDoc[];
}

/**
 * Merges a pack's rules documents into one, as the build does. Duplicate IDs are the build's
 * concern (`pnpm validate` rejects them); here the later document wins.
 */
export function buildRelease(source: PackSource): PackRelease {
  const rules: RulesDoc = {};
  for (const doc of source.rules) {
    // Kept for loadRuleset to expand; the build's documents come expanded already.
    if (doc.families) rules.families = { ...rules.families, ...doc.families };
    if (doc.viewFields) rules.viewFields = { ...rules.viewFields, ...doc.viewFields };
    if (doc.tags) rules.tags = [...new Set([...(rules.tags ?? []), ...doc.tags])];
    if (doc.fields) rules.fields = { ...rules.fields, ...doc.fields };
    if (doc.links) rules.links = { ...rules.links, ...doc.links };
    if (doc.contentTypes) rules.contentTypes = { ...rules.contentTypes, ...doc.contentTypes };
    if (doc.templateFields)
      rules.templateFields = { ...rules.templateFields, ...doc.templateFields };
    if (doc.settings) rules.settings = { ...rules.settings, ...doc.settings };
    if (doc.situational) rules.situational = [...(rules.situational ?? []), ...doc.situational];
    if (doc.rollTallies) rules.rollTallies = [...(rules.rollTallies ?? []), ...doc.rollTallies];
    if (doc.resultBands) rules.resultBands = { ...rules.resultBands, ...doc.resultBands };
    if (doc.actions) rules.actions = [...(rules.actions ?? []), ...doc.actions];
    if (doc.effects) rules.effects = [...(rules.effects ?? []), ...doc.effects];
    if (doc.followUps) rules.followUps = [...(rules.followUps ?? []), ...doc.followUps];
    if (doc.immuneTo) rules.immuneTo = [...(rules.immuneTo ?? []), ...doc.immuneTo];
    if (doc.standardCopies)
      rules.standardCopies = [...(rules.standardCopies ?? []), ...doc.standardCopies];
    if (doc.creation) rules.creation = [...(rules.creation ?? []), ...doc.creation];
    if (doc.choices) rules.choices = [...(rules.choices ?? []), ...doc.choices];
    if (doc.constraints) rules.constraints = [...(rules.constraints ?? []), ...doc.constraints];
    if (doc.display) {
      rules.display = {
        groups: [...(rules.display?.groups ?? []), ...(doc.display.groups ?? [])],
        fields: { ...rules.display?.fields, ...doc.display.fields },
        ...(rules.display?.types || doc.display.types
          ? { types: { ...rules.display?.types, ...doc.display.types } }
          : {}),
      };
    }
  }
  return {
    manifest: source.manifest,
    rules,
    content: source.content,
    ...(source.i18n ? { i18n: source.i18n } : {}),
    ...(source.upgrades ? { upgrades: source.upgrades } : {}),
  };
}

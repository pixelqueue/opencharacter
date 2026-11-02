import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { buildRelease } from '../../packages/engine/src/core/release.ts';
import { loadPacks } from '../../packages/engine/src/core/load.ts';
import { paths } from '../../packages/spec/src/node.ts';
import { createText, type Text } from '../../packages/text/src/text.ts';
import type { LoadedPack } from './load.ts';
import type { Reporter } from './report.ts';
import type { Ruleset } from './ruleset.ts';

/** Load errors the validator takes from the engine's own loadRuleset steps. */
const SHARED = new Set(['invalid-added-param']);

let text: Text | undefined;
/** The spec's English text, IDs left as written. */
const specText = (): Text =>
  (text ??= createText({
    languages: ['en'],
    packs: {},
    spec: { en: parse(readFileSync(join(paths.i18n, 'en.yaml'), 'utf8')) },
  }));

/** Where an error's `source` (`<pack>:<content id>`, `<pack>:types.<type>`, `<pack>:rules`) is. */
function locate(ruleset: Ruleset, source: string): string | undefined {
  const content = ruleset.content.get(source);
  if (content) return content.at;
  const [pack = '', rest = ''] = source.split(/:(.*)/s);
  const loaded = ruleset.packs.get(pack);
  if (rest.startsWith('types.'))
    return ruleset.rules.get(pack)?.contentTypes.get(rest.slice(6))?.at ?? loaded?.dir;
  if (rest === 'rules' && loaded?.rules.length === 1) return loaded.rules[0]?.file;
  return loaded ? join(loaded.dir, 'rules') : undefined;
}

/**
 * Runs the engine's load steps over every pack together (formulas aside: the pack checks cover
 * them) and reports their `invalid-added-param` errors, so `pnpm validate` matches loadRuleset
 * on that code.
 */
export function checkEngineLoad(packs: LoadedPack[], ruleset: Ruleset, reporter: Reporter): void {
  let result: ReturnType<typeof loadPacks>;
  try {
    const releases = packs.map((pack) =>
      buildRelease({
        manifest: pack.manifest,
        rules: pack.rules.map((r) => r.doc),
        content: pack.content.map((c) => c.doc),
      }),
    );
    result = loadPacks(releases, { checkFormulasOf: new Set() });
  } catch (error) {
    // Packs the other checks already reject may not load; otherwise it's the engine's failure.
    if (reporter.errors.length > 0) return;
    throw error;
  }
  if (result.ok) return;
  for (const error of result.errors) {
    if (!SHARED.has(error.code)) continue;
    const source = String((error.data as { source?: unknown } | undefined)?.source ?? '');
    reporter.error(locate(ruleset, source) ?? '', `${error.code}: ${specText().error(error)}`);
  }
}

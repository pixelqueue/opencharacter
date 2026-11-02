import { buildRelease } from '../../packages/engine/src/core/release.ts';
import { loadPacks } from '../../packages/engine/src/core/load.ts';
import type { LoadedPack } from './load.ts';
import type { Reporter } from './report.ts';
import type { Ruleset } from './ruleset.ts';

/** Load errors the validator takes from the engine's own loadRuleset steps. */
const SHARED = new Set(['invalid-added-param']);

/** Where an error's `source` (`<pack>:<content id>`, `<pack>:types.<type>`, `<pack>:rules`) is. */
function locate(ruleset: Ruleset, source: string): string | undefined {
  const content = ruleset.content.get(source);
  if (content) return content.at;
  const [pack = '', rest = ''] = source.split(/:(.*)/s);
  if (rest.startsWith('types.'))
    return (
      ruleset.rules.get(pack)?.contentTypes.get(rest.slice(6))?.at ?? ruleset.packs.get(pack)?.dir
    );
  return ruleset.packs.get(pack)?.dir;
}

function message(code: string, data: Record<string, unknown>): string {
  const { param, source, reason, action, other } = data as Record<string, string>;
  if (code !== 'invalid-added-param') return `${code}: ${JSON.stringify(data)}`;
  if (reason === 'required')
    return `${code}: the parameter "${param}" that ${source} adds to actions must be optional or have a default`;
  if (reason === 'declared')
    return `${code}: the parameter "${param}" that ${source} adds is already a parameter of ${action}`;
  return `${code}: ${source} and ${other} both add the parameter "${param}", declared differently`;
}

/**
 * Runs the engine's load steps over every pack together (formulas aside: the pack checks cover
 * them) and reports the load errors in `SHARED`, so `pnpm validate` and loadRuleset agree.
 */
export function checkEngineLoad(packs: LoadedPack[], ruleset: Ruleset, reporter: Reporter): void {
  const releases = packs.map((pack) =>
    buildRelease({
      manifest: pack.manifest,
      rules: pack.rules.map((r) => r.doc),
      content: pack.content.map((c) => c.doc),
    }),
  );
  let result: ReturnType<typeof loadPacks>;
  try {
    result = loadPacks(releases, { checkFormulasOf: new Set() });
  } catch {
    return; // A pack the schema checks already reject.
  }
  if (result.ok) return;
  for (const error of result.errors) {
    if (!SHARED.has(error.code)) continue;
    const data = (error.data ?? {}) as Record<string, unknown>;
    const at = locate(ruleset, String(data.source ?? '')) ?? '';
    reporter.error(at, message(error.code, data));
  }
}

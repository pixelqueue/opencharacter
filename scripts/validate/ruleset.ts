import { type ContentEntry as Entry, PackSet } from '../../packages/engine/src/check/index.ts';
import type { LoadedPack } from './load.ts';
import type { Reporter } from './report.ts';

export type ContentEntry = Entry<string>;

/**
 * Everything loaded from the repo, with lookups scoped to a pack and its dependencies. The
 * engine's pack set, with each definition located at its file; duplicates are reported.
 */
export class Ruleset extends PackSet<string> {
  readonly packs = new Map<string, LoadedPack>();

  constructor(packs: LoadedPack[], report: Reporter) {
    super(
      packs.map((pack) => ({
        manifest: pack.manifest,
        at: pack.dir,
        rules: pack.rules.map(({ file, doc }) => ({ doc, at: file })),
        content: pack.content.map(({ file, doc }) => ({ doc, at: file })),
      })),
      (at, message) => report.error(at, message),
    );
    for (const pack of packs) {
      if (!this.packs.has(pack.manifest.id)) this.packs.set(pack.manifest.id, pack);
    }
  }
}

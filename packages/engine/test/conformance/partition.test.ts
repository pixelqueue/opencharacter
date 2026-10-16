import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { areas, casesDir, partition } from './run.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The part each test file in this folder runs, from its `conformance('<part>')` call. */
const fileParts = readdirSync(here)
  .filter((n) => n.endsWith('.test.ts'))
  .flatMap((n) =>
    [...readFileSync(join(here, n), 'utf8').matchAll(/conformance\('([\w-]+)'\)/g)].map((m) => ({
      file: n,
      part: m[1]!,
    })),
  );

describe('the conformance split', () => {
  it('runs every case folder exactly once across the test files', () => {
    const parts = partition();
    const ran = fileParts.flatMap(({ part }) =>
      (parts.get(part) ?? []).flatMap(({ area, cases }) => cases.map((c) => `${area}/${c}`)),
    );
    // Every folder, not only those with a case.yaml: a folder without one is a dropped case.
    const folders = areas.flatMap((area) =>
      readdirSync(join(casesDir, area))
        .filter((c) => statSync(join(casesDir, area, c)).isDirectory())
        .map((c) => `${area}/${c}`),
    );
    expect(folders.length).toBeGreaterThan(1000);
    expect(ran.toSorted()).toEqual(folders.toSorted());
  });

  it('has one test file per part, named after it', () => {
    expect(fileParts.map((f) => f.file).toSorted()).toEqual(
      [...partition().keys()].map((p) => `${p}.test.ts`).toSorted(),
    );
    for (const { file, part } of fileParts) expect(file).toBe(`${part}.test.ts`);
  });

  it('covers every case area but formulas (formula-conformance runs those)', () => {
    const dirs = readdirSync(casesDir).filter((n) => statSync(join(casesDir, n)).isDirectory());
    expect(dirs.toSorted()).toEqual([...areas, 'formulas'].toSorted());
  });
});

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateRepo } from '../../../scripts/validate/index.ts';
import { handle } from '../server/api.ts';
import { EditorError, packPath, patchI18n, patchYaml } from '../server/files.ts';

const source = fileURLToPath(new URL('../../..', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'ocf-editor-'));
cpSync(join(source, 'packs'), join(root, 'packs'), {
  recursive: true,
  // `dist` and `node_modules` folders, not files whose names merely start so (`distracting-shot`).
  filter: (p) => !/\/(dist|node_modules)(\/|$)/.test(p),
});
cpSync(join(source, 'examples'), join(root, 'examples'), { recursive: true });
symlinkSync(join(source, 'node_modules'), join(root, 'node_modules'));
execFileSync('git', ['init', '-q'], { cwd: root });
execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], { cwd: root });
execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base'], {
  cwd: root,
});
afterAll(() => rmSync(root, { recursive: true, force: true }));
// The first validation parses every pack file (seconds); later ones parse only what changed.
beforeAll(() => void validateRepo(root), 30_000);

async function call(
  method: string,
  url: string,
  data?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const chunks = data === undefined ? [] : [Buffer.from(JSON.stringify(data))];
  const req = Object.assign(chunks.values(), { method, url }) as unknown as Parameters<
    typeof handle
  >[1];
  let status = 0;
  let text = '';
  const res = {
    set statusCode(v: number) {
      status = v;
    },
    setHeader() {},
    end(t: string) {
      text = t;
    },
  } as unknown as Parameters<typeof handle>[2];
  await handle(root, req, res);
  return { status, body: JSON.parse(text) };
}

const longsword = 'packs/5e/srd-5.1/content/weapons/longsword.yaml';

// Patching the 5E pack's text file parses it in full: slow on CI runners.
describe('file access', { timeout: 20_000 }, () => {
  it('refuses paths outside packs/ and non-YAML files', () => {
    expect(() => packPath(root, '../etc/passwd.yaml')).toThrow(EditorError);
    expect(() => packPath(root, 'packages/spec/package.json')).toThrow(/outside packs/);
    expect(() => packPath(root, 'packs/5e/srd-5.1/package.json')).toThrow(/not a .yaml file/);
    expect(packPath(root, longsword)).toBe(join(root, longsword));
  });

  it('patches YAML in place, keeping comments', () => {
    const path = 'packs/5e/srd-5.1/content/fighting-styles/dueling.yaml';
    const before = readFileSync(join(root, path), 'utf8');
    expect(before).toContain('# +2 damage');
    patchYaml(root, path, [{ path: ['tags'], value: ['style'] }]);
    const after = readFileSync(join(root, path), 'utf8');
    expect(after).toContain('# +2 damage');
    expect(after).toContain('tags:');
    patchYaml(root, path, [{ path: ['tags'], delete: true }]);
    expect(readFileSync(join(root, path), 'utf8')).toBe(before);
  });

  it('sets flat translation keys without treating dots as paths', () => {
    const path = 'packs/5e/srd-5.1/i18n/en.yaml';
    const before = readFileSync(join(root, path), 'utf8');
    try {
      patchI18n(root, path, { 'weapons.longsword.name': 'Long Sword' });
      const after = parseYaml(readFileSync(join(root, path), 'utf8')) as Record<string, string>;
      expect(after['weapons.longsword.name']).toBe('Long Sword');
      expect(Object.keys(after).length).toBe(Object.keys(parseYaml(before) as object).length);
    } finally {
      patchI18n(root, path, { 'weapons.longsword.name': 'Longsword' });
    }
    expect(readFileSync(join(root, path), 'utf8')).toContain('# Player-facing English text');
  });
});

// Each write re-validates the whole repo: seconds on a loaded machine.
describe('the editor API', { timeout: 20_000 }, () => {
  it('serves the spec schemas and a document with its schema', async () => {
    const schemas = await call('GET', '/api/schemas');
    expect(Object.keys(schemas.body.schemas as object)).toContain(
      'https://opencharacterformat.org/schemas/0.1/rules.schema.json',
    );
    const doc = await call('GET', '/api/doc?path=packs/5e/srd-5.1/rules/core.yaml');
    expect(doc.body).toMatchObject({
      kind: 'rules',
      schema: 'https://opencharacterformat.org/schemas/0.1/rules.schema.json',
    });
  });

  it('patches keys that contain dots (field IDs) as single keys', async () => {
    const path = 'packs/5e/srd-5.1/rules/combat.yaml';
    const set = await call('PUT', '/api/doc', {
      path,
      ops: [{ path: ['fields', 'combat.speed', 'default'], value: 25 }],
    });
    expect(
      (set.body.doc as { fields: Record<string, { default: number }> }).fields['combat.speed']
        ?.default,
    ).toBe(25);
    expect((set.body.validation as { errors: unknown[] }).errors).toEqual([]);
    await call('PUT', '/api/doc', {
      path,
      ops: [{ path: ['fields', 'combat.speed', 'default'], value: 30 }],
    });
  });

  it('lists translations with required keys, and writes them', async () => {
    const before = await call('GET', '/api/i18n?pack=5e-srd-5.1');
    const rows = before.body.rows as {
      key: string;
      required: boolean;
      values: Record<string, string | null>;
    }[];
    expect(before.body.languages).toEqual(['en']);
    expect(rows.find((r) => r.key === 'weapons.longsword.name')).toEqual({
      key: 'weapons.longsword.name',
      required: true,
      values: { en: 'Longsword' },
    });
    const after = await call('PUT', '/api/i18n', {
      pack: '5e-srd-5.1',
      language: 'de',
      entries: { 'weapons.longsword.name': 'Langschwert' },
    });
    expect(after.body.languages).toEqual(['en', 'de']);
    expect(readFileSync(join(root, 'packs/5e/srd-5.1/i18n/de.yaml'), 'utf8')).toContain(
      'Langschwert',
    );
    rmSync(join(root, 'packs/5e/srd-5.1/i18n/de.yaml'));
  });

  it('lists packs and their files', async () => {
    const { status, body } = await call('GET', '/api/tree');
    expect(status).toBe(200);
    expect((body.packs as { id: string }[]).map((p) => p.id)).toEqual([
      '5e-srd-5.1',
      'fate-core',
      'fitd-crew',
      'fitd-scoundrel',
      'mork-borg-core',
      'mothership-1e',
      'orc-2e',
    ]);
  });

  it('loads an item with its content type and translations', async () => {
    const { body } = await call('GET', `/api/item?path=${longsword}`);
    expect(body.pack).toBe('5e-srd-5.1');
    expect((body.contentType as { fields: Record<string, unknown> }).fields).toHaveProperty(
      'damage',
    );
    expect(body.i18n).toEqual({ name: 'Longsword', description: '' });
  });

  it('saves item fields and names, and re-validates', async () => {
    const { status, body } = await call('PUT', '/api/item', {
      path: longsword,
      ops: [{ path: ['fields', 'weight'], value: 4 }],
      i18n: { name: 'Longsword' },
    });
    expect(status).toBe(200);
    expect((body.item as { doc: { fields: { weight: number } } }).doc.fields.weight).toBe(4);
    expect((body.validation as { errors: unknown[] }).errors).toEqual([]);
  });

  it('reports validation errors after a bad edit', async () => {
    await call('PUT', '/api/item', {
      path: longsword,
      ops: [{ path: ['fields', 'damageType'], value: 'sparkly' }],
    });
    const { body } = await call('GET', '/api/validate');
    expect(
      (body.errors as { message: string }[]).some((e) => e.message.includes('damageType')),
    ).toBe(true);
    await call('PUT', '/api/item', {
      path: longsword,
      ops: [{ path: ['fields', 'damageType'], value: 'slashing' }],
    });
  });

  it('creates a new item with its name', async () => {
    const { status, body } = await call('POST', '/api/item', {
      pack: '5e-srd-5.1',
      type: 'weapon',
      id: 'weapons.test-blade',
      name: 'Test blade',
    });
    expect(status).toBe(201);
    expect(body.path).toBe('packs/5e/srd-5.1/content/weapons/test-blade.yaml');
    expect(
      (body.validation as { errors: { file: string }[] }).errors.some((e) =>
        e.file.endsWith('test-blade.yaml'),
      ),
    ).toBe(true);
    const again = await call('POST', '/api/item', {
      pack: '5e-srd-5.1',
      type: 'weapon',
      id: 'weapons.test-blade',
    });
    expect(again.status).toBe(409);
  });

  it('refuses writes outside packs/', async () => {
    const { status } = await call('PUT', '/api/file', { path: 'package.json.yaml', text: 'x: 1' });
    expect(status).toBe(403);
  });

  it('shows git status and diff for packs/', async () => {
    const { body } = await call('GET', '/api/git');
    const paths = (body.status as { path: string }[]).map((s) => s.path);
    expect(paths).toContain(longsword);
    expect(body.diff).toContain('weight: 4');
  });

  it('previews an example character with the current packs', async () => {
    const { body } = await call('GET', '/api/preview?character=5e-goblin.yaml');
    expect(body.ok).toBe(true);
    expect((body.values as Record<string, { value: unknown }>)['5e-srd-5.1:combat.ac']?.value).toBe(
      15,
    );
    expect(Object.keys(body.values as object).every((id) => id.startsWith('5e-srd-5.1:'))).toBe(
      true,
    );
  });
});

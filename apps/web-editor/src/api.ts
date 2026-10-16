export interface TreeNode {
  name: string;
  path?: string;
  children?: TreeNode[];
}

export interface PackInfo {
  id: string;
  dir: string;
  defaultLanguage: string;
}

export interface Finding {
  file: string;
  message: string;
}

export interface Validation {
  errors: Finding[];
  warnings: Finding[];
}

export interface ValueDecl {
  type: string;
  values?: string[];
  of?: string;
  required?: boolean;
  default?: unknown;
}

export interface ItemData {
  path: string;
  pack: string;
  doc: Record<string, unknown>;
  text: string;
  contentType: { fields?: Record<string, ValueDecl>; state?: Record<string, ValueDecl> } | null;
  contentTypes: string[];
  i18n: { name: string; description: string };
}

export interface TranslationTable {
  languages: string[];
  rows: { key: string; required: boolean; values: Record<string, string | null> }[];
}

export interface PreviewData {
  ok: boolean;
  values?: Record<string, { value?: unknown; error?: { code: string } }>;
  issues?: { code: string; id?: string }[];
  errors?: { code: string }[];
  validation: number;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `${res.status}`);
  return data;
}

const q = encodeURIComponent;

export const api = {
  tree: () => request<{ tree: TreeNode[]; packs: PackInfo[] }>('GET', '/api/tree'),
  file: (path: string) => request<{ text: string }>('GET', `/api/file?path=${q(path)}`),
  saveFile: (path: string, text: string) =>
    request<{ validation: Validation }>('PUT', '/api/file', { path, text }),
  item: (path: string) => request<ItemData>('GET', `/api/item?path=${q(path)}`),
  saveItem: (path: string, ops: unknown[], i18n: { name: string; description: string }) =>
    request<{ item: ItemData; validation: Validation }>('PUT', '/api/item', { path, ops, i18n }),
  newItem: (pack: string, type: string, id: string, name: string) =>
    request<{ path: string; validation: Validation }>('POST', '/api/item', {
      pack,
      type,
      id,
      name,
    }),
  types: (pack: string) => request<{ types: string[] }>('GET', `/api/types?pack=${q(pack)}`),
  validate: () => request<Validation>('GET', '/api/validate'),
  schemas: () =>
    request<{ schemas: Record<string, Record<string, unknown>> }>('GET', '/api/schemas'),
  doc: (path: string) =>
    request<{ kind: string; schema: string | null; doc: unknown; text: string }>(
      'GET',
      `/api/doc?path=${q(path)}`,
    ),
  saveDoc: (path: string, ops: unknown[]) =>
    request<{ doc: unknown; validation: Validation }>('PUT', '/api/doc', { path, ops }),
  translations: (pack: string) => request<TranslationTable>('GET', `/api/i18n?pack=${q(pack)}`),
  saveTranslations: (pack: string, language: string, entries: Record<string, string | null>) =>
    request<TranslationTable & { validation: Validation }>('PUT', '/api/i18n', {
      pack,
      language,
      entries,
    }),
  git: () =>
    request<{ status: { status: string; path: string }[]; diff: string }>('GET', '/api/git'),
  characters: () => request<{ characters: string[] }>('GET', '/api/characters'),
  preview: (character: string) =>
    request<PreviewData>('GET', `/api/preview?character=${q(character)}`),
};

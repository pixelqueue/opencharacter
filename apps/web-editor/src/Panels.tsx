import { useEffect, useState } from 'react';
import { api, type PreviewData, type Validation } from './api.ts';

export function Findings({
  validation,
  path,
  onOpen,
}: {
  validation: Validation;
  path?: string | undefined;
  onOpen: (p: string) => void;
}) {
  const here = (f: { file: string }) => path !== undefined && f.file === path;
  const errors = [...validation.errors.filter(here), ...validation.errors.filter((f) => !here(f))];
  return (
    <section className="card">
      <h3>
        Validation{' '}
        <span className={validation.errors.length ? 'error' : 'ok'}>
          {validation.errors.length} error(s), {validation.warnings.length} warning(s)
        </span>
      </h3>
      <ul className="findings">
        {errors.slice(0, 50).map((f, i) => (
          <li key={`${f.file}${i}`} className={here(f) ? 'current' : ''}>
            <button
              type="button"
              className="link"
              onClick={() => f.file.startsWith('packs/') && onOpen(f.file)}
            >
              {f.file.split('/').slice(-2).join('/')}
            </button>{' '}
            {f.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Preview({ revision }: { revision: number }) {
  const [characters, setCharacters] = useState<string[]>([]);
  const [character, setCharacter] = useState('');
  const [filter, setFilter] = useState('');
  const [data, setData] = useState<PreviewData | undefined>();

  useEffect(() => {
    void api.characters().then((c) => {
      setCharacters(c.characters);
      setCharacter((current) => current || (c.characters[0] ?? ''));
    });
  }, []);
  useEffect(() => {
    if (character) void api.preview(character).then(setData, () => setData(undefined));
  }, [character, revision]);

  const rows = Object.entries(data?.values ?? {}).filter(([id]) => id.includes(filter));
  return (
    <section className="card">
      <h3>Preview</h3>
      <select value={character} onChange={(e) => setCharacter(e.target.value)}>
        {characters.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      {data && !data.ok && (
        <p className="error">The packs don't load; fix validation errors first.</p>
      )}
      {data?.ok && (
        <>
          <input
            placeholder="filter fields"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <table>
            <tbody>
              {rows.slice(0, 40).map(([id, v]) => (
                <tr key={id}>
                  <td className="muted">{id.split(':')[1]}</td>
                  <td>
                    {v.error ? (
                      <span className="error">{v.error.code}</span>
                    ) : (
                      JSON.stringify(v.value)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data.issues ?? []).length > 0 && (
            <p className="muted">Issues: {(data.issues ?? []).map((i) => i.code).join(', ')}</p>
          )}
        </>
      )}
    </section>
  );
}

export function GitPanel({ revision, onOpen }: { revision: number; onOpen: (p: string) => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.git>> | undefined>();
  const [showDiff, setShowDiff] = useState(false);
  useEffect(() => {
    void api.git().then(setData);
  }, [revision]);
  return (
    <section className="card">
      <h3>Changes (git)</h3>
      {data?.status.length === 0 && <p className="muted">No uncommitted changes under packs/.</p>}
      <ul className="findings">
        {data?.status.map((s) => (
          <li key={s.path}>
            <code>{s.status}</code>{' '}
            <button type="button" className="link" onClick={() => onOpen(s.path)}>
              {s.path.replace(/^packs\//, '')}
            </button>
          </li>
        ))}
      </ul>
      {data?.diff && (
        <>
          <button type="button" onClick={() => setShowDiff(!showDiff)}>
            {showDiff ? 'Hide' : 'Show'} diff
          </button>
          {showDiff && <pre className="code diff">{data.diff}</pre>}
        </>
      )}
      <p className="muted">Commit with `git commit -s` when you're happy.</p>
    </section>
  );
}

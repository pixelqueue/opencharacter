import { useEffect, useState } from 'react';
import { api, type Validation } from './api.ts';

interface Row {
  key: string;
  required: boolean;
  values: Record<string, string | null>;
}

/** A pack's translations as a table: one row per key, one column per language. */
export function Translations({
  pack,
  onSaved,
}: {
  pack: string;
  onSaved: (v: Validation) => void;
}) {
  const [languages, setLanguages] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [filter, setFilter] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [newLanguage, setNewLanguage] = useState('');
  const [status, setStatus] = useState('');

  const load = (data: { languages: string[]; rows: Row[] }) => {
    setLanguages(data.languages);
    setRows(data.rows);
    setEdits({});
  };
  useEffect(() => {
    void api.translations(pack).then(load);
  }, [pack]);

  const value = (row: Row, language: string) =>
    edits[language]?.[row.key] ?? row.values[language] ?? '';
  const missing = (row: Row, language: string) =>
    !value(row, language) && (row.required || languages.indexOf(language) > 0);
  const shown = rows.filter(
    (r) => r.key.includes(filter) && (!missingOnly || languages.some((l) => missing(r, l))),
  );
  const changes = Object.values(edits).reduce((n, e) => n + Object.keys(e).length, 0);

  return (
    <div className="card">
      <h2>
        Translations <span className="muted">{pack}</span>
      </h2>
      <div className="row">
        <input
          placeholder="filter keys"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
          />{' '}
          missing only
        </label>
        <input
          placeholder="add language (de, pt-BR)"
          value={newLanguage}
          onChange={(e) => setNewLanguage(e.target.value)}
        />
        <button
          type="button"
          disabled={
            !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(newLanguage) || languages.includes(newLanguage)
          }
          onClick={() => {
            setLanguages([...languages, newLanguage]);
            setNewLanguage('');
          }}
        >
          Add column
        </button>
      </div>
      <table className="translations">
        <thead>
          <tr>
            <th>key</th>
            {languages.map((l, i) => (
              <th key={l}>
                {l}
                {i === 0 && <span className="muted"> (default)</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.key}>
              <td className="code">
                {row.key}
                {row.required && <span className="muted"> *</span>}
              </td>
              {languages.map((l) => (
                <td key={l} className={missing(row, l) ? 'missing' : ''}>
                  <input
                    value={value(row, l)}
                    onChange={(e) =>
                      setEdits({ ...edits, [l]: { ...edits[l], [row.key]: e.target.value } })
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        * required by the pack (the validator reports these when missing in the default language).
        Cleared cells are removed.
      </p>
      <div className="row">
        <button
          type="button"
          disabled={changes === 0}
          onClick={async () => {
            try {
              let validation: Validation | undefined;
              let latest: { languages: string[]; rows: Row[] } | undefined;
              for (const [language, entries] of Object.entries(edits)) {
                const r = await api.saveTranslations(
                  pack,
                  language,
                  Object.fromEntries(
                    Object.entries(entries).map(([k, v]) => [k, v === '' ? null : v]),
                  ),
                );
                validation = r.validation;
                latest = r;
              }
              if (latest) load(latest);
              if (validation) onSaved(validation);
              setStatus('Saved and validated.');
            } catch (err) {
              setStatus((err as Error).message);
            }
          }}
        >
          Save {changes > 0 ? `${changes} change(s)` : ''}
        </button>
        <span className="muted">{status}</span>
      </div>
    </div>
  );
}

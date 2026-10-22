import { useEffect, useState } from 'react';
import { parseDocument } from 'yaml';
import { api, type ItemData, type ValueDecl, type Validation } from './api.ts';
import { checkFormula, controlFor, toInput, toValue } from './model.ts';
import { diff, Registry, type Op } from './schema.ts';
import { SchemaForm } from './SchemaForm.tsx';

let registry: Promise<Registry> | undefined;

function useRegistry(): Registry | undefined {
  const [reg, setReg] = useState<Registry | undefined>();
  useEffect(() => {
    registry ??= api.schemas().then((r) => new Registry(r.schemas));
    void registry.then(setReg);
  }, []);
  return reg;
}

function Tabs({ tab, setTab }: { tab: 'form' | 'yaml'; setTab: (t: 'form' | 'yaml') => void }) {
  return (
    <div className="tabs">
      <button
        type="button"
        className={tab === 'form' ? 'active' : ''}
        onClick={() => setTab('form')}
      >
        Form
      </button>
      <button
        type="button"
        className={tab === 'yaml' ? 'active' : ''}
        onClick={() => setTab('yaml')}
      >
        YAML
      </button>
    </div>
  );
}

export function RawEditor({
  path,
  onSaved,
  title = true,
}: {
  path: string;
  onSaved: (v: Validation) => void;
  title?: boolean;
}) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    void api.file(path).then((f) => setText(f.text));
  }, [path]);
  const parseError = parseDocument(text).errors[0]?.message;
  return (
    <div className="card">
      {title && <h2>{path}</h2>}
      <textarea
        className="code"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      {parseError && <p className="error">YAML: {parseError}</p>}
      <div className="row">
        <button
          type="button"
          disabled={Boolean(parseError)}
          onClick={async () => {
            try {
              const r = await api.saveFile(path, text);
              onSaved(r.validation);
              setText((await api.file(path)).text);
              setStatus('Saved and validated.');
            } catch (err) {
              setStatus((err as Error).message);
            }
          }}
        >
          Save
        </button>
        <span className="muted">{status}</span>
      </div>
    </div>
  );
}

/** Rules files, pack.yaml and upgrade scripts: a form generated from the file's JSON Schema. */
export function DocEditor({ path, onSaved }: { path: string; onSaved: (v: Validation) => void }) {
  const reg = useRegistry();
  const [tab, setTab] = useState<'form' | 'yaml'>('form');
  const [saved, setSaved] = useState<unknown>();
  const [value, setValue] = useState<unknown>();
  const [schema, setSchema] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const load = () =>
    api.doc(path).then((d) => {
      setSaved(d.doc);
      setValue(d.doc);
      setSchema(d.schema);
    });
  useEffect(() => {
    void load();
  }, [path]);
  const ops: Op[] = diff(saved, value);
  return (
    <div className="card">
      <h2>{path}</h2>
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'yaml' ? (
        <RawEditor path={path} title={false} onSaved={(v) => (onSaved(v), void load())} />
      ) : !reg || !schema ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <SchemaForm reg={reg} at={reg.doc(schema)} value={value} onChange={setValue} />
          <div className="row">
            <button
              type="button"
              disabled={ops.length === 0}
              onClick={async () => {
                try {
                  const r = await api.saveDoc(path, ops);
                  setSaved(r.doc);
                  setValue(r.doc);
                  onSaved(r.validation);
                  setStatus('Saved and validated.');
                } catch (err) {
                  setStatus((err as Error).message);
                }
              }}
            >
              Save {ops.length > 0 ? `${ops.length} change(s)` : ''}
            </button>
            <span className="muted">{status}</span>
          </div>
        </>
      )}
    </div>
  );
}

/** The item form's own fields; everything else on an item comes from the content-item schema. */
const OWN = new Set(['id', 'type', 'tags', 'fields', 'override']);
const ITEM_SCHEMA = 'https://opencharacterformat.org/schemas/0.2/content-item.schema.json';

export function ItemEditor({ path, onSaved }: { path: string; onSaved: (v: Validation) => void }) {
  const reg = useRegistry();
  const [item, setItem] = useState<ItemData | undefined>();
  const [tab, setTab] = useState<'form' | 'yaml'>('form');
  const [inputs, setInputs] = useState<Record<string, string | boolean>>({});
  const [tags, setTags] = useState('');
  const [names, setNames] = useState({ name: '', description: '' });
  const [rest, setRest] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState('');

  const load = (data: ItemData) => {
    setItem(data);
    const fields = (data.doc.fields ?? {}) as Record<string, unknown>;
    const next: Record<string, string | boolean> = {};
    for (const [key, decl] of Object.entries(data.contentType?.fields ?? {})) {
      next[key] = controlFor(decl) === 'checkbox' ? fields[key] === true : toInput(fields[key]);
    }
    setInputs(next);
    setTags(toInput(data.doc.tags));
    setNames(data.i18n);
    setRest(Object.fromEntries(Object.entries(data.doc).filter(([k]) => !OWN.has(k))));
  };
  useEffect(() => {
    void api.item(path).then(load);
  }, [path]);

  if (!item) return <p className="muted">Loading…</p>;
  const decls = item.contentType?.fields ?? {};
  const undeclared = Object.keys((item.doc.fields ?? {}) as object).filter((k) => !(k in decls));
  const before = Object.fromEntries(Object.entries(item.doc).filter(([k]) => !OWN.has(k)));

  const save = async () => {
    const ops: Op[] = [];
    const tagValue = toValue({ type: 'set' }, tags);
    if (JSON.stringify(tagValue ?? undefined) !== JSON.stringify(item.doc.tags)) {
      ops.push(
        tagValue === null ? { path: ['tags'], delete: true } : { path: ['tags'], value: tagValue },
      );
    }
    const fields = (item.doc.fields ?? {}) as Record<string, unknown>;
    for (const [key, decl] of Object.entries(decls)) {
      const v = toValue(decl, inputs[key] ?? '');
      if (JSON.stringify(v ?? undefined) === JSON.stringify(fields[key])) continue;
      ops.push(
        v === null ? { path: ['fields', key], delete: true } : { path: ['fields', key], value: v },
      );
    }
    for (const op of diff(before, rest)) ops.push(op);
    try {
      const r = await api.saveItem(path, ops, names);
      load(r.item);
      onSaved(r.validation);
      setStatus('Saved and validated.');
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  return (
    <div className="card">
      <h2>
        {item.doc.id as string}{' '}
        <span className="muted">
          {item.doc.type as string} · {item.pack}
        </span>
      </h2>
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'yaml' ? (
        <RawEditor
          path={path}
          title={false}
          onSaved={(v) => (onSaved(v), void api.item(path).then(load))}
        />
      ) : (
        <>
          <label>
            Name
            <input
              value={names.name}
              onChange={(e) => setNames({ ...names, name: e.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              value={names.description}
              onChange={(e) => setNames({ ...names, description: e.target.value })}
            />
          </label>
          <label>
            Tags{' '}
            <span className="muted">(comma-separated; must be declared in the pack's rules)</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
          {item.contentType === null && item.doc.type !== 'template' && (
            <p className="error">Unknown content type: fields can only be edited as YAML.</p>
          )}
          {Object.entries(decls).map(([key, decl]) => (
            <FieldInput
              key={key}
              name={key}
              decl={decl}
              value={inputs[key] ?? ''}
              onChange={(v) => setInputs({ ...inputs, [key]: v })}
            />
          ))}
          {undeclared.length > 0 && (
            <p className="error">
              Fields not declared by the content type: {undeclared.join(', ')} (edit as YAML).
            </p>
          )}
          <h3>Effects, actions, choices and more</h3>
          {reg ? (
            <SchemaForm
              reg={reg}
              at={reg.doc(ITEM_SCHEMA)}
              value={rest}
              onChange={(v) => setRest(v as Record<string, unknown>)}
              omit={OWN}
            />
          ) : (
            <p className="muted">Loading…</p>
          )}
          <div className="row">
            <button type="button" onClick={save}>
              Save
            </button>
            <span className="muted">{status}</span>
          </div>
        </>
      )}
    </div>
  );
}

function FieldInput({
  name,
  decl,
  value,
  onChange,
}: {
  name: string;
  decl: ValueDecl;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  const control = controlFor(decl);
  const label = (
    <>
      {name}{' '}
      <span className="muted">
        {decl.type}
        {decl.of ? ` of ${decl.of}` : ''}
        {decl.required ? ' · required' : ''}
      </span>
    </>
  );
  if (control === 'checkbox') {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />{' '}
        {label}
      </label>
    );
  }
  if (control === 'select') {
    return (
      <label>
        {label}
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">(none)</option>
          {decl.values?.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
    );
  }
  const check = control === 'formula' ? checkFormula(String(value)) : undefined;
  return (
    <label>
      {label}
      <input
        className={control === 'formula' ? 'code' : ''}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
      {check && !check.ok && <span className="error">{check.error}</span>}
      {check?.canonical && <span className="muted">canonical: {check.canonical}</span>}
    </label>
  );
}

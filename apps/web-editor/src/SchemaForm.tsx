import { useState } from 'react';
import { checkFormula } from './model.ts';
import {
  type At,
  initial,
  kindOf,
  label,
  properties,
  type Registry,
  variantFor,
  variants,
} from './schema.ts';

// A form generated from a JSON Schema node. Values flow down; every edit returns a new value up.

interface Props {
  reg: Registry;
  at: At;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Top-level properties handled elsewhere (the item form's own fields). */
  omit?: ReadonlySet<string> | undefined;
  depth?: number;
}

export function SchemaForm({ reg, at, value, onChange, omit, depth = 0 }: Props) {
  const kind = kindOf(at);
  switch (kind) {
    case 'formula':
      return <FormulaField value={value} onChange={onChange} />;
    case 'enum':
      return (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {((at.node.enum as unknown[]) ?? []).map((v) => (
            <option key={String(v)}>{String(v)}</option>
          ))}
        </select>
      );
    case 'const':
      return <code>{String(at.node.const)}</code>;
    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    case 'string':
      return (
        <input
          value={typeof value === 'string' ? value : ''}
          placeholder={typeof at.node.pattern === 'string' ? 'text' : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'union':
      return <UnionField reg={reg} at={at} value={value} onChange={onChange} depth={depth} />;
    case 'object':
      return (
        <ObjectField
          reg={reg}
          at={at}
          value={value}
          onChange={onChange}
          omit={omit}
          depth={depth}
        />
      );
    case 'map':
      return <MapField reg={reg} at={at} value={value} onChange={onChange} depth={depth} />;
    case 'array':
      return <ArrayField reg={reg} at={at} value={value} onChange={onChange} depth={depth} />;
    default:
      return <JsonField value={value} onChange={onChange} />;
  }
}

function FormulaField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const text = value === undefined || value === null ? '' : String(value);
  const check = checkFormula(text);
  return (
    <span className="formula">
      <input
        className="code"
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          onChange(
            /^-?\d+(\.\d+)?$/.test(t.trim())
              ? Number(t)
              : t === 'true'
                ? true
                : t === 'false'
                  ? false
                  : t,
          );
        }}
      />
      {!check.ok && <span className="error">{check.error}</span>}
      {check.canonical && <span className="muted">canonical: {check.canonical}</span>}
    </span>
  );
}

function UnionField({ reg, at, value, onChange, depth = 0 }: Props) {
  const list = variants(reg, at);
  const index = variantFor(reg, at, value);
  const current = list[index] as At;
  return (
    <div className="union">
      {list.length > 1 && (
        <select
          value={index}
          onChange={(e) => onChange(initial(reg, list[Number(e.target.value)] as At))}
        >
          {list.map((v, i) => (
            <option key={i} value={i}>
              {label(v)}
            </option>
          ))}
        </select>
      )}
      <SchemaForm reg={reg} at={current} value={value} onChange={onChange} depth={depth} />
    </div>
  );
}

const describe = (at: At) =>
  typeof at.node.description === 'string' ? at.node.description : undefined;

function ObjectField({ reg, at, value, onChange, omit, depth = 0 }: Props) {
  const object = (
    value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  ) as Record<string, unknown>;
  const props = properties(reg, at, object).filter((p) => !omit?.has(p.name));
  const present = props.filter((p) => p.required || p.name in object);
  const absent = props.filter((p) => !p.required && !(p.name in object));
  const set = (name: string, v: unknown) => {
    const next = { ...object };
    if (v === undefined) delete next[name];
    else next[name] = v;
    onChange(next);
  };
  return (
    <div className={depth > 0 ? 'object nested' : 'object'}>
      {present.map((p) => (
        <div key={p.name} className="prop">
          <div className="prop-head">
            <span title={describe(p.at)}>
              {p.name}
              {p.required && <span className="muted"> · required</span>}
            </span>
            {!p.required && (
              <button type="button" className="link" onClick={() => set(p.name, undefined)}>
                remove
              </button>
            )}
          </div>
          <SchemaForm
            reg={reg}
            at={p.at}
            value={object[p.name]}
            onChange={(v) => set(p.name, v)}
            depth={depth + 1}
          />
        </div>
      ))}
      {absent.length > 0 && (
        <select
          value=""
          onChange={(e) =>
            e.target.value &&
            set(
              e.target.value,
              initial(reg, props.find((p) => p.name === e.target.value)?.at as At),
            )
          }
        >
          <option value="">+ add property…</option>
          {absent.map((p) => (
            <option key={p.name} value={p.name} title={describe(p.at)}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function MapField({ reg, at, value, onChange, depth = 0 }: Props) {
  const map = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const [key, setKey] = useState('');
  const item = reg.child(at, at.node.additionalProperties);
  return (
    <div className="object nested">
      {Object.entries(map).map(([k, v]) => (
        <details key={k} open={depth < 1 && Object.keys(map).length < 8}>
          <summary>
            <code>{k}</code>{' '}
            <button
              type="button"
              className="link"
              onClick={() => {
                const { [k]: _gone, ...rest } = map;
                onChange(rest);
              }}
            >
              remove
            </button>
          </summary>
          <SchemaForm
            reg={reg}
            at={item}
            value={v}
            onChange={(nv) => onChange({ ...map, [k]: nv })}
            depth={depth + 1}
          />
        </details>
      ))}
      <div className="row">
        <input placeholder="new key" value={key} onChange={(e) => setKey(e.target.value)} />
        <button
          type="button"
          disabled={!key || key in map}
          onClick={() => {
            onChange({ ...map, [key]: initial(reg, item) });
            setKey('');
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ArrayField({ reg, at, value, onChange, depth = 0 }: Props) {
  const list = Array.isArray(value) ? value : [];
  const item = reg.child(at, at.node.items ?? {});
  const simple = ['formula', 'string', 'enum', 'number'].includes(kindOf(item));
  const move = (from: number, to: number) => {
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  return (
    <div className={simple ? 'array simple' : 'array'}>
      {list.map((v, i) => (
        <div key={i} className={simple ? 'row' : 'array-item'}>
          {!simple && <span className="muted">#{i + 1}</span>}
          <SchemaForm
            reg={reg}
            at={item}
            value={v}
            onChange={(nv) => onChange(list.map((x, j) => (j === i ? nv : x)))}
            depth={depth + 1}
          />
          <span className="row">
            {i > 0 && (
              <button type="button" className="link" onClick={() => move(i, i - 1)}>
                ↑
              </button>
            )}
            <button
              type="button"
              className="link"
              onClick={() => onChange(list.filter((_, j) => j !== i))}
            >
              remove
            </button>
          </span>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, initial(reg, item)])}>
        + add
      </button>
    </div>
  );
}

function JsonField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(JSON.stringify(value ?? null));
  const [error, setError] = useState('');
  return (
    <span>
      <input
        className="code"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setError('');
          } catch {
            setError('not valid JSON');
          }
        }}
      />
      {error && <span className="error">{error}</span>}
    </span>
  );
}

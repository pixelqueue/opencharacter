import { useCallback, useEffect, useState } from 'react';
import { api, type PackInfo, type TreeNode, type Validation } from './api.ts';
import { Findings, GitPanel, Preview } from './Panels.tsx';
import { DocEditor, ItemEditor, RawEditor } from './Editors.tsx';
import { Translations } from './Translations.tsx';
import { isContentItem } from './model.ts';

export function App() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [packs, setPacks] = useState<PackInfo[]>([]);
  const [path, setPath] = useState<string | undefined>();
  const [validation, setValidation] = useState<Validation>({ errors: [], warnings: [] });
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    const t = await api.tree();
    setTree(t.tree);
    setPacks(t.packs);
    setValidation(await api.validate());
    setRevision((r) => r + 1);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saved = (v: Validation) => {
    setValidation(v);
    setRevision((r) => r + 1);
  };

  return (
    <div className="layout">
      <header>
        <strong>OCF Pack Editor</strong>
        <span className="muted">
          Edits files under packs/. Git is the database: review the diff and commit yourself.
        </span>
        <button type="button" onClick={() => setCreating(true)}>
          New item
        </button>
      </header>
      <nav>
        {tree.map((node) => (
          <Tree key={node.name} node={node} depth={0} selected={path} onOpen={setPath} />
        ))}
      </nav>
      <main>
        {creating ? (
          <NewItem
            packs={packs}
            onCancel={() => setCreating(false)}
            onCreated={async (p, v) => {
              setCreating(false);
              await refresh();
              setValidation(v);
              setPath(p);
            }}
          />
        ) : path === undefined ? (
          <p className="muted">Choose a file on the left.</p>
        ) : isContentItem(path) ? (
          <ItemEditor key={path} path={path} onSaved={saved} />
        ) : /\/i18n\//.test(path) ? (
          <Translations
            key={path}
            pack={packs.find((p) => path.startsWith(`${p.dir}/`))?.id ?? ''}
            onSaved={saved}
          />
        ) : /\/(pack\.yaml|rules\/.+|upgrades\/.+)$/.test(path) ? (
          <DocEditor key={path} path={path} onSaved={saved} />
        ) : (
          <RawEditor key={path} path={path} onSaved={saved} />
        )}
      </main>
      <aside>
        <Findings validation={validation} path={path} onOpen={setPath} />
        <Preview revision={revision} />
        <GitPanel revision={revision} onOpen={setPath} />
      </aside>
    </div>
  );
}

function Tree({
  node,
  depth,
  selected,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  selected?: string | undefined;
  onOpen: (p: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  if (node.path) {
    return (
      <button
        type="button"
        className={`file ${node.path === selected ? 'selected' : ''}`}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() => onOpen(node.path as string)}
      >
        {node.name.replace(/\.yaml$/, '')}
      </button>
    );
  }
  return (
    <div>
      <button
        type="button"
        className="folder"
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() => setOpen(!open)}
      >
        {open ? '▾' : '▸'} {node.name}
      </button>
      {open &&
        node.children?.map((child) => (
          <Tree
            key={child.name}
            node={child}
            depth={depth + 1}
            selected={selected}
            onOpen={onOpen}
          />
        ))}
    </div>
  );
}

function NewItem({
  packs,
  onCancel,
  onCreated,
}: {
  packs: PackInfo[];
  onCancel: () => void;
  onCreated: (path: string, v: Validation) => void;
}) {
  const [pack, setPack] = useState(packs[0]?.id ?? '');
  const [types, setTypes] = useState<string[]>([]);
  const [type, setType] = useState('');
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pack) return;
    void api.types(pack).then((t) => {
      setTypes(t.types);
      setType(t.types[0] ?? '');
    });
  }, [pack]);

  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const created = await api.newItem(pack, type, id, name);
          onCreated(created.path, created.validation);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <h2>New content item</h2>
      <label>
        Pack
        <select value={pack} onChange={(e) => setPack(e.target.value)}>
          {packs.map((p) => (
            <option key={p.id}>{p.id}</option>
          ))}
        </select>
      </label>
      <label>
        Content type
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        ID{' '}
        <span className="muted">
          (folder and name: weapons.dagger → content/weapons/dagger.yaml)
        </span>
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="weapons.dagger" />
      </label>
      <label>
        Name ({packs.find((p) => p.id === pack)?.defaultLanguage ?? 'en'})
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dagger" />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit">Create</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

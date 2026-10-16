import { AGGREGATE_ROOT, aggregateArgs, aggregateOver, type FieldView } from './aggregates.ts';
import type { Node } from './ast.ts';
import { capture, fail } from './errors.ts';
import { keptFields } from './evaluate.ts';
import { children } from './parser.ts';

/** Field IDs a tree reads: every dotted name not under a bound root, `has()` arguments too. */
export function references(node: Node, roots: ReadonlySet<string>): Set<string> {
  const found = new Set<string>();
  const visit = (n: Node, bound: ReadonlySet<string>) => {
    if (n.type === 'name' && !bound.has(n.path[0] as string)) found.add(n.path.join('.'));
    const over = n.type === 'call' ? aggregateOver(n.fn) : undefined;
    if (n.type === 'call' && over) {
      const inner = new Set([...bound, AGGREGATE_ROOT[over]]);
      n.args.forEach((arg, i) => visit(arg, over === 'list' && i === 0 ? bound : inner));
      return;
    }
    for (const child of children(n)) visit(child, bound);
  };
  visit(node, roots);
  return found;
}

/** The fields `sumFields`, `maxFields` and `minFields` calls read through their static filter. */
export function aggregatedFields(node: Node, fields: readonly FieldView[]): Set<string> {
  const found = new Set<string>();
  const visit = (n: Node) => {
    if (n.type === 'call' && aggregateOver(n.fn) === 'fields' && n.fn !== 'countFields') {
      const kept = capture(() =>
        keptFields(n.fn, aggregateArgs(n.fn, 'fields', n.args).cond, fields),
      );
      if (kept.ok) for (const view of kept.value) found.add(view.id);
    }
    for (const child of children(n)) visit(child);
  };
  visit(node);
  return found;
}

/** Orders fields after the fields they read; throws `circular-formula` naming a loop. */
export function calculationOrder(dependsOn: ReadonlyMap<string, ReadonlySet<string>>): string[] {
  const order: string[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (id: string) => {
    const s = state.get(id);
    if (s === 'done') return;
    if (s === 'visiting') {
      const loop = stack.slice(stack.indexOf(id));
      fail(
        'circular-formula',
        `fields depend on each other in a loop: ${[...loop, id].join(' → ')}`,
        { fields: loop },
      );
    }
    state.set(id, 'visiting');
    stack.push(id);
    for (const dep of [...(dependsOn.get(id) ?? [])].toSorted()) if (dependsOn.has(dep)) visit(dep);
    stack.pop();
    state.set(id, 'done');
    order.push(id);
  };
  for (const id of [...dependsOn.keys()].toSorted()) visit(id);
  return order;
}

function pathRoot(node: Node): string | undefined {
  if (node.type === 'name') return node.path[0];
  if (node.type === 'member' || node.type === 'index') return pathRoot(node.object);
  return undefined;
}

/**
 * Replaces each maximal path rooted at one of `roots` with `replace.path(path)`, and each
 * `has(<such path>)` with `replace.has(path)`.
 */
export function replaceRooted(
  node: Node,
  roots: ReadonlySet<string>,
  replace: {
    path: (path: Node) => Node;
    has: (path: Node) => Node;
    ref?: (id: string) => Node;
  },
): Node {
  const rooted = (n: Node) => {
    const root = pathRoot(n);
    return root !== undefined && roots.has(root);
  };
  const visit = (n: Node): Node => {
    if (rooted(n)) return replace.path(n);
    switch (n.type) {
      case 'list':
        return { ...n, items: n.items.map(visit) };
      case 'member':
        return { ...n, object: visit(n.object) };
      case 'index':
        return { ...n, object: visit(n.object), index: visit(n.index) };
      case 'call': {
        const [arg] = n.args;
        if (n.fn === 'has' && n.args.length === 1 && arg && rooted(arg)) return replace.has(arg);
        return { ...n, args: n.args.map(visit) };
      }
      case 'unary':
        return { ...n, operand: visit(n.operand) };
      case 'binary':
        return { ...n, left: visit(n.left), right: visit(n.right) };
      case 'conditional':
        // oxlint-disable-next-line unicorn/no-thenable
        return { ...n, test: visit(n.test), then: visit(n.then), else: visit(n.else) };
      case 'dice':
        return typeof n.count === 'number' ? n : { ...n, count: visit(n.count) };
      case 'ref':
        return replace.ref ? replace.ref(n.id) : n;
      default:
        return n;
    }
  };
  return visit(node);
}

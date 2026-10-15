import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { RawNode } from '../snapshot/types.ts';
import { parseSelector } from './parser.ts';

const createNode = (id: number, parent?: RawNode, text = ''): RawNode => {
  const node: RawNode = {
    id,
    pid: parent?.id ?? -1,
    parent,
    children: [],
    attr: {
      name: 'android.widget.TextView',
      text,
      isClickable: false,
      index: parent?.children.length ?? 0,
      depth: (parent?.attr.depth ?? -1) + 1,
      childCount: 0,
      left: 0,
      top: 0,
      right: 1,
      bottom: 1,
      width: 1,
      height: 1,
    },
  };
  if (parent) {
    parent.children.push(node);
    parent.attr.childCount = parent.children.length;
  }
  Reflect.set(node.attr, 'visibleToUser', true);
  return node;
};

const queryIds = (source: string, root: RawNode) => {
  const selector = parseSelector(source);
  const ids = selector.querySelfOrSelectorAll(root).map((n) => n.id);
  assert.deepEqual(
    selector.querySelfOrSelectorAllWithTrace(root).map((r) => r.target.id),
    ids,
  );
  return ids;
};

test('issue #66: root parent optimization matches arbitrary ancestor distance and records >33', () => {
  const root = createNode(0);
  let leaf = root;
  for (let id = 1; id <= 33; id++)
    leaf = createNode(id, leaf, id === 33 ? '预约' : '');
  for (const prefix of [
    '[depth=0] >n',
    '[parent=null] >33',
    '[parent=null] >n',
  ]) {
    const source = `${prefix} [text="预约"][visibleToUser=true]`;
    assert.deepEqual(queryIds(source, root), [33]);
    const trace =
      parseSelector(source).querySelfOrSelectorAllWithTrace(root)[0];
    assert.equal(trace.units[0].steps[0].source, leaf);
    assert.equal(trace.units[0].steps[0].target, root);
    assert.equal(trace.units[0].steps[0].formattedRelation, '>33');
    assert.equal(
      source.slice(trace.units[0].range!.start, trace.units[0].range!.end),
      source,
    );
  }
});

test('queries include self, return @ targets, deduplicate and preserve depth-first order', () => {
  const root = createNode(0);
  const first = createNode(1, root, 'a');
  createNode(2, root, 'b');
  createNode(3, first, 'c');
  assert.deepEqual(queryIds('*', root), [0, 1, 3, 2]);
  assert.deepEqual(queryIds('[parent=null]', root), [0]);
  assert.deepEqual(queryIds('@[parent=null] >n *', root), [0]);
  // Matching self may return a descendant marked with @, rather than self.
  assert.deepEqual(queryIds('@[text="a"] << [parent=null]', root), [1]);
  assert.deepEqual(parseSelector('*').querySelfOrSelectorAll(undefined), []);
  assert.deepEqual(
    parseSelector('*').querySelfOrSelectorAllWithTrace(undefined),
    [],
  );
});

test('adapter delegates built-ins and retains node properties, methods and previous context', () => {
  const root = createNode(0, undefined, 'root');
  const child = createNode(1, root, '预约');
  for (const source of [
    '[_id=1][_pid=0]',
    '[text.length=2]',
    '[text.substring(0,1)="预"]',
    '[text~="预.*"]',
    '[getChild(0).text="预约"]',
    '[text="root"][prev.text="预约"] > [text="预约"]',
    '[text="root"][getPrev(0).text="预约"] > [text="预约"]',
  ]) {
    const ids = queryIds(source, root);
    assert.ok(ids.length > 0, source);
  }
  assert.equal(parseSelector('[text="预约"]').match(child), child);
  assert.deepEqual(queryIds('[getChild(-1)!=null]', root), []);
});

test('copyability uses property identifiers rather than literal text', () => {
  assert.equal(parseSelector('[_id=1]').canCopy, false);
  assert.equal(parseSelector('[parent._pid=0]').canCopy, false);
  assert.equal(parseSelector('[text="_id"]').canCopy, true);
});

test('logical branches retain only the successful trace and exact unit ranges', () => {
  const root = createNode(0);
  createNode(1, root, '预约');
  const source = '([text="不存在"]) || ([parent=null] >n [text="预约"])';
  assert.deepEqual(queryIds(source, root), [1]);
  const trace = parseSelector(source).querySelfOrSelectorAllWithTrace(root)[0];
  assert.equal(trace.units.length, 1);
  const range = trace.units[0].range!;
  assert.equal(
    source.slice(range.start, range.end),
    '[parent=null] >n [text="预约"]',
  );
});

test('serialized implicit ancestor relations retain paths when query links are restored', () => {
  const root = createNode(0);
  createNode(1, root, '预约');
  const source = parseSelector('[parent=null] >n [text="预约"]').toString();
  assert.equal(source, '[parent=null] [text="预约"]');
  const restored = parseSelector(source);
  assert.deepEqual(queryIds(source, root), [1]);
  const units = restored.querySelfOrSelectorAllWithTrace(root)[0].units;
  assert.equal(units[0].steps[0].formattedRelation, '>');
});

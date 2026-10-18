import type { RawNode, Snapshot } from '@/entities/snapshot/types';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  createRedactedSnapshotCopy,
  getAvailableSnapshotId,
  intersectsRedactionRect,
  scaleRedactionRectangles,
  getOffscreenTextNodes,
  hasSensitiveText,
} from './privacy_redaction.ts';

test('filters blank and masked fields while retaining partially masked text', () => {
  for (const value of [undefined, null, '', '  ', '*', '***', ' * *\n']) {
    assert.equal(hasSensitiveText(value), false);
  }
  assert.equal(hasSensitiveText('张**'), true);
});

test('filters single digits and punctuation, retaining longer text and symbols', () => {
  for (const value of [
    '0',
    '9',
    '５',
    ' 1 ',
    '.',
    ',',
    '!',
    '?',
    '，',
    '。',
    '！',
    '？',
    '“',
    '”',
    '（',
    '）',
    '、',
    '…',
    '—',
  ]) {
    assert.equal(hasSensitiveText(value), false, value);
  }
  for (const value of ['12', '1.2', '你好', '张', 'A', '?!', '……', '😀', '+']) {
    assert.equal(hasSensitiveText(value), true, value);
  }
});

test('keeps meaningful descriptions and preserves filtered fields when redacting', () => {
  const nodes = ['1', '，'].map(
    (text, id) =>
      ({
        id,
        pid: -1,
        children: [],
        attr: {
          left: 100,
          top: 0,
          right: 120,
          bottom: 20,
          width: 20,
          height: 20,
          name: 'View',
          isClickable: false,
          childCount: 0,
          index: id,
          depth: 0,
          text,
          textLen: 1,
          desc: id ? '用户名' : '。',
          descLen: id ? 3 : 1,
        },
      }) as RawNode,
  );
  assert.deepEqual(
    getOffscreenTextNodes(nodes, 100, 100).map((node) => node.id),
    [1],
  );
  const source = { id: 1, nodes } as Snapshot;
  const copy = createRedactedSnapshotCopy(source, 2, [], [1]);
  assert.equal(copy.nodes[1].attr.text, '，');
  assert.equal(copy.nodes[1].attr.textLen, 1);
  assert.equal(copy.nodes[1].attr.desc, '***');
});

test('masks each field to its original string length', () => {
  const nodes = ['张三', '12345', '😀用户', '', undefined].map(
    (text, id) =>
      ({
        id,
        pid: -1,
        children: [],
        attr: {
          text,
          desc: text,
          name: 'View',
          isClickable: false,
          childCount: 0,
          index: id,
          depth: 0,
          left: 100,
          top: 0,
          right: 120,
          bottom: 20,
          width: 20,
          height: 20,
          textLen: text?.length,
          descLen: text?.length,
        },
      }) as RawNode,
  );
  const source = { id: 1, nodes } as Snapshot;
  const copy = createRedactedSnapshotCopy(
    source,
    2,
    [],
    nodes.map((node) => node.id),
  );
  for (const [index, expected] of [
    '**',
    '*****',
    '****',
    '',
    undefined,
  ].entries()) {
    assert.equal(copy.nodes[index].attr.text, expected);
    assert.equal(copy.nodes[index].attr.desc, expected);
    assert.equal(copy.nodes[index].attr.textLen, expected?.length);
    assert.equal(copy.nodes[index].attr.descLen, expected?.length);
  }
  assert.equal(source.nodes[0].attr.text, '张三');
});

test('lists offscreen and zero-size text nodes, but not partially visible nodes', () => {
  const nodes = [
    { left: 100, top: 0, right: 120, bottom: 20, text: 'outside' },
    { left: -20, top: 0, right: 0, bottom: 20, text: 'left' },
    { left: 90, top: 0, right: 120, bottom: 20, text: 'partial' },
    { left: 20, top: 20, right: 20, bottom: 30, text: 'zero' },
    { left: 0, top: 100, right: 20, bottom: 120, text: '***' },
    { left: 0, top: 100, right: 20, bottom: 120, text: '***', desc: 'secret' },
    { left: 0, top: 100, right: 20, bottom: 120, text: ' ', desc: '**' },
  ].map((attr, id) => ({ id, attr }) as RawNode);
  assert.deepEqual(
    getOffscreenTextNodes(nodes, 100, 100).map((node) => node.id),
    [0, 1, 3, 5],
  );
});

test('redacts selected offscreen fields without rectangles and preserves masked fields', () => {
  const source = {
    id: 1,
    nodes: [
      {
        id: 4,
        pid: -1,
        children: [],
        attr: {
          left: 200,
          top: 0,
          right: 220,
          bottom: 20,
          text: '****',
          textLen: 4,
          desc: 'secret',
          descLen: 6,
        },
      },
      { id: 5, pid: -1, children: [], attr: { text: 'keep', textLen: 4 } },
    ],
  } as unknown as Snapshot;
  const copy = createRedactedSnapshotCopy(source, 2, [], [4]);
  assert.equal(copy.nodes[0].attr.text, '****');
  assert.equal(copy.nodes[0].attr.textLen, 4);
  assert.equal(copy.nodes[0].attr.desc, '******');
  assert.equal(copy.nodes[0].attr.descLen, 6);
  assert.equal(copy.nodes[1].attr.text, 'keep');
  assert.equal(source.nodes[0].attr.desc, 'secret');
});

test('uses strict rectangle overlap for node redaction', () => {
  const node = { left: 10, top: 10, right: 20, bottom: 20 };
  assert.equal(
    intersectsRedactionRect(node, {
      left: 15,
      top: 15,
      right: 30,
      bottom: 30,
    }),
    true,
  );
  assert.equal(
    intersectsRedactionRect(node, {
      left: 20,
      top: 10,
      right: 30,
      bottom: 20,
    }),
    false,
  );
});

test('scales image coordinates into snapshot node coordinates', () => {
  assert.deepEqual(
    scaleRedactionRectangles(
      [{ left: 10, top: 20, right: 30, bottom: 40 }],
      0.5,
      2,
    ),
    [{ left: 5, top: 40, right: 15, bottom: 80 }],
  );
});

test('creates a detached snapshot and only masks overlapping node text', () => {
  const source = {
    id: 1,
    nodes: [
      {
        id: 0,
        pid: -1,
        children: [],
        attr: {
          name: 'Root',
          text: 'public',
          desc: 'secret',
          textLen: 6,
          descLen: 6,
          left: 0,
          top: 0,
          right: 50,
          bottom: 50,
        },
      },
      {
        id: 1,
        pid: 0,
        children: [],
        attr: {
          name: 'Child',
          text: 'keep',
          textLen: 4,
          left: 60,
          top: 60,
          right: 80,
          bottom: 80,
        },
      },
    ],
  } as unknown as Snapshot;

  const result = createRedactedSnapshotCopy(source, 2, [
    { left: 5, top: 5, right: 20, bottom: 20 },
  ]);
  assert.equal(result.id, 2);
  assert.equal(result.nodes[0].attr.text, '******');
  assert.equal(result.nodes[0].attr.desc, '******');
  assert.equal(result.nodes[0].attr.textLen, 6);
  assert.equal(result.nodes[0].attr.descLen, 6);
  assert.equal(result.nodes[1].attr.text, 'keep');
  assert.equal(source.nodes[0].attr.text, 'public');
  assert.equal(result.nodes[0].children.length, 0);
});

test('allocates the first unused snapshot id', async () => {
  const result = await getAvailableSnapshotId(10, async (id) => id < 12);
  assert.equal(result, 12);
});

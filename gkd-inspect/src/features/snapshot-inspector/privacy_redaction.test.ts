import type { Snapshot } from '@/entities/snapshot/types';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRedactedSnapshotCopy,
  getAvailableSnapshotId,
  intersectsRedactionRect,
  scaleRedactionRectangles,
} from './privacy_redaction.ts';

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
  assert.equal(result.nodes[0].attr.text, '***');
  assert.equal(result.nodes[0].attr.desc, '***');
  assert.equal(result.nodes[1].attr.text, 'keep');
  assert.equal(source.nodes[0].attr.text, 'public');
  assert.equal(result.nodes[0].children.length, 0);
});

test('allocates the first unused snapshot id', async () => {
  const result = await getAvailableSnapshotId(10, async (id) => id < 12);
  assert.equal(result, 12);
});

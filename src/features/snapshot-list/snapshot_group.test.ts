import type { Snapshot } from '@/entities/snapshot/types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSnapshotGroups } from './snapshot_group.ts';

const createSnapshot = (
  id: number,
  appId: string,
  activityId: string,
  appName = appId,
) =>
  ({
    id,
    appId,
    activityId,
    appInfo: { id: appId, name: appName },
  }) as Snapshot;

test('快照按应用和 Activity 分组并按数量排序', () => {
  const groups = buildSnapshotGroups(
    [
      createSnapshot(1, 'app.b', 'PageB'),
      createSnapshot(2, 'app.a', 'PageA', '应用 A'),
      createSnapshot(3, 'app.a', 'PageA', '应用 A'),
      createSnapshot(4, 'app.a', 'PageB', '应用 A'),
    ],
    {},
  );

  assert.deepEqual(
    groups.map((group) => [group.appId, group.snapshotCount]),
    [
      ['app.a', 3],
      ['app.b', 1],
    ],
  );
  assert.equal(groups[0].appName, '应用 A');
  assert.deepEqual(
    groups[0].activities.map((activity) => [
      activity.activityId,
      activity.snapshots.map((snapshot) => snapshot.id),
    ]),
    [
      ['PageA', [3, 2]],
      ['PageB', [4]],
    ],
  );
});

test('导入时间优先于快照 ID 决定组内顺序', () => {
  const groups = buildSnapshotGroups(
    [createSnapshot(10, 'app', 'Page'), createSnapshot(20, 'app', 'Page')],
    { '10': 200, '20': 100 },
  );

  assert.deepEqual(
    groups[0].activities[0].snapshots.map((snapshot) => snapshot.id),
    [10, 20],
  );
});

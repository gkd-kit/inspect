import type { Snapshot } from '@/entities/snapshot/types';
import { getAppInfo } from '../../entities/snapshot/node.ts';

export interface SnapshotActivityGroup {
  activityId: string;
  snapshots: Snapshot[];
}

export interface SnapshotAppGroup {
  appId: string;
  appName: string;
  activities: SnapshotActivityGroup[];
  snapshotCount: number;
}

export const buildSnapshotGroups = (
  snapshots: Snapshot[],
  snapshotImportTime: Readonly<Record<string, number>>,
): SnapshotAppGroup[] => {
  const appGroups = new Map<string, Map<string, Snapshot[]>>();
  for (const snapshot of snapshots) {
    const appId = snapshot.appId || snapshot.appInfo?.id || '(unknown)';
    const activityId = snapshot.activityId || '(unknown)';
    const activities = appGroups.get(appId) ?? new Map<string, Snapshot[]>();
    const activitySnapshots = activities.get(activityId) ?? [];
    activitySnapshots.push(snapshot);
    activities.set(activityId, activitySnapshots);
    appGroups.set(appId, activities);
  }

  return [...appGroups.entries()]
    .map(([appId, activities]): SnapshotAppGroup => {
      const activityGroups = [...activities.entries()]
        .map(([activityId, activitySnapshots]) => ({
          activityId,
          snapshots: [...activitySnapshots].sort(
            (left, right) =>
              (snapshotImportTime[String(right.id)] ?? right.id) -
              (snapshotImportTime[String(left.id)] ?? left.id),
          ),
        }))
        .sort((left, right) => {
          const countDelta = right.snapshots.length - left.snapshots.length;
          return countDelta || left.activityId.localeCompare(right.activityId);
        });
      const allSnapshots = activityGroups.flatMap(
        (activity) => activity.snapshots,
      );
      return {
        appId,
        appName:
          allSnapshots
            .map((snapshot) => getAppInfo(snapshot).name)
            .find(Boolean) || appId,
        activities: activityGroups,
        snapshotCount: allSnapshots.length,
      };
    })
    .sort((left, right) => {
      const countDelta = right.snapshotCount - left.snapshotCount;
      return countDelta || left.appId.localeCompare(right.appId);
    });
};

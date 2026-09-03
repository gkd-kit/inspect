import type { DraggableCardValue } from '@/components/base/draggable';

const SNAPSHOT_PANEL_LAYOUT_STORAGE_KEY = 'snapshot.panelLayouts';

const snapshotPanelNames = ['search', 'rule', 'attr', 'overlap'] as const;

export type SnapshotPanelName = (typeof snapshotPanelNames)[number];
type SnapshotPanelLayouts = Partial<
  Record<SnapshotPanelName, DraggableCardValue>
>;

interface SnapshotPanelLayoutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value == 'object' && value !== null;
const isCoordinate = (value: unknown): value is number =>
  typeof value == 'number' &&
  Number.isFinite(value) &&
  Math.abs(value) <= 100000;
const isWidth = (value: unknown): value is number =>
  typeof value == 'number' &&
  Number.isFinite(value) &&
  value >= 300 &&
  value <= 100000;

export const normalizeSnapshotPanelLayout = (
  value: unknown,
): DraggableCardValue | undefined => {
  if (!isRecord(value)) return;

  const layout: DraggableCardValue = {};
  if (isCoordinate(value.left)) layout.left = value.left;
  else if (isCoordinate(value.right)) layout.right = value.right;
  if (isCoordinate(value.top)) layout.top = value.top;
  else if (isCoordinate(value.bottom)) layout.bottom = value.bottom;
  if (isWidth(value.width)) layout.width = value.width;

  const hasHorizontalAnchor =
    layout.left !== undefined || layout.right !== undefined;
  const hasVerticalAnchor =
    layout.top !== undefined || layout.bottom !== undefined;
  return hasHorizontalAnchor && hasVerticalAnchor ? layout : undefined;
};

export const getSnapshotPanelLayoutStorageKey = (name: SnapshotPanelName) =>
  `${SNAPSHOT_PANEL_LAYOUT_STORAGE_KEY}.${name}`;

const parseSnapshotPanelLayout = (source: string | null) => {
  if (!source) return;
  try {
    return normalizeSnapshotPanelLayout(JSON.parse(source));
  } catch {
    return;
  }
};

export const loadSnapshotPanelLayouts = (
  storage: SnapshotPanelLayoutStorage = localStorage,
): SnapshotPanelLayouts => {
  const layouts: SnapshotPanelLayouts = {};
  for (const name of snapshotPanelNames) {
    const layout = parseSnapshotPanelLayout(
      storage.getItem(getSnapshotPanelLayoutStorageKey(name)),
    );
    if (layout) layouts[name] = layout;
  }
  return layouts;
};

export const persistSnapshotPanelLayout = (
  name: SnapshotPanelName,
  value: DraggableCardValue,
  storage: SnapshotPanelLayoutStorage = localStorage,
) => {
  const layout = normalizeSnapshotPanelLayout(value);
  if (!layout) return;
  storage.setItem(
    getSnapshotPanelLayoutStorageKey(name),
    JSON.stringify(layout),
  );
  return layout;
};

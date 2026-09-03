import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getSnapshotPanelLayoutStorageKey,
  loadSnapshotPanelLayouts,
  normalizeSnapshotPanelLayout,
  persistSnapshotPanelLayout,
} from './panel_layout.ts';
import {
  getDraggableViewportCorrection,
  getDraggableViewportWidth,
} from '../../shared/ui/GkDraggableCard.ts';

const readSource = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');
const draggableCardSource = readSource('../../shared/ui/GkDraggableCard.vue');
const snapshotPageSource = readSource('./SnapshotInspectorView.vue');
const panelSources = [
  './SearchCard.vue',
  './RuleCard.vue',
  './AttrCard.vue',
  './OverlapCard.vue',
].map(readSource);

test('validates and restores snapshot panel positions and widths', () => {
  const values = new Map([
    [
      getSnapshotPanelLayoutStorageKey('search'),
      JSON.stringify({ right: 360, top: 52, width: 520 }),
    ],
    [
      getSnapshotPanelLayoutStorageKey('rule'),
      JSON.stringify({ right: 180, top: 80, width: 640 }),
    ],
    [
      getSnapshotPanelLayoutStorageKey('attr'),
      JSON.stringify({ right: 24, top: 64 }),
    ],
    [
      getSnapshotPanelLayoutStorageKey('overlap'),
      JSON.stringify({ left: 420, top: 220 }),
    ],
  ]);
  const layouts = loadSnapshotPanelLayouts({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });

  assert.deepEqual(layouts.search, { right: 360, top: 52, width: 520 });
  assert.deepEqual(layouts.rule, { right: 180, top: 80, width: 640 });
  assert.deepEqual(layouts.attr, { right: 24, top: 64 });
  assert.deepEqual(layouts.overlap, { left: 420, top: 220 });
});

test('ignores malformed or unsafe snapshot panel layouts', () => {
  assert.equal(normalizeSnapshotPanelLayout({ top: 10 }), undefined);
  const values = new Map([
    [getSnapshotPanelLayoutStorageKey('search'), '{'],
    [
      getSnapshotPanelLayoutStorageKey('rule'),
      JSON.stringify({ right: 320, top: 40, width: 500, extra: true }),
    ],
    [
      getSnapshotPanelLayoutStorageKey('attr'),
      JSON.stringify({ right: 12, top: 40, width: 200 }),
    ],
  ]);
  assert.deepEqual(
    loadSnapshotPanelLayouts({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    }),
    {
      rule: { right: 320, top: 40, width: 500 },
      attr: { right: 12, top: 40 },
    },
  );
});

test('keeps panel layouts in memory and persists user changes locally', () => {
  assert.match(
    draggableCardSource,
    /const initialValue = \{ \.\.\.props\.initialValue \}/,
  );
  assert.match(
    draggableCardSource,
    /emit\('update:value', getCurrentValue\(\)\)/,
  );
  assert.match(draggableCardSource, /useDragMove\([\s\S]*emitCurrentValue/);
  assert.match(snapshotPageSource, /loadSnapshotPanelLayouts\(\)/);
  assert.match(snapshotPageSource, /panelLayouts\[name\] = layout/);
  assert.match(snapshotPageSource, /persistSnapshotPanelLayout\(name, value\)/);
  assert.doesNotMatch(
    snapshotPageSource,
    /sessionStorage\.(?:getItem|setItem)\(\s*SNAPSHOT_PANEL_LAYOUT_STORAGE_KEY/,
  );
  for (const name of ['search', 'rule', 'attr', 'overlap']) {
    assert.match(
      snapshotPageSource,
      new RegExp(`setPanelLayout\\('${name}', \\$event\\)`),
    );
  }
  for (const source of panelSources) {
    assert.match(source, /@update:value="updateLayout"/);
  }
});

test('animates every draggable panel through the shared mount boundary', () => {
  assert.match(
    draggableCardSource,
    /<Transition name="draggable-card" appear>/,
  );
  assert.match(draggableCardSource, /draggable-card-enter-active/);
  assert.match(draggableCardSource, /draggable-card-leave-active/);
});

test('stores each panel separately so tabs cannot overwrite sibling layouts', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };

  persistSnapshotPanelLayout(
    'search',
    { right: 320, top: 40, width: 520 },
    storage,
  );
  persistSnapshotPanelLayout('attr', { right: 12, top: 60 }, storage);

  assert.equal(values.has(getSnapshotPanelLayoutStorageKey('search')), true);
  assert.equal(values.has(getSnapshotPanelLayoutStorageKey('attr')), true);
  assert.deepEqual(loadSnapshotPanelLayouts(storage), {
    search: { right: 320, top: 40, width: 520 },
    attr: { right: 12, top: 60 },
  });
});

test('keeps a draggable header reachable after the viewport shrinks', () => {
  assert.deepEqual(
    getDraggableViewportCorrection(
      { left: 1400, right: 1820, top: 900, bottom: 940 },
      { width: 1024, height: 768 },
    ),
    { x: -416, y: -172 },
  );
  assert.equal(getDraggableViewportWidth(900, 1024, 300), 900);
  assert.equal(getDraggableViewportWidth(900, 800, 300), 776);
});

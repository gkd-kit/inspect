import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const overlapCardSource = readFileSync(
  new URL('./OverlapCard.vue', import.meta.url),
  'utf8',
);
const snapshotStoreSource = readFileSync(
  new URL('./snapshot.ts', import.meta.url),
  'utf8',
);

test(`层叠节点卡片通过 store action 关闭只读状态`, () => {
  assert.match(
    snapshotStoreSource,
    /const closeOverlap = \(\) => \{\s*overlapNodes\.value = undefined;\s*\};/,
  );
  assert.match(
    snapshotStoreSource,
    /overlapNodes: shallowReadonly\(overlapNodes\),[\s\S]*?closeOverlap,/,
  );
  assert.match(
    overlapCardSource,
    /const \{[^}]*\bcloseOverlap\b[^}]*\} =\s*useSnapshotStore\(\);/,
  );
  assert.match(overlapCardSource, /@close="closeOverlap"/);
});

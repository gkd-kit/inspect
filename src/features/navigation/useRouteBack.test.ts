import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getRouteBackAction } from './useRouteBack.ts';

const readSource = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const pageSources = [
  '../device-control/DeviceControlView.vue',
  '../selector-tester/SelectorTesterView.vue',
  '../selector-library/SelectorLibraryView.vue',
  '../snapshot-inspector/SnapshotInspectorView.vue',
  '../log-viewer/LogToolbar.vue',
].map(readSource);

test('存在上一条路由时返回，否则回到主页', () => {
  assert.equal(getRouteBackAction('/'), 'back');
  assert.equal(getRouteBackAction('/selector/library'), 'back');
  assert.equal(getRouteBackAction(null), 'home');
  assert.equal(getRouteBackAction(undefined), 'home');
  assert.equal(getRouteBackAction(''), 'home');
});

test('所有页面顶部返回入口使用统一组件', () => {
  for (const source of pageSources) {
    assert.match(source, /<PageBackButton\b/);
    assert.doesNotMatch(source, /<RouterLink\s+to="\/"/);
  }
});

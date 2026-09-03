import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectSelectorPresetTags,
  collectSelectorPresetIdentities,
  createSelectorPreset,
  filterSelectorPresets,
  inferSelectorPresetScope,
  mergeSelectorPresets,
  parseSelectorLibraryPayload,
  serializeSelectorLibrary,
  updateSelectorPreset,
} from './library.ts';

const now = 1_700_000_000_000;

test('filters selector presets by app and activity scope', () => {
  const globalPreset = createSelectorPreset(
    { name: '全局', selector: '[text="确定"]', scope: 'global' },
    'global',
    now,
  );
  const appPreset = createSelectorPreset(
    {
      name: '应用',
      selector: '[vid="close"]',
      scope: 'app',
      appId: 'com.example',
    },
    'app',
    now + 1,
  );
  const activityPreset = createSelectorPreset(
    {
      name: '界面',
      selector: '[desc="跳过"]',
      scope: 'activity',
      appId: 'com.example',
      activityId: 'com.example.MainActivity',
    },
    'activity',
    now + 2,
  );

  assert.deepEqual(
    filterSelectorPresets([globalPreset, appPreset, activityPreset], '', {
      appId: 'com.example',
      activityId: 'com.example.MainActivity',
    }).map((item) => item.id),
    ['activity', 'app', 'global'],
  );
  assert.deepEqual(
    filterSelectorPresets([globalPreset, appPreset, activityPreset], '', {
      appId: 'com.other',
    }).map((item) => item.id),
    ['global'],
  );
});

test('collects saved selector identities within the current snapshot context', () => {
  const globalPreset = createSelectorPreset(
    { name: '全局', selector: '[text="确定"]', scope: 'global' },
    'global',
    now,
  );
  const appPreset = createSelectorPreset(
    {
      name: '应用',
      selector: '[vid="close"]',
      scope: 'app',
      appId: 'com.example',
    },
    'app',
    now + 1,
  );
  const activityPreset = createSelectorPreset(
    {
      name: '界面',
      selector: '[desc="跳过"]',
      scope: 'activity',
      appId: 'com.example',
      activityId: 'com.example.MainActivity',
    },
    'activity',
    now + 2,
  );
  const items = [globalPreset, appPreset, activityPreset];
  const context = {
    appId: 'com.example',
    activityId: 'com.example.MainActivity',
  };

  const identities = collectSelectorPresetIdentities(items, context);
  assert.equal(identities.has('[text="确定"]'), true);
  assert.equal(identities.has('[vid="close"]'), true);
  assert.equal(identities.has('[desc="跳过"]'), true);
  assert.deepEqual(
    [...collectSelectorPresetIdentities(items, { appId: 'com.other' })],
    ['[text="确定"]'],
  );
});

test('merges duplicate selector identities without losing usage data', () => {
  const current = createSelectorPreset(
    {
      name: '旧名称',
      selector: '[text="确定"]',
      tags: ['常用'],
      scope: 'global',
    },
    'old-id',
    now,
  );
  current.useCount = 3;
  current.lastUsedAt = now + 10;
  const incoming = createSelectorPreset(
    {
      name: '新名称',
      selector: '[text="确定"]',
      tags: ['按钮'],
      scope: 'global',
    },
    'new-id',
    now + 20,
  );

  const [merged] = mergeSelectorPresets([current], [incoming]);
  assert.equal(merged.id, 'old-id');
  assert.equal(merged.name, '新名称');
  assert.equal(merged.useCount, 3);
  assert.deepEqual(merged.tags, ['常用', '按钮']);
});

test('treats formatting variants as the same selector identity', () => {
  const formatted = createSelectorPreset(
    {
      name: '带空格',
      selector: '[text = "确定"]',
      scope: 'global',
    },
    'formatted',
    now,
  );
  const canonical = createSelectorPreset(
    {
      name: '规范格式',
      selector: '[text="确定"]',
      scope: 'global',
    },
    'canonical',
    now + 1,
  );

  assert.equal(
    collectSelectorPresetIdentities([formatted]).has(canonical.selector),
    true,
  );
  assert.equal(mergeSelectorPresets([formatted], [canonical]).length, 1);
});

test('rejects invalid selectors at every selector-library domain entry', () => {
  assert.throws(() =>
    createSelectorPreset(
      { name: '非法选择器', selector: '[text=', scope: 'global' },
      'invalid',
      now,
    ),
  );
  assert.throws(() =>
    parseSelectorLibraryPayload({
      version: 1,
      items: [
        {
          id: 'invalid',
          name: '非法选择器',
          selector: '[text=',
          description: '',
          tags: [],
          scope: 'global',
          createdAt: now,
          updatedAt: now,
          useCount: 0,
        },
      ],
    }),
  );
});

test('rejects a mixed import instead of silently dropping invalid items', () => {
  const valid = createSelectorPreset(
    { name: '合法选择器', selector: '[text="确定"]', scope: 'global' },
    'valid',
    now,
  );
  assert.throws(
    () =>
      parseSelectorLibraryPayload({
        version: 1,
        items: [valid, { ...valid, id: 'invalid', selector: '[text=' }],
      }),
    /第 2 条数据无效/,
  );
});

test('updates merge indexes when an imported item changes identity', () => {
  const original = createSelectorPreset(
    { name: '原条目', selector: '[text="A"]', scope: 'global' },
    'same-id',
    now,
  );
  const changed = createSelectorPreset(
    { name: '新条目', selector: '[text="B"]', scope: 'global' },
    'same-id',
    now + 1,
  );
  const restoredIdentity = createSelectorPreset(
    { name: '重用原身份', selector: '[text="A"]', scope: 'global' },
    'another-id',
    now + 2,
  );

  assert.deepEqual(
    mergeSelectorPresets([original], [changed, restoredIdentity]).map(
      (item) => item.selector,
    ),
    ['[text="B"]', '[text="A"]'],
  );
});

test('collapses an id and identity collision into one preset', () => {
  const first = createSelectorPreset(
    { name: '第一条', selector: '[text="A"]', scope: 'global' },
    'same-id',
    now,
  );
  const second = createSelectorPreset(
    { name: '第二条', selector: '[text="B"]', scope: 'global' },
    'other-id',
    now + 1,
  );
  const incoming = createSelectorPreset(
    { name: '导入更新', selector: '[text="B"]', scope: 'global' },
    'same-id',
    now + 2,
  );

  const merged = mergeSelectorPresets([first, second], [incoming]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'same-id');
  assert.equal(merged[0].selector, '[text="B"]');
});

test('does not let an older imported item overwrite newer local metadata', () => {
  const local = createSelectorPreset(
    { name: '本地新名称', selector: '[text="确定"]', scope: 'global' },
    'same-id',
    now + 20,
  );
  const backup = createSelectorPreset(
    { name: '备份旧名称', selector: '[text="确定"]', scope: 'global' },
    'same-id',
    now,
  );

  const [merged] = mergeSelectorPresets([local], [backup]);
  assert.equal(merged.name, '本地新名称');
  assert.equal(merged.updatedAt, now + 20);
});

test('advances the edit version when an older import adds metadata', () => {
  const local = createSelectorPreset(
    {
      name: '本地名称',
      selector: '[text="确定"]',
      tags: ['本地'],
      scope: 'global',
    },
    'same-id',
    now + 20,
  );
  const backup = createSelectorPreset(
    {
      name: '备份旧名称',
      selector: '[text="确定"]',
      tags: ['导入'],
      scope: 'global',
    },
    'same-id',
    now,
  );

  const [merged] = mergeSelectorPresets([local], [backup], now + 100);
  assert.equal(merged.name, '本地名称');
  assert.deepEqual(merged.tags, ['本地', '导入']);
  assert.equal(merged.updatedAt, now + 100);
});

test('serializes and validates a versioned selector library payload', () => {
  const preset = createSelectorPreset(
    { name: '确定', selector: '[text="确定"]', scope: 'global' },
    'preset',
    now,
  );
  const payload = serializeSelectorLibrary([preset]);
  assert.equal(payload.version, 1);
  assert.deepEqual(parseSelectorLibraryPayload(payload), [preset]);
  assert.throws(() => parseSelectorLibraryPayload({ items: {} }));
  assert.throws(() =>
    parseSelectorLibraryPayload({ version: 2, items: [preset] }),
  );
});

test('updates selector metadata without losing identity and usage data', () => {
  const preset = createSelectorPreset(
    { name: '旧名称', selector: '[text="确定"]', scope: 'global' },
    'preset',
    now,
  );
  preset.useCount = 4;
  preset.lastUsedAt = now + 10;

  const updated = updateSelectorPreset(
    preset,
    {
      name: '新名称',
      selector: '[vid="confirm"]',
      description: '确认按钮',
      tags: ['常用'],
      scope: 'app',
      appId: 'com.example',
    },
    now + 20,
  );

  assert.equal(updated.id, 'preset');
  assert.equal(updated.createdAt, now);
  assert.equal(updated.updatedAt, now + 20);
  assert.equal(updated.useCount, 4);
  assert.equal(updated.lastUsedAt, now + 10);
  assert.equal(updated.scope, 'app');
  assert.equal(updated.appId, 'com.example');
});

test('collects unique tags from all selector presets', () => {
  const first = createSelectorPreset(
    {
      name: '关闭',
      selector: '[text="关闭"]',
      tags: ['弹窗', '常用'],
      scope: 'global',
    },
    'first',
    now,
  );
  const second = createSelectorPreset(
    {
      name: '确定',
      selector: '[text="确定"]',
      tags: ['常用', '按钮'],
      scope: 'global',
    },
    'second',
    now + 1,
  );

  assert.deepEqual(collectSelectorPresetTags([first, second]), [
    '按钮',
    '常用',
    '弹窗',
  ]);
});

test('infers selector scope from optional app and activity fields', () => {
  assert.equal(inferSelectorPresetScope('', ''), 'global');
  assert.equal(inferSelectorPresetScope('com.example', ''), 'app');
  assert.equal(
    inferSelectorPresetScope('com.example', 'com.example.MainActivity'),
    'activity',
  );
  assert.equal(inferSelectorPresetScope('', 'orphan.Activity'), 'global');
});

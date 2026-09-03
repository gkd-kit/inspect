import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const snapshotPageSource = readFileSync(
  new URL('./SnapshotPage.vue', import.meta.url),
  'utf8',
);
const screenshotCardSource = readFileSync(
  new URL('./ScreenshotCard.vue', import.meta.url),
  'utf8',
);
const privacyRedactionDialogSource = readFileSync(
  new URL('./PrivacyRedactionDialog.vue', import.meta.url),
  'utf8',
);

test('脱敏副本入口位于侧边栏搜索面板按钮上方', () => {
  const privacyIconIndex = snapshotPageSource.indexOf(
    '<SvgIcon name="privacy"',
  );
  const searchIconIndex = snapshotPageSource.indexOf(
    '<SvgIcon name="search-list"',
  );
  assert.ok(privacyIconIndex >= 0, '侧边栏缺少脱敏副本图标');
  assert.ok(searchIconIndex >= 0, '侧边栏缺少搜索面板图标');
  assert.ok(
    privacyIconIndex < searchIconIndex,
    '脱敏副本入口必须位于搜索面板上方',
  );
  assert.doesNotMatch(
    screenshotCardSource,
    />\s*创建脱敏副本\s*<\/NButton>/,
    '截图区域不应保留旧文字按钮',
  );
});

test('脱敏弹窗首帧使用快照尺寸预留画布空间', () => {
  assert.match(
    screenshotCardSource,
    /:imageWidth="snapshot\.screenWidth"[\s\S]*:imageHeight="snapshot\.screenHeight"/,
  );
  assert.match(privacyRedactionDialogSource, /:width="imageWidth"/);
  assert.match(privacyRedactionDialogSource, /:height="imageHeight"/);
});

test('脱敏弹窗只保留右上角关闭入口', () => {
  assert.doesNotMatch(privacyRedactionDialogSource, />\s*取消\s*<\/NButton>/);
  assert.match(
    privacyRedactionDialogSource,
    /@update:show="emit\('update:show', \$event\)"/,
  );
});

test('清除全部区域使用可撤销的独立图标入口', () => {
  assert.match(privacyRedactionDialogSource, /aria-label="清除全部区域"/);
  assert.match(
    privacyRedactionDialogSource,
    /<SvgIcon name="clear-selection" \/>/,
  );
  assert.match(privacyRedactionDialogSource, /清除全部区域（可撤销）/);
  assert.doesNotMatch(privacyRedactionDialogSource, />\s*清空\s*<\/NButton>/);
});

test('创建脱敏副本后显示带链接的完成弹窗而不自动跳转', () => {
  assert.match(screenshotCardSource, /title="创建完成"/);
  assert.match(screenshotCardSource, /新快照链接/);
  assert.match(screenshotCardSource, /<RouterLink[\s\S]*创建的快照/);
  assert.doesNotMatch(screenshotCardSource, />\s*关闭\s*<\/NButton>/);
  assert.doesNotMatch(
    screenshotCardSource,
    /await router\.push\(\{ name: 'snapshot', params: \{ snapshotId: newId \} \}\)/,
  );
});

test('创建完成后可确认删除原快照并打开脱敏副本', () => {
  assert.match(screenshotCardSource, />\s*删除原快照\s*<\/NButton>/);
  assert.match(screenshotCardSource, /删除当前原快照并打开脱敏副本？/);
  assert.match(screenshotCardSource, /仅删除本地快照，此操作不可恢复。/);
  assert.match(
    screenshotCardSource,
    /snapshotStorage\.removeItem\(result\.sourceSnapshotId\)/,
  );
  assert.match(
    screenshotCardSource,
    /await withTimeout\([\s\S]*?await router\.push\(path\)/,
  );
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const readSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const homePageSource = readSource('./HomePage.vue');
const settingsModalSource = readSource(
  '../../components/app/SettingsModal.vue',
);
const deviceDialogsSource = readSource('../device/DeviceActionDialogs.vue');
const privacyDialogSource = readSource(
  '../snapshot/PrivacyRedactionDialog.vue',
);
const screenshotCardSource = readSource('../snapshot/ScreenshotCard.vue');

const getModalOpeningTag = (source: string, title: string) => {
  const openingTag = (source.match(/<NModal\b[^>]*>/g) || []).find((tag) =>
    tag.includes(`title="${title}"`),
  );
  assert.ok(openingTag, `缺少“${title}”弹窗`);
  return openingTag;
};

test('编辑和录入型弹窗不允许点击遮罩关闭', () => {
  const editingModals = [
    [homePageSource, '导入网络文件'],
    [settingsModalSource, '设置'],
    [deviceDialogsSource, '修改内存订阅'],
    [deviceDialogsSource, '执行选择器'],
    [privacyDialogSource, '创建脱敏副本'],
  ] as const;

  for (const [source, title] of editingModals) {
    assert.match(
      getModalOpeningTag(source, title),
      /:maskClosable="false"/,
      `“${title}”必须保留用户编辑内容，不能点击遮罩关闭`,
    );
  }
});

test('只读的创建结果弹窗仍可点击遮罩关闭', () => {
  assert.doesNotMatch(
    getModalOpeningTag(screenshotCardSource, '创建完成'),
    /:maskClosable="false"/,
  );
});

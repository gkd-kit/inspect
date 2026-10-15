import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getAppsPreviewData } from './apps_preview.ts';

test(`apps.json 按设备用户归类应用`, () => {
  assert.deepEqual(
    getAppsPreviewData({
      userId: 0,
      apps: [
        { id: `main`, name: `主用户应用` },
        { id: `clone`, name: `分身应用`, userId: 999 },
      ],
      otherUsers: [
        { id: 999, name: `应用分身` },
        { id: 666, name: `XSpace User` },
      ],
    }),
    {
      totalApps: 2,
      users: [
        {
          id: 0,
          name: `当前用户`,
          isCurrent: true,
          apps: [{ id: `main`, name: `主用户应用`, userId: 0 }],
        },
        {
          id: 666,
          name: `XSpace User`,
          isCurrent: false,
          apps: [],
        },
        {
          id: 999,
          name: `应用分身`,
          isCurrent: false,
          apps: [{ id: `clone`, name: `分身应用`, userId: 999 }],
        },
      ],
    },
  );
});

test(`apps.json 自动兼容未声明的用户和可选应用字段`, () => {
  assert.deepEqual(
    getAppsPreviewData({
      userId: 10,
      apps: [
        {
          id: `example`,
          name: `Example`,
          userId: 11,
          versionName: `1.0`,
          versionCode: 1,
          isSystem: false,
          enabled: true,
          hidden: false,
        },
      ],
    }),
    {
      totalApps: 1,
      users: [
        { id: 10, name: `当前用户`, isCurrent: true, apps: [] },
        {
          id: 11,
          name: `用户 11`,
          isCurrent: false,
          apps: [
            {
              id: `example`,
              name: `Example`,
              userId: 11,
              versionName: `1.0`,
              versionCode: 1,
              isSystem: false,
              enabled: true,
              hidden: false,
            },
          ],
        },
      ],
    },
  );
});

test(`缺少 apps 数组时不启用专用预览`, () => {
  assert.equal(getAppsPreviewData(undefined), undefined);
  assert.equal(getAppsPreviewData({ otherUsers: [] }), undefined);
});

test(`应用数量超出结构化上限时降级展示`, () => {
  assert.equal(getAppsPreviewData({ apps: new Array(10_001) }), undefined);
});

test(`应用虚拟列表同时启用弹性高度以保留表头和滚动区域`, () => {
  const component = readFileSync(
    new URL(`./AppsPreview.vue`, import.meta.url),
    `utf8`,
  );
  assert.match(
    component,
    /<NDataTable[\s\S]*?\bflexHeight\b[\s\S]*?\bvirtualScroll\b[\s\S]*?\/>/,
  );
});

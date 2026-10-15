import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSourceLinkContext,
  getSourceLineTokens,
  getShortestUniquePathLabels,
  isLogVersionPath,
  parseLogBuildKey,
  parseLogVersionInfo,
} from './source_links.ts';

const commitId = `61d434673a7323d9021cb1fcdf6c122507696a4a`;
const versionRaw = JSON.stringify({
  commitId,
  commitUrl: `https://github.com/gkd-kit/gkd/commit/${commitId}`,
  versionName: `1.12.1-61d4346`,
  versionCode: 92,
});

test(`识别日志包版本信息文件`, () => {
  assert.equal(isLogVersionPath(`gkd.json`), true);
  assert.equal(isLogVersionPath(`GKD.JSON`), true);
  assert.equal(isLogVersionPath(`gkd-1.12.1.json`), true);
  assert.equal(isLogVersionPath(`gkd-.json`), false);
  assert.equal(isLogVersionPath(`log/gkd.json`), false);
  assert.equal(isLogVersionPath(`gkd.json.bak`), false);
});

test(`从 gkd.json 解析可选构建标识`, () => {
  assert.equal(
    parseLogBuildKey(JSON.stringify({ buildKey: ` gkd-build-123 ` })),
    `gkd-build-123`,
  );
  assert.equal(parseLogBuildKey(JSON.stringify({ buildKey: `` })), undefined);
  assert.equal(parseLogBuildKey(JSON.stringify({ buildKey: 123 })), undefined);
  assert.equal(parseLogBuildKey(`invalid json`), undefined);
});

test(`解析日志包版本名称、版本代码和提交链接`, () => {
  assert.deepEqual(parseLogVersionInfo(versionRaw), {
    versionName: `1.12.1-61d4346`,
    versionCode: 92,
    commitUrl: `https://github.com/gkd-kit/gkd/commit/${commitId}`,
  });
  assert.equal(
    parseLogVersionInfo(
      JSON.stringify({
        commitId,
        commitUrl: `javascript:alert(1)`,
        versionName: `invalid`,
        versionCode: 1,
      }),
    ),
    undefined,
  );
});

test(`根据版本信息和源码路径生成 GitHub 行链接`, () => {
  const context = createSourceLinkContext(
    versionRaw,
    `app/src/main/kotlin/li/songe/gkd/App.kt`,
  );
  assert.ok(context);
  const line = `app started at App.kt:86 successfully`;
  const tokens = getSourceLineTokens(line, context);
  assert.equal(
    tokens.map((token) => token.text).join(``),
    line,
    `链接化不能改变原始文本和间距`,
  );
  assert.deepEqual(tokens[1]?.sourceTargets, [
    {
      path: `app/src/main/kotlin/li/songe/gkd/App.kt`,
      displayPath: `App.kt`,
      url: `https://github.com/gkd-kit/gkd/blob/${commitId}/app/src/main/kotlin/li/songe/gkd/App.kt#L86`,
    },
  ]);
});

test(`同名源码路径使用最短唯一后缀作为显示文本`, () => {
  assert.deepEqual(getShortestUniquePathLabels([`a/b/c/A.kt`, `x/y/z/A.kt`]), [
    `c/A.kt`,
    `z/A.kt`,
  ]);
  assert.deepEqual(
    getShortestUniquePathLabels([`a/b/c/A.kt`, `x/y/c/A.kt`, `q/r/d/A.kt`]),
    [`b/c/A.kt`, `y/c/A.kt`, `d/A.kt`],
  );
});

test(`同名源码生成多个候选链接且按大小写精确匹配`, () => {
  const context = createSourceLinkContext(
    versionRaw,
    [
      `app/src/main/kotlin/ui/ModifierExt.kt`,
      `app/src/main/kotlin/share/ModifierExt.kt`,
      `app/src/main/kotlin/icon/GitHub.kt`,
      `app/src/main/kotlin/util/Github.kt`,
    ].join(`\n`),
  );
  assert.ok(context);
  const duplicate = getSourceLineTokens(`ModifierExt.kt:10`, context)[0];
  assert.deepEqual(
    duplicate?.sourceTargets?.map((target) => target.path),
    [
      `app/src/main/kotlin/share/ModifierExt.kt`,
      `app/src/main/kotlin/ui/ModifierExt.kt`,
    ],
  );
  assert.deepEqual(
    getSourceLineTokens(`GitHub.kt:20`, context)[0]?.sourceTargets?.map(
      (target) => target.path,
    ),
    [`app/src/main/kotlin/icon/GitHub.kt`],
  );
});

test(`缺少源码路径或版本信息无效时禁用链接增强`, () => {
  assert.equal(createSourceLinkContext(versionRaw, undefined), undefined);
  assert.equal(createSourceLinkContext(versionRaw, ``), undefined);
  assert.equal(
    createSourceLinkContext(
      JSON.stringify({
        commitId: `fffffff`,
        commitUrl: `https://github.com/gkd-kit/gkd/commit/${commitId}`,
      }),
      `app/src/main/kotlin/li/songe/gkd/App.kt`,
    ),
    undefined,
  );
});

test(`非法源码路径和无法定位的引用保持纯文本`, () => {
  const context = createSourceLinkContext(
    versionRaw,
    [
      `../App.kt`,
      `C:\\project\\App.kt`,
      `/project/App.kt`,
      `app/src/main/kotlin/li/songe/gkd/MainActivity.kt`,
    ].join(`\n`),
  );
  assert.ok(context);
  const line = `App.kt:1 MainActivity.kt:365 OkUtils.kt:20`;
  const tokens = getSourceLineTokens(line, context);
  assert.equal(tokens.map((token) => token.text).join(``), line);
  assert.equal(tokens.filter((token) => token.sourceTargets).length, 1);
  assert.equal(
    tokens.find((token) => token.sourceTargets)?.text,
    `MainActivity.kt:365`,
  );
});

test(`一行中的多个源码引用分别生成链接`, () => {
  const context = createSourceLinkContext(
    versionRaw,
    [
      `app/src/main/kotlin/li/songe/gkd/App.kt`,
      `app/src/main/kotlin/li/songe/gkd/MainActivity.kt`,
    ].join(`\n`),
  );
  assert.ok(context);
  const tokens = getSourceLineTokens(
    `App.kt:86 -> MainActivity.kt:365`,
    context,
  );
  assert.deepEqual(
    tokens.filter((token) => token.sourceTargets).map((token) => token.text),
    [`App.kt:86`, `MainActivity.kt:365`],
  );
});

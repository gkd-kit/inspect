import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const readSource = (name: string) =>
  readFileSync(new URL(name, import.meta.url), `utf8`);

test(`文本查看状态由显式操作更新，文档切换通过 key 重建`, () => {
  const contextSource = readSource(`./text_viewer/context.ts`);
  const viewerSource = readSource(`./text_viewer/TextViewer.vue`);
  const logPreviewSource = readSource(`./LogPreviewPanel.vue`);
  const crashPreviewSource = readSource(`./CrashPreview.vue`);
  const logDirectorySource = readSource(`./LogDirectoryPreview.vue`);

  assert.match(viewerSource, /documentKey\?: string;/);
  assert.doesNotMatch(contextSource, /\bwatch(?:Effect|Immediate)?\s*\(/);
  assert.match(contextSource, /const updateQuery = \(value: string\)/);
  assert.match(contextSource, /const toggleSearchOption =/);
  assert.match(viewerSource, /@update:checked="setWrap"/);
  assert.match(logPreviewSource, /:documentKey="selectedEntry\?\.path"/);
  assert.match(logPreviewSource, /:key="selectedEntry\?\.path"/);
  assert.match(crashPreviewSource, /:documentKey="detail\.path"/);
  assert.match(crashPreviewSource, /:key="`\$\{detail\.path\}:stack`"/);
  assert.match(logDirectorySource, /:key="detailPath"/);
});

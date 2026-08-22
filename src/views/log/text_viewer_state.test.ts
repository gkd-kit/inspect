import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const readSource = (name: string) =>
  readFileSync(new URL(name, import.meta.url), `utf8`);

test(`文本转换保留查看状态，只有文档标识变化时重置`, () => {
  const contextSource = readSource(`./text_viewer/context.ts`);
  const viewerSource = readSource(`./text_viewer/TextViewer.vue`);
  const logPageSource = readSource(`./LogPage.vue`);
  const crashPreviewSource = readSource(`./CrashPreview.vue`);
  const logDirectorySource = readSource(`./LogDirectoryPreview.vue`);

  assert.match(viewerSource, /documentKey\?: string;/);
  assert.match(contextSource, /watch\(options\.documentKey,/);
  assert.doesNotMatch(contextSource, /watch\(options\.value,/);
  assert.doesNotMatch(contextSource, /watch\(\[options\.value, wrap\]/);
  assert.match(logPageSource, /:documentKey="selectedEntry\?\.path"/);
  assert.match(crashPreviewSource, /:documentKey="detail\.path"/);
  assert.match(logDirectorySource, /:key="detailPath"/);
});

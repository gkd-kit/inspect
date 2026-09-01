import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const searchCardSource = readFileSync(
  new URL('./SearchCard.vue', import.meta.url),
  'utf8',
);

test(`搜索框的真实 textarea 与自动高度镜像继承相同字体`, () => {
  const inputTag = searchCardSource.match(/<NInput\b[\s\S]*?\/>/)?.[0];
  assert.ok(inputTag, `未找到搜索输入框`);
  assert.match(
    inputTag,
    /\bclass="gkd_code"/,
    `等宽字体必须设置在 NInput 根节点，供 textarea 和测量镜像共同继承`,
  );
  assert.doesNotMatch(
    inputTag,
    /inputProps[\s\S]*gkd_code/,
    `不能只给真实 textarea 设置等宽字体，否则软换行高度会少算`,
  );
});

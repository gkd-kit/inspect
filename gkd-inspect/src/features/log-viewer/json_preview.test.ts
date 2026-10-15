import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatBasicJsonValue,
  formatJsonForPreview,
  getBasicJsonTableRows,
  isJsonStructureTooLarge,
  isJsonTreeTooLarge,
} from './json_preview.ts';

test(`基本类型、基本类型数组和空对象会转换为表格数据`, () => {
  const rows = getBasicJsonTableRows({
    name: `GKD`,
    version: 92,
    enabled: true,
    empty: null,
    values: [1, `two`, false, null],
    options: {},
  });

  assert.equal(rows?.length, 6);
  assert.equal(formatBasicJsonValue(rows?.[0]?.value), `"GKD"`);
  assert.equal(formatBasicJsonValue(rows?.[4]?.value), `[1,"two",false,null]`);
  assert.equal(formatBasicJsonValue(rows?.[5]?.value), `{}`);
  assert.deepEqual(
    getBasicJsonTableRows([1, `two`, false])?.map((row) => row.key),
    [`0`, `1`, `2`],
  );
});

test(`包含非空嵌套对象或对象数组时保留树形结构`, () => {
  assert.equal(getBasicJsonTableRows({ nested: { value: 1 } }), undefined);
  assert.equal(getBasicJsonTableRows({ rows: [{ value: 1 }] }), undefined);
  assert.equal(getBasicJsonTableRows({ empty: [] })?.length, 1);
});

test(`超大扁平 JSON 不创建完整结构化表格`, () => {
  const value = Array.from({ length: 10_001 }, (_, index) => index);
  assert.equal(isJsonStructureTooLarge(value), true);
  assert.equal(getBasicJsonTableRows(value), undefined);
});

test(`嵌套容器按整棵 JSON 树执行结构预算`, () => {
  const value = Array.from({ length: 101 }, () =>
    Array.from({ length: 1000 }, () => 1),
  );
  assert.equal(isJsonStructureTooLarge(value), false);
  assert.equal(isJsonTreeTooLarge(value), true);
});

test(`过深的 JSON 结构会降级为原始文本`, () => {
  let value: unknown = 1;
  for (let index = 0; index < 129; index++) value = { child: value };
  assert.equal(isJsonTreeTooLarge(value), true);
});

test(`压缩 JSON 会格式化为多行`, () => {
  const value = {
    id: 667,
    apps: Array.from({ length: 1200 }, (_, index) => ({
      id: `app.${index}`,
      groups: [{ key: index, rules: [{ matches: `text=${index}` }] }],
    })),
  };
  const raw = JSON.stringify(value);
  const formatted = formatJsonForPreview(value, raw);

  assert.equal(raw.includes(`\n`), false);
  assert.equal(formatted.startsWith(`{\n`), true);
  assert.equal(formatted.endsWith(`\n}`), true);
});

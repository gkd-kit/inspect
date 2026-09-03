import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSqliteColumnWidth,
  getSqliteMeasuredColumnWidth,
  getSqliteTableWidth,
} from './sqlite_table.ts';

const measureText = (text: string) => text.length * 10;

test(`SQLite 动态列生成确定宽度`, () => {
  assert.equal(
    getSqliteColumnWidth({
      title: `id`,
      values: [`1`, `1234567890`],
      sortable: true,
      measureText,
    }),
    116,
  );
  assert.equal(getSqliteMeasuredColumnWidth(64, 100), 116);
  assert.equal(
    getSqliteColumnWidth({
      title: `note`,
      values: [`short\nlonger line`],
      sortable: false,
      measureText,
    }),
    126,
  );
});

test(`表格横向滚动宽度等于全部确定列宽之和`, () => {
  assert.equal(getSqliteTableWidth([64, 116, 126]), 306);
});

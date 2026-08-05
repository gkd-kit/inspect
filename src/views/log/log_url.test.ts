import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getKnownLogRoute,
  getLogPathSource,
  getLogQuerySource,
  getLogRoute,
  isValidLogPath,
} from '../../utils/log_url.ts';

test(`GitHub 日志附件转换为规范路由`, () => {
  const url =
    `https://github.com/user-attachments/files/30034251/` +
    `log-1784092724705.zip`;
  assert.deepEqual(getKnownLogRoute(url), {
    path: `/log/30034251/log-1784092724705.zip`,
  });
  assert.deepEqual(getLogPathSource([`30034251`, `log-1784092724705.zip`]), {
    url,
    name: `log-1784092724705.zip`,
  });
});

test(`GitHub 路由参数中的字面百分号不会被重复解码`, () => {
  assert.deepEqual(getLogPathSource([`30034251`, `log-100%.zip`]), {
    url: `https://github.com/user-attachments/files/30034251/log-100%25.zip`,
    name: `log-100%.zip`,
  });
});

test(`f.gkd.li 日志附件转换为数字短路由`, () => {
  assert.deepEqual(getKnownLogRoute(`https://f.gkd.li/29669330`), {
    path: `/log/29669330`,
  });
  assert.deepEqual(getLogPathSource(`29669330`), {
    url: `https://f.gkd.li/29669330`,
    name: `log-29669330.zip`,
  });
});

test(`其他链接保留完整查询参数`, () => {
  const url = `https://example.com/log.zip?token=a%26b#part`;
  assert.deepEqual(getLogRoute(url), {
    path: `/log`,
    query: { url },
  });
  assert.deepEqual(getLogQuerySource(url), {
    url,
    name: `log.zip`,
  });
});

test(`拒绝非法日志路径和协议`, () => {
  assert.equal(getLogRoute(`file:///tmp/log.zip`), undefined);
  assert.equal(isValidLogPath([`abc`]), false);
  assert.equal(isValidLogPath([`123`, `log.txt`]), false);
  assert.equal(isValidLogPath([`123`, `log.zip`, `extra`]), false);
});

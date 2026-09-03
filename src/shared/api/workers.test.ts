import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWorkersProxyUrl } from './workers.ts';

test(`代理地址只接受 Worker 白名单内的 GitHub ZIP`, () => {
  const targetUrl =
    `https://github.com/user-attachments/files/29669330/` +
    `log-1784092724705.zip`;
  assert.equal(
    String(getWorkersProxyUrl(targetUrl)),
    `https://api.gkd.li/proxy?url=${encodeURIComponent(targetUrl)}`,
  );
  assert.equal(getWorkersProxyUrl(`https://example.com/file.zip`), undefined);
});

test(`f.gkd.li 短链在进入代理前转换为 GitHub ZIP`, () => {
  const targetUrl = `https://github.com/user-attachments/files/29669330/file.zip`;
  assert.equal(
    String(getWorkersProxyUrl(`https://f.gkd.li/29669330`)),
    `https://api.gkd.li/proxy?url=${encodeURIComponent(targetUrl)}`,
  );
});

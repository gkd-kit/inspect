import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gmOk: vi.fn(),
  gmFetch: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('@/shared/api/gm', () => ({
  gmOk: mocks.gmOk,
  GM_fetch: mocks.gmFetch,
}));
vi.mock('@/shared/lib/url', () => ({ isAllowCorsUrl: () => false }));
import { downloadBuildAssetZip } from './retrace_client';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

test('有 GM 时直接下载 GitHub 附件并使用匿名请求', async () => {
  mocks.gmOk.mockReturnValue(true);
  mocks.gmFetch.mockResolvedValue(new Response('zip'));
  const signal = new AbortController().signal;
  assert.equal((await downloadBuildAssetZip(123, signal)).byteLength, 3);
  assert.equal(mocks.fetch.mock.calls.length, 0);
  const [url, init, configure] = mocks.gmFetch.mock.calls[0]!;
  assert.equal(url, 'https://github.com/user-attachments/files/123/file.zip');
  assert.equal(init.signal, signal);
  assert.equal(init.credentials, 'omit');
  assert.equal(configure({}).anonymous, true);
});

test('无 GM 时使用 Workers 代理', async () => {
  mocks.gmOk.mockReturnValue(false);
  mocks.fetch.mockResolvedValue(new Response('zip'));
  await downloadBuildAssetZip(123, new AbortController().signal);
  const url = new URL(mocks.fetch.mock.calls[0]![0]);
  assert.equal(url.origin, 'https://api.gkd.li');
  assert.equal(url.pathname, '/proxy');
  assert.equal(
    url.searchParams.get('url'),
    'https://github.com/user-attachments/files/123/file.zip',
  );
  assert.equal(mocks.gmFetch.mock.calls.length, 0);
});

test('206 仅在范围覆盖完整文件且实际长度匹配时可用', async () => {
  mocks.gmOk.mockReturnValue(true);
  mocks.gmFetch.mockResolvedValue(
    new Response('zip', {
      status: 206,
      headers: { 'content-range': 'bytes 0-2/3' },
    }),
  );
  assert.equal(
    (await downloadBuildAssetZip(123, new AbortController().signal)).byteLength,
    3,
  );
  for (const range of ['bytes 0-1/3', 'bytes 1-2/3', 'bytes 0-2/*', '']) {
    mocks.gmFetch.mockResolvedValue(
      new Response('zi', {
        status: 206,
        headers: { 'content-range': range },
      }),
    );
    await assert.rejects(
      downloadBuildAssetZip(123, new AbortController().signal),
      /下载不完整/,
    );
  }
  mocks.gmFetch.mockResolvedValue(
    new Response('zi', {
      status: 206,
      headers: { 'content-range': 'bytes 0-2/3' },
    }),
  );
  await assert.rejects(
    downloadBuildAssetZip(123, new AbortController().signal),
    /实际长度/,
  );
});

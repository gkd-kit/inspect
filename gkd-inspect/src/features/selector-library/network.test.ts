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
import { networkFetch } from '@/shared/api/network';
import { requestWorkersJson } from '@/shared/api/workers';
import { fetchSelectorLibrary } from './network';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('选择器库和自有 API 都通过 GM 请求', async () => {
  mocks.gmOk.mockReturnValue(true);
  mocks.gmFetch.mockImplementation(async () => Response.json({ items: [] }));
  assert.deepEqual(
    await fetchSelectorLibrary('https://example.com/library.json'),
    { items: [] },
  );
  const [, init, configure] = mocks.gmFetch.mock.calls[0]!;
  assert.equal(init.credentials, 'omit');
  assert.equal(configure({}).anonymous, true);
  await requestWorkersJson(new URL('https://api.gkd.li/test'), {
    method: 'POST',
    body: '{}',
  });
  assert.equal(mocks.gmFetch.mock.calls[1]![1].method, 'POST');
  assert.equal(mocks.fetch.mock.calls.length, 0);
});

test('无 GM 的普通来源保留 CORS 直连及请求选项', async () => {
  mocks.gmOk.mockReturnValue(false);
  mocks.fetch.mockResolvedValue(Response.json({}));
  const init = { credentials: 'omit', cache: 'no-cache' } as const;
  await networkFetch('https://example.com/library.json', init);
  assert.deepEqual(mocks.fetch.mock.calls[0], [
    'https://example.com/library.json',
    init,
  ]);
});

test('生产环境已知 CORS 来源直接请求', async () => {
  vi.stubEnv('PROD', true);
  mocks.gmOk.mockReturnValue(true);
  mocks.fetch.mockResolvedValue(new Response('ok'));
  await networkFetch('https://registry.npmmirror.com/test');
  assert.equal(mocks.fetch.mock.calls.length, 1);
  assert.equal(mocks.gmFetch.mock.calls.length, 0);
});

test('无 GM 时仅 GET 附件走代理并保留取消和请求头', async () => {
  mocks.gmOk.mockReturnValue(false);
  mocks.fetch.mockResolvedValue(new Response('ok'));
  const controller = new AbortController();
  const input = new Request(
    'https://github.com/user-attachments/files/123/file.zip',
    {
      headers: { Range: 'bytes=0-2' },
      signal: controller.signal,
    },
  );
  await networkFetch(input);
  const [url, init] = mocks.fetch.mock.calls[0]!;
  assert.equal(new URL(url).pathname, '/proxy');
  assert.equal(init.headers.get('range'), 'bytes=0-2');
  assert.equal(init.credentials, 'omit');
  controller.abort();
  assert.equal(init.signal.aborted, true);
  await networkFetch(input.url, { method: 'POST', body: 'test' });
  assert.equal(mocks.fetch.mock.calls[1]![0], input.url);
});

test('取消的请求不会启动网络操作', async () => {
  await assert.rejects(
    networkFetch('https://example.com', { signal: AbortSignal.abort() }),
    { name: 'AbortError' },
  );
  assert.equal(mocks.fetch.mock.calls.length, 0);
  assert.equal(mocks.gmFetch.mock.calls.length, 0);
});

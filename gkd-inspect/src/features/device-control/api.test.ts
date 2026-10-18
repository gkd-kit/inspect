import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/features/network-access/enhanceFetch', () => ({
  enhanceFetch: mocks.fetch,
}));
vi.mock('@/shared/services/feedback', () => ({ message: { error: vi.fn() } }));
import { useDeviceApi } from './api';

test('a connection prepares all data before switching and API objects retain their original device', async () => {
  const gate = Promise.withResolvers<Response>();
  mocks.fetch.mockImplementation((url: URL) => {
    if (url.origin === 'http://second' && url.pathname.endsWith('getSnapshots'))
      return gate.promise;
    return Promise.resolve(
      Response.json(
        url.pathname.endsWith('getServerInfo')
          ? {
              device: { manufacturer: url.hostname },
              gkdAppInfo: { versionName: '1' },
            }
          : [],
        { headers: { 'GKD-RPC-Status': 'ok' } },
      ),
    );
  });
  const device = useDeviceApi();
  const first = await device.prepareConnection('http://first');
  assert.equal(device.origin.value, undefined);
  device.applyConnection(first);
  const oldApi = device.api.value;
  const preparing = device.prepareConnection('http://second');
  assert.equal(device.origin.value, 'http://first');
  assert.equal(device.api.value, oldApi);
  gate.resolve(
    Response.json([{ id: 2 }], { headers: { 'GKD-RPC-Status': 'ok' } }),
  );
  const second = await preparing;
  assert.equal(device.origin.value, 'http://first');
  device.applyConnection(second);
  assert.equal(first.controller.signal.aborted, true);
  assert.equal(device.origin.value, 'http://second');
  assert.equal(second.snapshots[0].id, 2);
  await oldApi.getScreenshot({ id: 1 });
  const [url, init] = mocks.fetch.mock.calls.at(-1)!;
  assert.equal(url.origin, 'http://first');
  assert.equal(init.signal.aborted, true);
  device.disconnect();
  assert.equal(second.controller.signal.aborted, true);
  assert.equal(device.origin.value, undefined);
});

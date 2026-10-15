import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readLimitedResponse } from './response.ts';

test(`远程响应在流式读取时执行大小限制`, async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    }),
  );
  const result = await readLimitedResponse(response, 4);
  assert.deepEqual([...new Uint8Array(result)], [1, 2, 3, 4]);

  const oversized = new Response(new Uint8Array(5));
  await assert.rejects(() => readLimitedResponse(oversized, 4), /超过大小限制/);
});

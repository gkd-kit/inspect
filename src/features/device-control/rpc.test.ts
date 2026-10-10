import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRpcResponse, RpcException } from './rpc.ts';

test('新协议成功 JSON 不会为错误检查而消耗或克隆响应体', async () => {
  const response = Response.json(
    { __error: true, result: false },
    { headers: { 'gkd-rpc-status': 'ok' } },
  );
  response.clone = () => {
    throw new Error('successful response must not be cloned');
  };
  assert.equal(await readRpcResponse(response), response);
  assert.equal(response.bodyUsed, false);
  assert.deepEqual(await response.json(), { __error: true, result: false });
});

test('二进制成功响应保持原始字节，响应头名称大小写不影响判定', async () => {
  const bytes = new Uint8Array([0, 255, 128]);
  const response = new Response(bytes, {
    headers: { 'GkD-RpC-StAtUs': 'ok', 'Content-Type': 'image/webp' },
  });
  assert.equal(await readRpcResponse(response), response);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test('HTTP 200 的业务失败抛出带稳定错误码的 RpcException', async () => {
  const response = Response.json(
    { code: 'SNAPSHOT_CAPTURE_BUSY', message: '正在保存快照' },
    { headers: { 'GKD-RPC-Status': 'error' } },
  );
  await assert.rejects(readRpcResponse(response), (error: unknown) => {
    assert.ok(error instanceof RpcException);
    assert.equal(error.code, 'SNAPSHOT_CAPTURE_BUSY');
    assert.equal(error.message, '正在保存快照');
    assert.equal(error.serverStackTrace, undefined);
    return true;
  });
});

test('内部错误完整保留服务端堆栈，同时保留客户端自身的 stack', async () => {
  const serverStack = [
    'java.lang.IllegalStateException: 内部异常',
    '\tat li.gkd.app.network.InspectionServer.kt:100',
    'Suppressed: java.io.IOException: 回滚失败',
    'Caused by: java.io.IOException: 写入失败',
  ].join('\n');
  await assert.rejects(
    readRpcResponse(
      Response.json(
        {
          code: 'INTERNAL_ERROR',
          message: '服务内部错误',
          stackTrace: serverStack,
        },
        { headers: { 'GKD-RPC-Status': 'error' } },
      ),
    ),
    (error: unknown) => {
      assert.ok(error instanceof RpcException);
      assert.equal(error.serverStackTrace, serverStack);
      assert.match(error.stack ?? '', /RpcException: 服务内部错误/);
      assert.notEqual(error.stack, serverStack);
      return true;
    },
  );
});

test('订阅解析错误保留字段路径和具体原因', async () => {
  const path = '$.apps[0].groups[1].rules[2].actionMaximum';
  await assert.rejects(
    readRpcResponse(
      Response.json(
        {
          code: 'INVALID_SUBSCRIPTION',
          path,
          message: '订阅内容无效: Expected an integer',
        },
        { headers: { 'GKD-RPC-Status': 'error' } },
      ),
    ),
    (error: unknown) => {
      assert.ok(error instanceof RpcException);
      assert.equal(error.code, 'INVALID_SUBSCRIPTION');
      assert.equal(error.path, path);
      assert.equal(error.message, '订阅内容无效: Expected an integer');
      assert.equal(error.serverStackTrace, undefined);
      return true;
    },
  );
});

test('字段路径可缺省或为 null，非字符串路径拒绝为协议错误', async () => {
  const response = (path: unknown) =>
    Response.json(
      { code: 'INVALID_SUBSCRIPTION', message: '订阅内容无效', path },
      { headers: { 'GKD-RPC-Status': 'error' } },
    );
  for (const path of [undefined, null]) {
    await assert.rejects(
      readRpcResponse(response(path)),
      (error: unknown) =>
        error instanceof RpcException && error.path === undefined,
    );
  }
  await assert.rejects(readRpcResponse(response(123)), {
    name: 'Error',
    message: 'RPC 错误响应的 path 不是字符串',
  });
});

test('无堆栈的业务错误接受 null，错误字段类型不合法时拒绝响应', async () => {
  const response = (stackTrace: unknown) =>
    Response.json(
      { code: 'INVALID_REQUEST', message: '请求参数无效', stackTrace },
      { headers: { 'GKD-RPC-Status': 'error' } },
    );
  await assert.rejects(
    readRpcResponse(response(null)),
    (error: unknown) =>
      error instanceof RpcException && error.serverStackTrace === undefined,
  );
  await assert.rejects(
    readRpcResponse(response({ message: 'invalid field type' })),
    { name: 'Error', message: 'RPC 错误响应的 stackTrace 不是字符串' },
  );
});

test('图片接口的 JSON 错误也在公共请求层被识别', async () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ code: 'SCREENSHOT_NOT_FOUND', message: '截图不存在' }),
  );
  await assert.rejects(
    readRpcResponse(
      new Response(bytes, {
        headers: {
          'GKD-RPC-Status': 'error',
          'Content-Type': 'application/json',
        },
      }),
    ),
    (error: unknown) =>
      error instanceof RpcException && error.code === 'SCREENSHOT_NOT_FOUND',
  );
});

test('错误体损坏、缺少字段或未知状态属于协议错误', async () => {
  for (const [body, message] of [
    ['broken-json', 'RPC 错误响应不是有效 JSON'],
    ['{"message":"missing code"}', 'RPC 错误响应缺少 code 或 message'],
  ] as const) {
    await assert.rejects(
      readRpcResponse(
        new Response(body, { headers: { 'GKD-RPC-Status': 'error' } }),
      ),
      { name: 'Error', message },
    );
  }
  await assert.rejects(
    readRpcResponse(
      new Response(null, { headers: { 'GKD-RPC-Status': 'ERROR' } }),
    ),
    { name: 'Error', message: '未知 RPC 状态: ERROR' },
  );
});

test('旧服务的 __error 仍被识别，成功数据保留给调用方读取', async () => {
  await assert.rejects(
    readRpcResponse(Response.json({ __error: true, message: '旧版错误' })),
    (error: unknown) =>
      error instanceof RpcException && error.code === 'LEGACY_ERROR',
  );
  const response = Response.json([{ id: 7 }]);
  assert.equal(await readRpcResponse(response), response);
  assert.deepEqual(await response.json(), [{ id: 7 }]);
});

test('非成功 HTTP 响应不当作业务错误读取', async () => {
  await assert.rejects(
    readRpcResponse(new Response('gateway unavailable', { status: 502 })),
    (error: unknown) =>
      error instanceof Error &&
      !(error instanceof RpcException) &&
      error.message === 'HTTP 502',
  );
});

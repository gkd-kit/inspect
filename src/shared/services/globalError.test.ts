import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isWasmGcCompatibilityError } from './globalError.ts';

const wasmGcCompileError =
  'WebAssembly.Module(): invalid array type definition, enable with --experimental-wasm-gc @+12';

test('识别 regex-wasm 在旧浏览器中的 Wasm GC 编译错误', () => {
  assert.equal(
    isWasmGcCompatibilityError(
      new WebAssembly.CompileError(wasmGcCompileError),
    ),
    true,
  );
  assert.equal(
    isWasmGcCompatibilityError({ reason: new Error(wasmGcCompileError) }),
    true,
  );
  assert.equal(
    isWasmGcCompatibilityError({ error: new Error(wasmGcCompileError) }),
    true,
  );
});

test('其它 WebAssembly 和业务错误不会误报为浏览器版本过低', () => {
  assert.equal(
    isWasmGcCompatibilityError(
      new WebAssembly.CompileError(
        'WebAssembly.Module(): expected magic word 00 61 73 6d',
      ),
    ),
    false,
  );
  assert.equal(isWasmGcCompatibilityError(new Error('network error')), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { isJsonEqual } from './equal.ts';

test('JSON equality ignores object key order and missing undefined properties', () => {
  assert.equal(
    isJsonEqual(
      { a: 1, nested: { b: 2 } },
      { nested: { b: 2, optional: undefined }, a: 1 },
    ),
    true,
  );
  assert.equal(isJsonEqual({ optional: undefined }, {}), true);
  assert.equal(isJsonEqual({}, { optional: undefined }), true);
  assert.equal(isJsonEqual({ a: 1 }, { a: 2 }), false);
  assert.equal(isJsonEqual({}, { a: null }), false);
});

test('JSON equality distinguishes arrays, values and own properties', () => {
  assert.equal(isJsonEqual([1, { a: 2 }], [1, { a: 2 }]), true);
  assert.equal(isJsonEqual([1, 2], [2, 1]), false);
  assert.equal(isJsonEqual([1], [1, 2]), false);
  assert.equal(isJsonEqual([], {}), false);
  assert.equal(isJsonEqual(NaN, NaN), true);
  assert.equal(isJsonEqual(1, '1'), false);
  assert.equal(isJsonEqual(JSON.parse('{"__proto__":1}'), {}), false);
});

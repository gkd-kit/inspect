import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSelectorSyntax } from './diagnostics.ts';

test('reports a valid selector with its parsed representation', () => {
  const result = inspectSelectorSyntax('[text="确定"]');
  assert.equal(result.status, 'valid');
  if (result.status == 'valid') {
    assert.equal(result.selector.toString(), '[text="确定"]');
  }
});

test('reports the parser position for an invalid selector', () => {
  const result = inspectSelectorSyntax('[text=');
  assert.equal(result.status, 'invalid');
  if (result.status == 'invalid') {
    assert.equal(result.index, 5);
    assert.match(result.message, /EOF/);
  }
});

test('anchors EOF errors to the final input character', () => {
  const cases = [
    { source: '[', index: 0 },
    { source: '[p', index: 1 },
  ];
  for (const item of cases) {
    const result = inspectSelectorSyntax(item.source);
    assert.equal(result.status, 'invalid');
    if (result.status == 'invalid') {
      assert.equal(result.index, item.index);
      assert.match(result.message, /EOF/);
    }
  }
});

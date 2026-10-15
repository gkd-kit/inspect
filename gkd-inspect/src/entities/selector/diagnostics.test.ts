import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  inspectSelectorSyntax,
  getSelectorErrorHighlightSegments,
} from './diagnostics.ts';

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
    assert.equal(result.index, 6);
    assert.match(result.message, /EOF/);
  }
});

test('preserves EOF positions after the final input character', () => {
  const cases = [
    { source: '[', index: 1 },
    { source: '[p', index: 2 },
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

test('highlights complete type errors and invalid regex literals', () => {
  for (const [source, error] of [
    ['[unknown=1]', 'unknown'],
    ['[text~="["]', '"["'],
  ]) {
    const diagnostic = inspectSelectorSyntax(source);
    assert.equal(diagnostic.status, 'invalid');
    if (diagnostic.status !== 'invalid') continue;
    assert.ok(diagnostic.range);
    assert.equal(
      source.slice(diagnostic.range.start, diagnostic.range.end),
      error,
    );
    assert.equal(
      getSelectorErrorHighlightSegments(source, diagnostic)?.error,
      error,
    );
    assert.ok(diagnostic.message.length > 0);
  }
});

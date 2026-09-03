import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSelectorErrorHighlightSegments } from './diagnostics.ts';

test('highlights the parser error character', () => {
  assert.deepEqual(
    getSelectorErrorHighlightSegments('[text=!', {
      status: 'invalid',
      message: 'invalid',
      index: 6,
    }),
    { before: '[text=', error: '!', after: '', eof: false },
  );
});

test('renders an EOF marker when the error is after the last character', () => {
  assert.deepEqual(
    getSelectorErrorHighlightSegments('[text=', {
      status: 'invalid',
      message: 'invalid',
      index: 6,
    }),
    { before: '[text=', error: '', after: '', eof: true },
  );
});

test('does not split a Unicode surrogate pair', () => {
  assert.deepEqual(
    getSelectorErrorHighlightSegments('😀!', {
      status: 'invalid',
      message: 'invalid',
      index: 1,
    }),
    { before: '', error: '😀', after: '!', eof: false },
  );
});

test('does not create a visual marker without a parser index', () => {
  assert.equal(
    getSelectorErrorHighlightSegments('invalid', {
      status: 'invalid',
      message: 'invalid',
    }),
    null,
  );
});

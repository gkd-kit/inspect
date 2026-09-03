import assert from 'node:assert/strict';
import test from 'node:test';
import { getVirtualTextLines } from './virtual_text.ts';

test(`getVirtualTextLines keeps empty and mixed-newline lines`, () => {
  assert.deepEqual(getVirtualTextLines(`first\r\n\nsecond\r`), [
    { key: 0, number: 1, text: `first` },
    { key: 1, number: 2, text: `` },
    { key: 2, number: 3, text: `second` },
    { key: 3, number: 4, text: `` },
  ]);
});

test(`getVirtualTextLines gives an empty document one visible line`, () => {
  assert.deepEqual(getVirtualTextLines(``), [{ key: 0, number: 1, text: `` }]);
});

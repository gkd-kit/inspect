import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  countTextLineMatches,
  countTextMatches,
  createTextSearchOptions,
  getTextMatchRanges,
  isTextSearchQueryValid,
  matchesTextSearch,
} from './text_search.ts';

test(`文本搜索支持大小写、全词和正则选项`, () => {
  const options = createTextSearchOptions();
  assert.equal(countTextMatches(`Alpha alpha alphabet`, `alpha`, options), 3);

  options.matchCase = true;
  assert.equal(countTextMatches(`Alpha alpha alphabet`, `alpha`, options), 2);

  options.wholeWord = true;
  assert.equal(countTextMatches(`Alpha alpha alphabet`, `alpha`, options), 1);

  options.useRegex = true;
  options.wholeWord = false;
  assert.equal(matchesTextSearch(`rule-123`, `rule-\\d+`, options), true);
  assert.deepEqual(getTextMatchRanges(`a1 b22`, `\\d+`, options), [
    { start: 1, end: 2 },
    { start: 4, end: 6 },
  ]);
  assert.equal(countTextLineMatches(`a1\nb22`, `\\d+`, options), 2);
});

test(`非法正则不会中断搜索`, () => {
  const options = createTextSearchOptions();
  options.useRegex = true;
  assert.equal(isTextSearchQueryValid(`[`, options), false);
  assert.equal(countTextMatches(`content`, `[`, options), 0);
});

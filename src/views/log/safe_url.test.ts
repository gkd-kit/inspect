import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSafeHttpUrl } from './safe_url.ts';

test(`订阅外链只允许 HTTP 和 HTTPS`, () => {
  assert.equal(
    getSafeHttpUrl(`https://example.com/help`),
    `https://example.com/help`,
  );
  assert.equal(
    getSafeHttpUrl(`http://example.com/update`),
    `http://example.com/update`,
  );
  assert.equal(getSafeHttpUrl(`javascript:alert(1)`), undefined);
  assert.equal(getSafeHttpUrl(`data:text/html,test`), undefined);
});

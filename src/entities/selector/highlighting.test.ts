import assert from 'node:assert/strict';
import test from 'node:test';
import { Selector } from '@gkd-kit/selector';
import { getSelectorTextSegments } from './highlighting.ts';

const textOf = (segments: ReturnType<typeof getSelectorTextSegments>) =>
  segments
    .flatMap((segment) => segment.tokens.map((token) => token.text))
    .join('');

test('tokens preserve complete valid and incomplete input including whitespace and Unicode', () => {
  for (const source of [
    '',
    ' [text="😀预约"] >n * ',
    '[text=',
    '[text="😀',
    '[unknown=1]',
    '???',
  ]) {
    const parsed = Selector.parse(source);
    assert.equal(
      textOf(getSelectorTextSegments(source, parsed.tokens, parsed.positions)),
      source,
    );
  }
});

test('source ranges select a successful unit without rendering neighboring branches', () => {
  const source = '([text="取消"]) || ([parent=null] >n [text="预约"])';
  const parsed = Selector.parse(source);
  const start = source.indexOf('[parent');
  const range = { start, end: source.length - 1 };
  assert.equal(
    textOf(
      getSelectorTextSegments(source, parsed.tokens, parsed.positions, range),
    ),
    source.slice(range.start, range.end),
  );
  const segments = getSelectorTextSegments(
    source,
    parsed.tokens,
    parsed.positions,
    undefined,
    [range],
  );
  assert.equal(textOf(segments), source);
  assert.equal(
    textOf(segments.filter((s) => s.highlighted)),
    source.slice(range.start, range.end),
  );
  assert.ok(
    segments
      .flatMap((s) => s.tokens)
      .some((t) => t.kind === 'RelationOperator' && t.scope === 'Relation'),
  );
});

import type { SelectorPosition, SelectorToken } from '@gkd-kit/selector';

export interface SelectorTextRange {
  start: number;
  end: number;
}

export const getSelectorTextSegments = (
  source: string,
  tokens: SelectorToken[],
  positions: SelectorPosition[] = [],
  range: SelectorTextRange = { start: 0, end: source.length },
  highlightedRanges: SelectorTextRange[] = [],
) => {
  const start = Math.max(0, range.start);
  const end = Math.min(source.length, range.end);
  const boundaries = new Set([start, end]);
  for (const highlighted of highlightedRanges) {
    if (highlighted.start < end && highlighted.end > start) {
      boundaries.add(Math.max(start, highlighted.start));
      boundaries.add(Math.min(end, highlighted.end));
    }
  }
  const offsets = [...boundaries].sort((a, b) => a - b);
  return offsets.slice(0, -1).map((start, index) => {
    const end = offsets[index + 1];
    return {
      start,
      end,
      highlighted: highlightedRanges.some(
        (r) => r.start <= start && r.end >= end,
      ),
      tokens: tokens
        .filter((t) => t.start < end && t.end > start)
        .map((token) => {
          const tokenStart = Math.max(start, token.start);
          const tokenEnd = Math.min(end, token.end);
          return {
            start: tokenStart,
            end: tokenEnd,
            text: source.slice(tokenStart, tokenEnd),
            kind: token.kind.name,
            scope: token.scope.name,
            positions: positions
              .filter((p) => p.start <= tokenStart && p.end >= tokenEnd)
              .map((p) => p.kind.name)
              .join(' '),
          };
        }),
    };
  });
};

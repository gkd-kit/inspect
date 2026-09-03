import type { SelectorSyntaxDiagnostic } from './selector_diagnostics.ts';

export type SelectorErrorHighlightSegments = {
  before: string;
  error: string;
  after: string;
  eof: boolean;
};

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

export const getSelectorErrorHighlightSegments = (
  source: string,
  diagnostic: SelectorSyntaxDiagnostic,
): SelectorErrorHighlightSegments | null => {
  if (diagnostic.status != 'invalid' || diagnostic.index == null) return null;

  let start = Math.min(
    Math.max(Math.trunc(diagnostic.index), 0),
    source.length,
  );
  if (
    start > 0 &&
    start < source.length &&
    isLowSurrogate(source.charCodeAt(start)) &&
    isHighSurrogate(source.charCodeAt(start - 1))
  ) {
    start -= 1;
  }

  if (start == source.length) {
    return { before: source, error: '', after: '', eof: true };
  }

  const errorLength = isHighSurrogate(source.charCodeAt(start)) ? 2 : 1;
  const end = Math.min(start + errorLength, source.length);
  return {
    before: source.slice(0, start),
    error: source.slice(start, end),
    after: source.slice(end),
    eof: false,
  };
};

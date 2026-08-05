export type TextSearchOptions = {
  matchCase: boolean;
  wholeWord: boolean;
  useRegex: boolean;
};

export type TextMatchRange = {
  start: number;
  end: number;
};

export const createTextSearchOptions = (): TextSearchOptions => ({
  matchCase: false,
  wholeWord: false,
  useRegex: false,
});

const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
};

export const createTextSearchRegExp = (
  query: string,
  options: TextSearchOptions,
  global = true,
) => {
  const actualQuery = query.trim();
  if (!actualQuery) return;
  let source = options.useRegex ? actualQuery : escapeRegExp(actualQuery);
  if (options.wholeWord) {
    const wordCharacter = `[\\p{L}\\p{N}_]`;
    source = `(?<!${wordCharacter})(?:${source})(?!${wordCharacter})`;
  }
  try {
    return new RegExp(
      source,
      `${global ? `g` : ``}${options.matchCase ? `` : `i`}u`,
    );
  } catch {
    return;
  }
};

export const isTextSearchQueryValid = (
  query: string,
  options: TextSearchOptions,
) => {
  return (
    !query.trim() ||
    !options.useRegex ||
    !!createTextSearchRegExp(query, options)
  );
};

export const getTextMatchRanges = (
  value: string,
  query: string,
  options: TextSearchOptions,
): TextMatchRange[] => {
  const regexp = createTextSearchRegExp(query, options);
  if (!regexp) return [];
  const ranges: TextMatchRange[] = [];
  let match: RegExpExecArray | null;
  while ((match = regexp.exec(value))) {
    if (match[0].length) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    } else {
      regexp.lastIndex++;
    }
  }
  return ranges;
};

export const countTextMatches = (
  value: string,
  query: string,
  options: TextSearchOptions,
) => {
  const regexp = createTextSearchRegExp(query, options);
  if (!regexp) return 0;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = regexp.exec(value))) {
    if (match[0].length) count++;
    else regexp.lastIndex++;
  }
  return count;
};

export const countTextLineMatches = (
  value: string,
  query: string,
  options: TextSearchOptions,
) => {
  return value
    .split(/\r\n|\n|\r/)
    .reduce((count, line) => count + countTextMatches(line, query, options), 0);
};

export const matchesTextSearch = (
  value: string,
  query: string,
  options: TextSearchOptions,
) => {
  const regexp = createTextSearchRegExp(query, options, false);
  return regexp?.test(value) || false;
};

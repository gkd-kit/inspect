export default class ExtSyntaxError extends Error {
  constructor(
    public readonly expectedValue: string,
    public readonly position: number,
    public readonly source: string,
  ) {
    super(
      `expected ${expectedValue} in selector at position ${position}, but got ${
        source[position] ?? `null`
      }`,
    );
  }
  static assert(
    source: string,
    offset: number,
    value = '',
    expectedValue: string | null = null,
  ) {
    if (
      offset >= source.length ||
      (value.length > 0 && !value.includes(source[offset]))
    ) {
      throw new ExtSyntaxError(expectedValue ?? value, offset, source);
    }
  }
  static throwError(source: string, offset: number, expectedValue = ''): never {
    throw new ExtSyntaxError(expectedValue, offset, source);
  }
}

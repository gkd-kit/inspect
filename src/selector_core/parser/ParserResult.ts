export default class ParserResult<T> {
  constructor(public readonly data: T, public readonly length = 0) {}
}

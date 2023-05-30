import ParserResult from './ParserResult';

export default class Parser<T> {
  constructor(
    readonly prefix = '',
    private readonly temp: (
      source: string,
      offset: number,
      prefix: string,
    ) => ParserResult<T>,
  ) {}
  invoke(source: string, offset: number) {
    return this.temp(source, offset, this.prefix);
  }
}

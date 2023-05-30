type CompareFc = (a: unknown, b: unknown) => boolean | void;

export default class CompareOperator {
  constructor(
    public readonly key: string,
    public readonly compare: CompareFc = (a, b) => a === b,
  ) {}
  toString() {
    return this.key;
  }
  static allSubClasses: CompareOperator[] = [];
}

const not = (cls: CompareOperator) => {
  return new CompareOperator(`!` + cls.key, (...args) => !cls.compare(...args));
};

const Equal = new CompareOperator(`=`);
const NotEqual = not(Equal);
const Start = new CompareOperator(`^=`, (a, b) => {
  if (typeof a == 'string' && typeof b == 'string') {
    return a.startsWith(b);
  }
});
const NotStart = not(Start);
const Include = new CompareOperator(`*=`, (a, b) => {
  if (typeof a == 'string' && typeof b == 'string') {
    return a.includes(b);
  }
});
const NotInclude = not(Include);
const End = new CompareOperator(`$=`, (a, b) => {
  if (typeof a == 'string' && typeof b == 'string') {
    return a.endsWith(b);
  }
});
const NotEnd = not(End);
const Less = new CompareOperator(`<`, (a, b) => {
  if (typeof a == 'number' && typeof b == 'number') {
    return a < b;
  }
});
const LessEqual = new CompareOperator(`<=`, (a, b) => {
  if (typeof a == 'number' && typeof b == 'number') {
    return a <= b;
  }
});
const More = new CompareOperator(`>`, (a, b) => {
  if (typeof a == 'number' && typeof b == 'number') {
    return a > b;
  }
});
const MoreEqual = new CompareOperator(`>=`, (a, b) => {
  if (typeof a == 'number' && typeof b == 'number') {
    return a >= b;
  }
});

CompareOperator.allSubClasses = [
  Equal,
  NotEqual,
  Start,
  NotStart,
  Include,
  NotInclude,
  End,
  NotEnd,
  Less,
  LessEqual,
  More,
  MoreEqual,
].sort((a, b) => {
  return b.key.length - a.key.length;
});

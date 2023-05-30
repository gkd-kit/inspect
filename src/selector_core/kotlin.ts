export const when = <T>(
  cases: [() => boolean, () => T][],
  _else: () => T,
): T => {
  for (const [match, result] of cases) {
    if (match()) {
      return result();
    }
  }
  return _else();
};

export class Pair<A, B> {
  constructor(public readonly first: A, public readonly second: B) {}
  get destruction() {
    return [this.first, this.second] as const;
  }
}

export const lazyFc = <T extends (...args: any[]) => any>(
  initFc: () => T,
): T => {
  let fc: T | undefined = undefined;
  return ((...args: any[]) => {
    if (!fc) {
      fc = initFc();
    }
    return fc(...args);
  }) as T;
};

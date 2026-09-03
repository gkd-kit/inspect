export const isIntString = (value: string | number | undefined) => {
  if (typeof value === 'number') return true;
  return (
    typeof value === 'string' &&
    Array.prototype.every.call(
      value,
      (character) => character >= '0' && character <= '9',
    )
  );
};

export const toInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const number = Number(value);
    if (Number.isSafeInteger(number)) return number;
  }
};

const zeroNumberPatterns = [/\.0+$/, /0+$/];

export const toFixedNumber = (value: number, fractionDigits: number) => {
  const source = value.toFixed(fractionDigits);
  if (!source.includes('.')) return source;
  for (const pattern of zeroNumberPatterns) {
    if (pattern.test(source)) return source.replace(pattern, '');
  }
  return source;
};

import Selector from '../Selector';
import BinaryExpression from '../data/BinaryExpression';
import CompareOperator from '../data/CompareOperator';
import ConnectOperator from '../data/ConnectOperator';
import ConnectSegment from '../data/ConnectSegment';
import ConnectWrapper from '../data/ConnectWrapper';
import PolynomialExpression from '../data/PolynomialExpression';
import PropertySegment from '../data/PropertySegment';
import PropertyWrapper from '../data/PropertyWrapper';
import { Pair } from '../kotlin';
import ExtSyntaxError from './ExtSyntaxError';
import Parser from './Parser';
import ParserResult from './ParserResult';

const whiteCharParser = new Parser('\u0020\t\r\n', (source, offset, prefix) => {
  let i = offset;
  let data = '';
  while (i < source.length && prefix.includes(source[i])) {
    data += source[i];
    i++;
  }
  return new ParserResult(data, i - offset);
});

const whiteCharStrictParser = new Parser(
  '\u0020\t\r\n',
  (source, offset, prefix) => {
    ExtSyntaxError.assert(source, offset, prefix, 'whitespace');
    return whiteCharParser.invoke(source, offset);
  },
);

const nameParser = new Parser(
  '*1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM_',
  (source, offset, prefix) => {
    let i = offset;
    const s0 = source[i];
    if (s0 && !prefix.includes(s0)) {
      return new ParserResult(``);
    }
    ExtSyntaxError.assert(source, i, prefix, '*0-9a-zA-Z_');
    let data = source[i];
    i++;
    if (data == '*') {
      // 范匹配
      return new ParserResult(data, i - offset);
    }
    const center =
      '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM_.';
    while (i < source.length) {
      //                . 不能在开头和结尾
      if (data[i - offset - 1] == '.') {
        ExtSyntaxError.assert(source, i, prefix, '[0-9a-zA-Z_]');
      }
      if (center.includes(source[i])) {
        data += source[i];
      } else {
        break;
      }
      i++;
    }
    return new ParserResult(data, i - offset);
  },
);

const combinatorOperatorParser = new Parser(
  ConnectOperator.allSubClasses.map((s) => s.key).join(''),
  (source, offset) => {
    const operator =
      ConnectOperator.allSubClasses.find((subOperator) =>
        source.startsWith(subOperator.key, offset),
      ) ?? ExtSyntaxError.throwError(source, offset, 'ConnectOperator');

    return new ParserResult(operator, operator.key.length);
  },
);

const integerParser = new Parser('1234567890', (source, offset, prefix) => {
  let i = offset;
  ExtSyntaxError.assert(source, i, prefix, 'number');
  let s = '';
  while (prefix.includes(source[i])) {
    s += source[i];
    i++;
  }

  return new ParserResult(+s, i - offset);
});

const monomialParser = new Parser('+-1234567890n', (source, offset, prefix) => {
  let i = offset;
  ExtSyntaxError.assert(source, i, prefix);
  /**
   * one of 1, -1
   */
  const signal = (() => {
    if (source[i] == '+') {
      i++;
      return 1;
    }
    if (source[i] == '-') {
      i++;
      return -1;
    }
    return 1;
  })();
  i += whiteCharParser.invoke(source, i).length;
  // [a][n[^b]]
  ExtSyntaxError.assert(source, i, integerParser.prefix + 'n');
  const coefficient =
    (() => {
      if (integerParser.prefix.includes(source[i])) {
        const coefficientResult = integerParser.invoke(source, i);
        i += coefficientResult.length;
        return coefficientResult.data;
      } else {
        return 1;
      }
    })() * signal;
  // [n[^b]]
  if (i < source.length && source[i] == 'n') {
    i++;
    if (i < source.length && source[i] == '^') {
      i++;
      const powerResult = integerParser.invoke(source, i);
      i += powerResult.length;
      return new ParserResult(
        new Pair(powerResult.data, coefficient),
        i - offset,
      );
    } else {
      return new ParserResult(new Pair(1, coefficient), i - offset);
    }
  } else {
    return new ParserResult(new Pair(0, coefficient), i - offset);
  }
});

const expressionParser = new Parser(
  '(0123456789n',
  (source, offset, prefix) => {
    let i = offset;
    ExtSyntaxError.assert(source, i, prefix);
    const monomialResultList = Array<ParserResult<Pair<number, number>>>();
    if (source[i] == '(') {
      i++;
      i += whiteCharParser.invoke(source, i).length;
      ExtSyntaxError.assert(source, i, monomialParser.prefix);
      while (source[i] != ')') {
        if (monomialResultList.length > 0) {
          ExtSyntaxError.assert(source, i, '+-');
        }
        const monomialResult = monomialParser.invoke(source, i);
        monomialResultList.push(monomialResult);
        i += monomialResult.length;
        i += whiteCharParser.invoke(source, i).length;
        if (i >= source.length) {
          ExtSyntaxError.assert(source, i, ')');
        }
      }
      i++;
    } else {
      const monomialResult = monomialParser.invoke(source, i);
      monomialResultList.push(monomialResult);
      i += monomialResult.length;
    }
    const map = new Map<number, number>();
    monomialResultList.forEach((monomialResult) => {
      const [power, coefficient] = monomialResult.data.destruction;
      map.set(power, (map.get(power) ?? 0) + coefficient);
    });
    map.forEach((_, power) => {
      if (power > 1) {
        ExtSyntaxError.throwError(source, offset, 'power must be 0 or 1');
      }
    });
    return new ParserResult(
      new PolynomialExpression(map.get(1) ?? 0, map.get(0) ?? 0),
      i - offset,
    );
  },
);

const combinatorParser = new Parser(
  combinatorOperatorParser.prefix,
  (source, offset) => {
    let i = offset;
    const operatorResult = combinatorOperatorParser.invoke(source, i);
    i += operatorResult.length;
    let expressionResult: ParserResult<PolynomialExpression> | undefined =
      undefined;
    if (i < source.length && expressionParser.prefix.includes(source[i])) {
      expressionResult = expressionParser.invoke(source, i);
      i += expressionResult.length;
    }
    return new ParserResult(
      new ConnectSegment(
        operatorResult.data,
        expressionResult?.data ?? new PolynomialExpression(),
      ),
      i - offset,
    );
  },
);

const attrOperatorParser = new Parser(
  CompareOperator.allSubClasses.map((s) => s.key).join(``),
  (source, offset) => {
    const operator =
      CompareOperator.allSubClasses.find((SubOperator) =>
        source.startsWith(SubOperator.key, offset),
      ) ?? ExtSyntaxError.throwError(source, offset, 'CompareOperator');
    return new ParserResult(operator, operator.key.length);
  },
);

const stringParser = new Parser('`"\'', (source, offset, prefix) => {
  let i = offset;
  ExtSyntaxError.assert(source, i, prefix);
  const startChar = source[i];
  i++;
  let data = '';
  while (source[i] != startChar) {
    if (i == source.length - 1) {
      ExtSyntaxError.assert(source, i, startChar);
      break;
    }
    if (source[i] == '\\') {
      i++;
      ExtSyntaxError.assert(source, i);
      if (source[i] == startChar) {
        data += source[i];
        ExtSyntaxError.assert(source, i + 1);
      } else {
        data += '\\' + source[i].toString();
      }
    } else {
      data += source[i];
    }
    i++;
  }
  i++;
  return new ParserResult(data, i - offset);
});

const propertyParser = new Parser(
  `0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_`,
  (source, offset, prefix) => {
    let i = offset;
    ExtSyntaxError.assert(source, i, prefix);
    let data = source[i].toString();
    i++;
    while (i < source.length) {
      if (!prefix.includes(source[i])) {
        break;
      }
      data += source[i];
      i++;
    }
    return new ParserResult(data, i - offset);
  },
);

const valueParser = new Parser(
  'tfn' + stringParser.prefix + integerParser.prefix,
  (source, offset, prefix) => {
    let i = offset;
    ExtSyntaxError.assert(source, i, prefix);
    const value = (() => {
      if (source[i] == 't') {
        i++;
        [...'rue'].forEach((c) => {
          ExtSyntaxError.assert(source, i, c.toString());
          i++;
        });
        return true;
      } else if (source[i] == 'f') {
        i++;
        [...'alse'].forEach((c) => {
          ExtSyntaxError.assert(source, i, c.toString());
          i++;
        });
        return false;
      } else if (source[i] == 'n') {
        i++;
        [...'ull'].forEach((c) => {
          ExtSyntaxError.assert(source, i, c.toString());
          i++;
        });
        return null;
      } else if (stringParser.prefix.includes(source[i])) {
        const s = stringParser.invoke(source, i);
        i += s.length;
        return s.data;
      } else if (integerParser.prefix.includes(source[i])) {
        const n = integerParser.invoke(source, i);
        i += n.length;
        return n.data;
      } else {
        ExtSyntaxError.throwError(source, i, prefix);
      }
    })();
    return new ParserResult(value, i - offset);
  },
);

const attrParser = new Parser('[', (source, offset, prefix) => {
  let i = offset;
  ExtSyntaxError.assert(source, i, prefix);
  i++;
  const parserResult = propertyParser.invoke(source, i);
  i += parserResult.length;
  const operatorResult = attrOperatorParser.invoke(source, i);
  i += operatorResult.length;
  const valueResult = valueParser.invoke(source, i);
  i += valueResult.length;
  ExtSyntaxError.assert(source, i, ']');
  i++;
  return new ParserResult(
    new BinaryExpression(
      parserResult.data,
      operatorResult.data,
      valueResult.data,
    ),
    i - offset,
  );
});

const selectorUnitParser = new Parser(``, (source, offset) => {
  let i = offset;
  let tracked = false;
  if (source[i] == '@') {
    tracked = true;
    i++;
  }
  const nameResult = nameParser.invoke(source, i);
  i += nameResult.length;
  const attrList = Array<BinaryExpression>();
  while (i < source.length && source[i] == '[') {
    const attrResult = attrParser.invoke(source, i);
    i += attrResult.length;
    attrList.push(attrResult.data);
  }

  if (nameResult.length == 0 && attrList.length == 0) {
    ExtSyntaxError.throwError(source, i, '[');
  }
  return new ParserResult(
    new PropertySegment(tracked, nameResult.data, attrList),
    i - offset,
  );
});

const connectSelectorParser = new Parser(``, (source, offset) => {
  let i = offset;
  i += whiteCharParser.invoke(source, i).length;
  const topSelector = selectorUnitParser.invoke(source, i);
  i += topSelector.length;
  const selectorList = Array<Pair<ConnectSegment, PropertySegment>>();
  while (i < source.length && whiteCharParser.prefix.includes(source[i])) {
    i += whiteCharStrictParser.invoke(source, i).length;
    const combinator = (() => {
      if (combinatorParser.prefix.includes(source[i])) {
        const combinatorResult = combinatorParser.invoke(source, i);
        i += combinatorResult.length;
        i += whiteCharStrictParser.invoke(source, i).length;
        return combinatorResult.data;
      } else {
        return new ConnectSegment(undefined, new PolynomialExpression(1, 0));
      }
    })();
    const selectorResult = selectorUnitParser.invoke(source, i);
    i += selectorResult.length;
    selectorList.push(new Pair(combinator, selectorResult.data));
  }
  return new ParserResult(new Pair(topSelector.data, selectorList), i - offset);
});

const endParser = new Parser(``, (source, offset) => {
  if (offset != source.length) {
    ExtSyntaxError.throwError(source, offset, 'end');
  }
  return new ParserResult(undefined, 0);
});

export const selectorParser = (source: string) => {
  let i = 0;
  i += whiteCharParser.invoke(source, i).length;
  const combinatorSelectorResult = connectSelectorParser.invoke(source, i);
  i += combinatorSelectorResult.length;
  i += whiteCharParser.invoke(source, i).length;
  i += endParser.invoke(source, i).length;
  const data = combinatorSelectorResult.data;
  const propertySelectorList = Array<PropertySegment>();
  const combinatorSelectorList = Array<ConnectSegment>();
  propertySelectorList.push(data.first);
  data.second.forEach((it) => {
    propertySelectorList.push(it.second);
    combinatorSelectorList.push(it.first);
  });
  const wrapperList = Array(new PropertyWrapper(propertySelectorList[0]));
  combinatorSelectorList.forEach((combinatorSelector, index) => {
    const combinatorSelectorWrapper = new ConnectWrapper(
      combinatorSelector,
      wrapperList.at(-1)!,
    );
    const propertySelectorWrapper = new PropertyWrapper(
      propertySelectorList[index + 1],
      combinatorSelectorWrapper,
    );
    wrapperList.push(propertySelectorWrapper);
  });
  return new Selector(wrapperList.at(-1)!);
};

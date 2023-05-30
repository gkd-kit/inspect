import Selector from './Selector';

[
  `A >n [a=1]`,
  'A[a*=1][a^=null][b!=`1234`]',
  `A < B > C + D - F`,
  `A B >n C`,
  `A +(n+1) C`,
  `[a>=1][b>1]`,
].forEach((s) => {
  console.log([s, Selector.parse(s).toString()]);
});

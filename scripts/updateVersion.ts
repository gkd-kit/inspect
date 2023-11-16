import fs from 'node:fs/promises';
import type selfPkgT from '../package.json';

const selfPkg: typeof selfPkgT = JSON.parse(
  await fs.readFile(process.cwd() + '/package.json', 'utf-8'),
);

selfPkg.version = `0.0.` + Date.now();

await fs.writeFile(
  process.cwd() + '/package.json',
  JSON.stringify(selfPkg, undefined, 2),
  'utf-8',
);

console.log(`change package.json version to ` + selfPkg.version);

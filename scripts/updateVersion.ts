import fs from 'node:fs/promises';
import type selfPkgT from '../package.json';
import process from 'node:process';

const selfPkg: typeof selfPkgT = JSON.parse(
  await fs.readFile(process.cwd() + '/package.json', 'utf-8'),
);
selfPkg.version =
  selfPkg.version.split('.').slice(0, 2).join('.') + '.' + Date.now();

await fs.writeFile(
  process.cwd() + '/package.json',
  JSON.stringify(selfPkg, undefined, 2),
  'utf-8',
);

console.log(`change package.json version to ` + selfPkg.version);

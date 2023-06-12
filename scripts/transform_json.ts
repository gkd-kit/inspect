import path from 'node:path';
import fs from 'node:fs/promises';

async function* walk(dirPath: string) {
  const pathnameList = (await fs.readdir(dirPath)).map((s) =>
    path.join(dirPath, s),
  );
  while (pathnameList.length > 0) {
    const pathname = pathnameList.pop()!;
    const state = await fs.lstat(pathname);
    if (state.isFile()) {
      yield pathname;
    } else if (state.isDirectory()) {
      pathnameList.push(
        ...(await fs.readdir(pathname)).map((s) => path.join(pathname, s)),
      );
    }
  }
}
const dir = `D:/User/Downloads/gkd/old-data-2`;

for await (const fp of walk(dir)) {
  if (!fp.endsWith(`.json`)) continue;
  const oldData: {
    overview: any;
    device: any;
    nodes: any;
  } = JSON.parse(await fs.readFile(fp, `utf-8`));
  if (!oldData.overview) break;
  const newData = {
    ...oldData.overview,
    ...oldData.device,
    nodes: oldData.nodes,
  };
  await fs.writeFile(fp, JSON.stringify(newData));
  // break;
}

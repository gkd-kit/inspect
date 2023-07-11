import type { Plugin } from 'vite';
import { simpleGit } from 'simple-git';

export const commit = (): Plugin => {
  return {
    name: `commit`,
    resolveId(source) {
      if (source == `virtual:commit`) return `\0` + source;
    },
    async load(id) {
      if (id == `\0` + `virtual:commit`) {
        const latestLog = (await simpleGit().log({ maxCount: 1 })).latest;
        return `export default ` + JSON.stringify(latestLog, void 0, 2);
      }
    },
  };
};

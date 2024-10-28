import { simpleGit } from 'simple-git';

const latestLog = (await simpleGit().log({ maxCount: 1 })).latest!;

const commitLog =
  `GIT commit\n` +
  Object.entries(latestLog)
    .filter(([_, value]: [string, string]) => String(value || ``).trim())
    .map(([key, value]) => {
      return key + ': ' + value;
    })
    .join('\n');

export default commitLog;

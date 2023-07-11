import latestLog from 'virtual:commit';

export const commitLog =
  `GIT commit\n` +
  Object.entries(latestLog)
    .map(([key, value]) => {
      return key + ': ' + value;
    })
    .join('\n');

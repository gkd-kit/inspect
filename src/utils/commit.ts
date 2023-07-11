import latestLog from 'virtual:commit';

export const commitLog =
  `GIT commit\n` +
  Object.entries(latestLog)
    .filter(([_, value]: [string, string]) => String(value || ``).trim())
    .map(([key, value]) => {
      return key + ': ' + value;
    })
    .join('\n');

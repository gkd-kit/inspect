import { isLogVersionPath } from './source_links.ts';

type Entry = { path: string };

const findPath = <T extends Entry>(entries: readonly T[], path: string) =>
  entries.find((entry) => entry.path.toLowerCase() == path);

export const getArchiveVersionEntries = <T extends Entry>(
  entries: readonly T[],
) => {
  const metadata = findPath(entries, `metadata/gkd.json`);
  return metadata
    ? [metadata]
    : entries.filter((entry) => isLogVersionPath(entry.path));
};

export const getArchiveBuildEntry = <T extends Entry>(entries: readonly T[]) =>
  findPath(entries, `metadata/gkd.json`) ?? findPath(entries, `gkd.json`);

export const getArchiveSourcePathsEntry = <T extends Entry>(
  entries: readonly T[],
) =>
  findPath(
    entries,
    findPath(entries, `metadata/gkd.json`)
      ? `metadata/source-paths.txt`
      : `source-paths.txt`,
  );

export const getArchiveAppsEntry = <T extends Entry>(entries: readonly T[]) =>
  findPath(entries, `metadata/apps.json`) ??
  entries.find((entry) => {
    const path = entry.path.toLowerCase();
    return path == `apps.json` || path.endsWith(`/apps.json`);
  });

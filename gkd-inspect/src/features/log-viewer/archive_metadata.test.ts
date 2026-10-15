import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getArchiveAppsEntry,
  getArchiveBuildEntry,
  getArchiveSourcePathsEntry,
  getArchiveVersionEntries,
} from './archive_metadata.ts';
import { parseLogBuildKey, parseLogVersionInfo } from './source_links.ts';

const entries = (...paths: string[]) => paths.map((path) => ({ path }));
test(`旧包保留根目录版本及旧应用文件查询`, () => {
  const files = entries(
    `gkd.json`,
    `gkd-1.12.1.json`,
    `source-paths.txt`,
    `nested/apps.json`,
    `log/gkd.json`,
  );
  assert.deepEqual(getArchiveVersionEntries(files), files.slice(0, 2));
  assert.equal(getArchiveBuildEntry(files), files[0]);
  assert.equal(getArchiveSourcePathsEntry(files), files[2]);
  assert.equal(getArchiveAppsEntry(files), files[3]);
});
test(`混合包优先新版元信息且不混用旧源码路径`, () => {
  const files = entries(
    `gkd.json`,
    `source-paths.txt`,
    `apps.json`,
    `METADATA/GKD.JSON`,
    `metadata/apps.json`,
    `metadata/source-paths.txt`,
  );
  assert.deepEqual(getArchiveVersionEntries(files), [files[3]]);
  assert.equal(getArchiveBuildEntry(files), files[3]);
  assert.equal(getArchiveAppsEntry(files), files[4]);
  assert.equal(getArchiveSourcePathsEntry(files), files[5]);
  assert.equal(getArchiveSourcePathsEntry(files.slice(0, 5)), undefined);
});
test(`空构建标识和损坏新版元信息不借用旧数据`, () => {
  const files = [
    { path: `gkd.json`, raw: `{"buildKey":"old"}` },
    { path: `metadata/gkd.json`, raw: `{"buildKey":""}` },
  ];
  assert.equal(parseLogBuildKey(getArchiveBuildEntry(files)!.raw), undefined);
  files[1].raw = `{`;
  assert.equal(
    parseLogVersionInfo(getArchiveVersionEntries(files)[0].raw),
    undefined,
  );
  assert.equal(getArchiveBuildEntry([]), undefined);
  assert.deepEqual(getArchiveVersionEntries([]), []);
});

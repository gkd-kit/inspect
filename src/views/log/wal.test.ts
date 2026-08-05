import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  getSqliteSnapshotSize,
  materializeWalSnapshot,
  MAX_SQLITE_SNAPSHOT_SIZE,
} from './wal.ts';

test(`拒绝 WAL 声明的超大数据库快照`, () => {
  assert.equal(getSqliteSnapshotSize(1, 4096), 4096);
  assert.throws(
    () => getSqliteSnapshotSize(MAX_SQLITE_SNAPSHOT_SIZE / 4096 + 1, 4096),
    /超过可预览上限/,
  );
});

test(`拒绝非法的 SQLite 页大小`, () => {
  const database = new Uint8Array(100);
  database.set(new TextEncoder().encode(`SQLite format 3\0`));
  new DataView(database.buffer).setUint16(16, 2);
  assert.throws(() => materializeWalSnapshot(database), /页大小无效/);
});

test(`合并 WAL 中最后一个完整事务`, () => {
  const directory = mkdtempSync(join(tmpdir(), `gkd-log-wal-`));
  const databasePath = join(directory, `fixture.db`);
  const mergedPath = join(directory, `merged.db`);
  const mainOnlyPath = join(directory, `main-only.db`);
  const liveDatabase = new DatabaseSync(databasePath);
  try {
    liveDatabase.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA wal_autocheckpoint = 0;
      CREATE TABLE event(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      INSERT INTO event(name) VALUES ('checkpointed');
      PRAGMA wal_checkpoint(TRUNCATE);
      INSERT INTO event(name) VALUES ('wal-1'), ('wal-2');
    `);
    const mainFile = new Uint8Array(readFileSync(databasePath));
    const walFile = new Uint8Array(readFileSync(`${databasePath}-wal`));

    const mainOnly = materializeWalSnapshot(mainFile);
    writeFileSync(mainOnlyPath, mainOnly);
    const mainOnlyDatabase = new DatabaseSync(mainOnlyPath, { readOnly: true });
    assert.equal(
      mainOnlyDatabase.prepare(`SELECT COUNT(*) AS count FROM event`).get()
        ?.count,
      1,
    );
    mainOnlyDatabase.close();

    const merged = materializeWalSnapshot(mainFile, walFile);
    writeFileSync(mergedPath, merged);
    const mergedDatabase = new DatabaseSync(mergedPath, { readOnly: true });
    assert.equal(
      mergedDatabase.prepare(`SELECT COUNT(*) AS count FROM event`).get()
        ?.count,
      3,
    );
    mergedDatabase.close();

    const corruptWal = walFile.slice();
    corruptWal[32 + 24] ^= 0xff;
    assert.throws(
      () => materializeWalSnapshot(mainFile, corruptWal),
      /没有完整的已提交事务|校验失败/,
    );
  } finally {
    liveDatabase.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

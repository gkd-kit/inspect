import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { assertSafeZipStructure } from './zip_limits.ts';

test(`ZIP 中央目录在解压前执行条目数和声明大小限制`, async () => {
  const zip = new JSZip();
  zip.file(`a.txt`, `hello`);
  zip.file(`b.txt`, `world`);
  const data = await zip.generateAsync({ type: `uint8array` });

  assert.deepEqual(
    assertSafeZipStructure(data, {
      maxEntries: 2,
      maxEntryNameSize: 1024,
      maxUncompressedSize: 10,
    }),
    { entryCount: 2, totalUncompressedSize: 10 },
  );
  assert.throws(
    () =>
      assertSafeZipStructure(data, {
        maxEntries: 1,
        maxEntryNameSize: 1024,
        maxUncompressedSize: 10,
      }),
    /条目数量不能超过/,
  );
  assert.throws(
    () =>
      assertSafeZipStructure(data, {
        maxEntries: 2,
        maxEntryNameSize: 1024,
        maxUncompressedSize: 9,
      }),
    /解压后总大小超过限制/,
  );
});

test(`ZIP 条目路径在解析前执行长度限制`, async () => {
  const zip = new JSZip();
  zip.file(`${`a`.repeat(1025)}.txt`, ``);
  const data = await zip.generateAsync({ type: `uint8array` });
  assert.throws(
    () =>
      assertSafeZipStructure(data, {
        maxEntries: 2,
        maxEntryNameSize: 1024,
        maxUncompressedSize: 10,
      }),
    /路径过长/,
  );
});

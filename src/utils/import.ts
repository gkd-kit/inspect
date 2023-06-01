import { fileOpen } from 'browser-fs-access';
import { message } from './discrete';
import { loadAsync } from 'jszip';
import type { Snapshot } from './types';
import { importStore, storage } from './storage';
import { enhanceFetch } from './fetch';
import { isPngBf, isZipBf } from './file_type';

function splitArrayBuffer(
  arrayBuffer: ArrayBuffer,
  delimiter: ArrayBuffer,
  limit?: number,
): ArrayBuffer[] {
  const view = new Uint8Array(arrayBuffer);
  const delimiterView = new Uint8Array(delimiter);
  const delimiterLength = delimiterView.length;

  const parts: ArrayBuffer[] = [];
  let startIndex = 0;
  let delimiterIndex = -1;
  let count = 0;

  for (let i = 0; i < view.length; i++) {
    if (view[i] === delimiterView[0]) {
      delimiterIndex = 0;
      for (let j = 1; j < delimiterLength; j++) {
        if (view[i + j] !== delimiterView[j]) {
          delimiterIndex = -1;
          break;
        }
      }
      if (delimiterIndex === 0) {
        const part = arrayBuffer.slice(startIndex, i);
        parts.push(part);
        startIndex = i + delimiterLength;
        i += delimiterLength - 1;
        count++;

        if (limit && count === Math.abs(limit)) {
          break;
        }
      }
    }
  }

  if (startIndex < view.length) {
    const part = arrayBuffer.slice(startIndex);
    parts.push(part);
  }

  return parts;
}

const pngEndBf = new Uint8Array([
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]).buffer;
const decoder = new TextDecoder();

export const importFromLocal = async () => {
  const files = await fileOpen({
    multiple: true,
    mimeTypes: [`image/png`, `application/zip`],
  });
  const zipfiles = files.filter((f) => f.name.endsWith(`.zip`));
  const pngfiles = files.filter((f) => f.name.endsWith(`.png`));
  if (zipfiles.length == 0 && pngfiles.length == 0) {
    message.warning(`没有发现可导入文件`);
    return;
  }
  let importNum = 0;
  if (zipfiles.length > 0) {
    await Promise.any(
      zipfiles.map(async (file) => {
        const zip = await loadAsync(file);
        const snapshotFile = zip.file(`snapshot.json`);
        const screenshotFile = zip.file(`screenshot.png`);
        if (!snapshotFile || !screenshotFile) {
          return;
        }
        const snapshot = JSON.parse(
          await snapshotFile.async('string'),
        ) as Snapshot;
        const screenshotBf = await screenshotFile.async('arraybuffer');
        await storage.setSnapshot(snapshot);
        await storage.setScreenshot(snapshot.id, screenshotBf);
        importNum++;
      }),
    );
  }
  if (pngfiles.length > 0) {
    await Promise.any(
      pngfiles.map(async (file) => {
        const bf = await file.arrayBuffer();
        const [tempPngBf, jsonBf] = splitArrayBuffer(bf, pngEndBf, 2);
        if (!jsonBf) return;
        const screenshotBf = await new Blob([
          tempPngBf,
          pngEndBf,
        ]).arrayBuffer();
        const snapshot = JSON.parse(decoder.decode(jsonBf)) as Snapshot;
        // snapshot.id = new Date().getTime();
        await storage.setSnapshot(snapshot);
        await storage.setScreenshot(snapshot.id, screenshotBf);
        importNum++;
      }),
    );
  }
  if (importNum > 0) {
    message.success(`导入${importNum}条记录`);
  } else {
    message.warning(`没有发现可导入记录`);
  }
};

export const importFromNetwork = async (urls: string[] | string = []) => {
  if (typeof urls == 'string') {
    urls = [urls];
  }
  if (urls.length == 0) {
    return;
  }
  urls = [...new Set(urls)];
  let importNum = 0;
  const result = await Promise.allSettled(
    urls.map(async (url) => {
      const snapshotId = importStore[url];
      if (snapshotId) {
        const snapshot = await storage.getSnapshot(snapshotId);
        if (snapshot) {
          importNum++;
          return snapshot;
        }
      }
      const resp = await enhanceFetch(url).catch((e) => {
        message.error(`网络异常: ${new URL(url).host}/${e.message || ''}`);
        console.warn([`download failed`, url, e]);
        throw e;
      });
      const bf = await resp.arrayBuffer();
      let snapshot: Snapshot;
      let screenshotBf: ArrayBuffer;
      if (isPngBf(bf)) {
        const [tempPngBf, jsonBf] = splitArrayBuffer(bf, pngEndBf, 2);
        if (!jsonBf) return;
        screenshotBf = await new Blob([tempPngBf, pngEndBf]).arrayBuffer();
        snapshot = JSON.parse(decoder.decode(jsonBf)) as Snapshot;
      } else if (isZipBf(bf)) {
        const zip = await loadAsync(bf);
        const snapshotFile = zip.file(`snapshot.json`);
        const screenshotFile = zip.file(`screenshot.png`);
        if (!snapshotFile || !screenshotFile) {
          return;
        }
        screenshotBf = await screenshotFile.async('arraybuffer');
        snapshot = JSON.parse(await snapshotFile.async('string')) as Snapshot;
      } else {
        throw new Error(`file must be png or zip`);
      }
      await storage.setSnapshot(snapshot);
      await storage.setScreenshot(snapshot.id, screenshotBf);
      importNum++;
      return snapshot;
    }),
  );
  if (importNum > 0) {
    message.success(`导入${importNum}条记录`);
  } else {
    message.warning(`没有发现可导入记录`);
  }
  return result;
};

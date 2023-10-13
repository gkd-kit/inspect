import { fileOpen } from 'browser-fs-access';
import JSZip, { loadAsync } from 'jszip';
import pLimit from 'p-limit';
import { message } from './discrete';
import { enhanceFetch } from './fetch';
import { isZipBf } from './file_type';
import { setSnapshot, snapshotStorage, urlStorage } from './storage';
import type { Snapshot } from './types';

const parseZip = async (zip: JSZip) => {
  const snapshotFile = zip.filter((s) => s.endsWith(`.json`))[0];
  const screenshotFile = zip.filter((s) => s.endsWith(`.png`))[0];
  if (!snapshotFile || !screenshotFile) {
    return false;
  }
  const snapshot = JSON.parse(await snapshotFile.async('string')) as Snapshot;
  const screenshotBf = await screenshotFile.async('arraybuffer');
  await setSnapshot(snapshot, screenshotBf);
  return true;
};

export const importFromLocal = async () => {
  const files = await fileOpen({
    multiple: true,
    mimeTypes: [`application/zip`],
  });
  const zipfiles = files.filter((f) => f.name.endsWith(`.zip`));
  if (zipfiles.length == 0) {
    message.warning(`没有发现可导入文件`);
    return;
  }
  let importNum = 0;
  if (zipfiles.length > 0) {
    await Promise.any(
      zipfiles.map(async (file) => {
        const zip = await loadAsync(file);
        if (await parseZip(zip)) {
          importNum++;
        }
        const subZips = zip.filter((s) => s.endsWith('.zip'));
        if (subZips.length > 0) {
          await Promise.any(
            subZips.map(async (subZip) => {
              const subFile = await loadAsync(subZip.async('blob'));
              if (await parseZip(subFile)) {
                importNum++;
              }
            }),
          );
        }
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
  const limit = pLimit(2);
  let importNum = 0;
  const result = await Promise.allSettled(
    urls.map((url) => {
      return limit(async () => {
        const snapshotId = urlStorage[url];
        if (snapshotId) {
          const snapshot = await snapshotStorage.getItem(snapshotId);
          if (snapshot) {
            importNum++;
            return snapshot;
          }
        }
        const resp = await enhanceFetch(url, undefined, { proxy: true }).catch(
          (e) => {
            message.error(`网络异常: ${new URL(url).host}/${e.message || ''}`);
            console.warn([`download failed`, url, e]);
            throw e;
          },
        );
        const bf = await resp.arrayBuffer();
        let snapshot: Snapshot;
        let screenshotBf: ArrayBuffer;
        if (isZipBf(bf)) {
          const zip = await loadAsync(bf);
          const [snapshotFile] = zip.filter((p) => p.endsWith(`.json`));
          const [screenshotFile] = zip.filter((p) => p.endsWith(`.png`));
          if (!snapshotFile || !screenshotFile) {
            return;
          }
          screenshotBf = await screenshotFile.async('arraybuffer');
          snapshot = JSON.parse(await snapshotFile.async('string')) as Snapshot;
        } else {
          throw new Error(`file must be png or zip`);
        }
        await setSnapshot(snapshot, screenshotBf);
        importNum++;
        return snapshot;
      });
    }),
  );
  if (importNum == 0) {
    message.warning(`没有发现可导入记录`);
  } else if (importNum == urls.length) {
    message.success(`导入${importNum}条快照`);
  } else if (importNum < urls.length) {
    message.success(`导入${importNum}条快照，失败${urls.length - importNum}`);
  }
  return result;
};

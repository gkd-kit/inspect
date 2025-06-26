import { fileOpen } from 'browser-fs-access';
import pLimit from 'p-limit';
import { message } from './discrete';
import { enhanceFetch } from './fetch';
import { isZipBf } from './file_type';
import { setSnapshot, snapshotStorage } from './snapshot';
import { getImportFileUrl, getImportId } from './url';
import { loadAsync } from './chunk';
import type { JSZipType } from './chunk';

const parseZip = async (zip: JSZipType) => {
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

export const importFromLocal = async (
  _files: File[] | undefined,
): Promise<boolean> => {
  const files =
    _files ??
    (await fileOpen({
      multiple: true,
      mimeTypes: [`application/zip`],
    }));
  const zipfiles = files.filter((f) => f.name.endsWith(`.zip`));
  if (zipfiles.length == 0) {
    message.warning(`没有发现可导入文件`);
    return false;
  }
  let importNum = 0;
  if (zipfiles.length > 0) {
    await Promise.allSettled(
      zipfiles.map(async (file) => {
        const zip = await loadAsync(file);
        if (await parseZip(zip)) {
          importNum++;
        }
        const subZips = zip.filter((s) => s.endsWith('.zip'));
        if (subZips.length > 0) {
          await Promise.allSettled(
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
  return importNum > 0;
};

const limit = pLimit(2);
export const importFromNetwork = async (
  urls: string[] | string = [],
): Promise<Snapshot[] | undefined> => {
  if (typeof urls == 'string') {
    urls = [urls];
  }
  if (urls.length == 0) {
    return;
  }
  urls = urls.map((url) => {
    const importId = getImportId(url);
    if (importId) {
      return getImportFileUrl(importId);
    }
    return url;
  });
  urls = [...new Set(urls)];
  const snapshots: Snapshot[] = [];
  await Promise.allSettled(
    urls.map((url) => {
      return limit(async () => {
        const snapshotId = importSnapshotId[getImportId(url) || ''];
        if (snapshotId) {
          const snapshot = await snapshotStorage.getItem(snapshotId);
          if (snapshot) {
            snapshots.push(snapshot);
            return snapshot;
          }
        }
        const resp = await enhanceFetch(url).catch((e) => {
          message.error(`网络异常: ${new URL(url).host} / ${e.message || ''}`);
          console.warn([`download failed`, url, e]);
          throw e;
        });
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
        snapshots.push(snapshot);
        return snapshot;
      });
    }),
  );
  const num = snapshots.length;
  if (num == 0) {
    message.warning(`没有发现可导入记录`);
    return;
  } else if (num == urls.length) {
    message.success(`导入${num}条快照`);
  } else if (num < urls.length) {
    message.success(`导入${num}条快照，失败${urls.length - num}`);
  }
  return snapshots;
};

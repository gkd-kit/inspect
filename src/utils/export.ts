import Compressor from 'compressorjs';
import { saveAs } from 'file-saver';
import pLimit from 'p-limit';
import { JSZipAsync } from './chunk';
import { uploadAsset } from './github';
import { delay } from './others';
import { screenshotStorage, snapshotStorage } from './snapshot';
import { getImageId } from './url';
import { detectRemoteSnapshot } from './workers';

const snapshotAsZip = async (snapshot: Snapshot) => {
  if (!snapshot.nodes.length) {
    snapshot = (await snapshotStorage.getItem(snapshot.id)) || snapshot;
  }
  const zip = new (await JSZipAsync)();
  zip
    .file(`snapshot.json`, JSON.stringify(snapshot))
    .file(`screenshot.png`, (await screenshotStorage.getItem(snapshot.id))!);
  const content = await zip.generateAsync({
    type: 'blob',
    compression: `STORE`,
  });
  return content;
};

export const exportSnapshotAsZip = async (snapshot: Snapshot) => {
  const fileName = `snapshot-${snapshot.id}.zip`;
  saveAs(await snapshotAsZip(snapshot), fileName);
};

export const exportSnapshotAsImage = async (snapshot: Snapshot) => {
  const fileName = `snapshot-${snapshot.id}.png`;
  saveAs(
    // 移除固定 image/png MIME，浏览器自动识别二进制格式
    new Blob([(await screenshotStorage.getItem(snapshot.id))!]),
    fileName,
  );
};

export const batchImageDownloadZip = async (snapshots: Snapshot[]) => {
  const zip = new (await JSZipAsync)();
  for (const snapshot of snapshots) {
    await delay();
    zip.file(
      snapshot.id + `.png`,
      new Blob([(await screenshotStorage.getItem(snapshot.id))!]),
    );
  }
  const batchZipFile = await zip.generateAsync({
    type: 'blob',
    compression: `STORE`,
  });
  saveAs(batchZipFile, `batch-png-${Date.now()}.zip`);
};

export const batchZipDownloadZip = async (snapshots: Snapshot[]) => {
  const zip = new (await JSZipAsync)();
  for (const snapshot of snapshots) {
    await delay();
    zip.file(snapshot.id + `.zip`, await snapshotAsZip(snapshot));
  }
  const batchZipFile = await zip.generateAsync({
    type: 'blob',
    compression: `STORE`,
  });
  saveAs(batchZipFile, `batch-zip-${Date.now()}.zip`);
};

const comporessPngToJpg = async (imgBf: ArrayBuffer): Promise<Blob> => {
  const view = new Uint8Array(imgBf);
  let mime = 'image/png';
  if (
    view.length >= 12 &&
    view[0] === 0x52 &&
    view[1] === 0x49 &&
    view[2] === 0x46 &&
    view[3] === 0x46 &&
    view[8] === 0x57 &&
    view[9] === 0x45 &&
    view[10] === 0x42 &&
    view[11] === 0x50
  ) {
    mime = 'image/webp';
  }
  return new Promise<Blob>((res, rej) => {
    const blob = new Blob([imgBf], { type: mime });
    new Compressor(blob, {
      quality: 0.75,
      convertSize: 200_000,
      success: res,
      error: rej,
    });
  });
};

export const exportSnapshotAsImageId = async (snapshot: Snapshot) => {
  return (
    snapshotImageId[snapshot.id] ??
    uploadAsset(
      await comporessPngToJpg((await screenshotStorage.getItem(snapshot.id))!),
      'file.jpg',
    ).then((r) => {
      const imageId = getImageId(r.href);
      if (!imageId) {
        throw new Error('imageId not found');
      }
      snapshotImageId[snapshot.id] = imageId;
      return imageId;
    })
  );
};

export const exportSnapshotAsImportId = async (snapshot: Snapshot) => {
  return (
    snapshotImportId[snapshot.id] ||
    uploadAsset(
      await snapshotAsZip(snapshot).then((r) => r.arrayBuffer()),
      'file.zip',
    ).then((r) => {
      snapshotImportId[snapshot.id] = r.id;
      importSnapshotId[r.id] = snapshot.id;
      void detectFetchSnapshot(snapshot.id, r.id).catch(() => undefined);
      return r.id;
    })
  );
};

export const batchCreateImageId = async (snapshots: Snapshot[]) => {
  const limit = pLimit(3);
  return (
    await Promise.allSettled(
      snapshots.map((s) => limit(() => exportSnapshotAsImageId(s))),
    )
  ).reduce<string[]>((p, c) => {
    if (c.status == 'fulfilled') {
      p.push(c.value);
    }
    return p;
  }, []);
};
export const batchCreateZipUrl = async (snapshots: Snapshot[]) => {
  const limit = pLimit(3);
  return (
    await Promise.allSettled(
      snapshots.map((s) => limit(() => exportSnapshotAsImportId(s))),
    )
  ).reduce<number[]>((p, c) => {
    if (c.status == 'fulfilled') {
      p.push(c.value);
    }
    return p;
  }, []);
};

const detectFetchSnapshot = async (id: number, importId: number | string) => {
  return detectRemoteSnapshot(id, +importId);
};

export const detectSnapshot = async (
  id: number,
  importId: number | string | undefined,
) => {
  if (!importId) return;
  if (!Number.isSafeInteger(+importId)) {
    return;
  }
  if (importSnapshotId[importId]) {
    return;
  }
  await detectFetchSnapshot(id, importId).catch(() => undefined);
};

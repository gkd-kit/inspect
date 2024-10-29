import { saveAs } from 'file-saver';
import pLimit from 'p-limit';
import { uploadAsset } from './github';
import { delay } from './others';
import { screenshotStorage } from './snapshot';
import Compressor from 'compressorjs';
import type { Snapshot } from './types';
import { getImageId } from './url';
import { JSZipAsync } from './chunk';

export const snapshotAsZip = async (snapshot: Snapshot) => {
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

export const snapshotAsJpg = async (snapshot: Snapshot) => {
  const imgBf = (await screenshotStorage.getItem(snapshot.id))!;
  const jpgBlob = await new Promise<Blob>((res, rej) => {
    new Compressor(new Blob([imgBf], { type: 'image/png' }), {
      quality: 0.75,
      convertSize: 200_000,
      success(file) {
        res(file);
      },
      error(error) {
        rej(error);
      },
    });
  });
  const content = new Blob([jpgBlob], { type: 'image/jpeg' });
  return content;
};

export const exportSnapshotAsJpg = async (snapshot: Snapshot) => {
  const fileName = `snapshot-${snapshot.id}.jpg`;
  saveAs(await snapshotAsJpg(snapshot), fileName);
};

export const batchJpgDownloadZip = async (snapshots: Snapshot[]) => {
  const zip = new (await JSZipAsync)();
  for (const snapshot of snapshots) {
    await delay();
    zip.file(snapshot.id + `.jpg`, snapshotAsJpg(snapshot));
  }
  const batchZipFile = await zip.generateAsync({
    type: 'blob',
    compression: `STORE`,
  });
  saveAs(batchZipFile, `batch-png-${snapshots.length}.zip`);
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
  saveAs(batchZipFile, `batch-zip-${snapshots.length}.zip`);
};

export const exportSnapshotAsImageId = async (snapshot: Snapshot) => {
  const { snapshotImageId } = useStorageStore();
  return (
    snapshotImageId[snapshot.id] ??
    uploadAsset(
      await snapshotAsJpg(snapshot).then((r) => r.arrayBuffer()),
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
  const { snapshotImportId, importSnapshotId } = useStorageStore();
  return (
    snapshotImportId[snapshot.id] ||
    uploadAsset(
      await snapshotAsZip(snapshot).then((r) => r.arrayBuffer()),
      'file.zip',
    ).then((r) => {
      snapshotImportId[snapshot.id] = r.id;
      importSnapshotId[r.id] = snapshot.id;
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

export const detectSnapshot = async (importId: number | string) => {
  if (!Number.isSafeInteger(+importId)) {
    return;
  }
  const { importSnapshotId, waitInit } = useStorageStore();
  await waitInit();
  if (importSnapshotId[importId]) {
    return;
  }
  await fetch(`https://detect.gkd.li/api/detectSnapshot?importId=` + importId);
};

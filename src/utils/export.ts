import { saveAs } from 'file-saver';
import pLimit from 'p-limit';
import { uploadAsset } from './github';
import { delay, obj2usp } from './others';
import { screenshotStorage, snapshotStorage } from './snapshot';
import Compressor from 'compressorjs';
import type { Snapshot } from './types';
import { getImageId } from './url';
import { JSZipAsync } from './chunk';

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
    new Blob([(await screenshotStorage.getItem(snapshot.id))!], {
      type: 'image/png',
    }),
    fileName,
  );
};

export const batchImageDownloadZip = async (snapshots: Snapshot[]) => {
  const zip = new (await JSZipAsync)();
  for (const snapshot of snapshots) {
    await delay();
    zip.file(
      snapshot.id + `.png`,
      new Blob([(await screenshotStorage.getItem(snapshot.id))!], {
        type: 'image/png',
      }),
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
  return new Promise<Blob>((res, rej) => {
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
};

export const exportSnapshotAsImageId = async (snapshot: Snapshot) => {
  const { snapshotImageId } = useStorageStore();
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
  const { snapshotImportId, importSnapshotId } = useStorageStore();
  return (
    snapshotImportId[snapshot.id] ||
    uploadAsset(
      await snapshotAsZip(snapshot).then((r) => r.arrayBuffer()),
      'file.zip',
    ).then((r) => {
      snapshotImportId[snapshot.id] = r.id;
      importSnapshotId[r.id] = snapshot.id;
      detectFetchSnapshot(snapshot.id, r.id);
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
  return fetch(
    `https://detect.gkd.li/api/detectSnapshot?` +
      obj2usp({
        id,
        importId,
      }).toString(),
  );
};
export const detectSnapshot = async (
  id: number,
  importId: number | string | undefined,
) => {
  if (!importId) return;
  if (!Number.isSafeInteger(+importId)) {
    return;
  }
  const { importSnapshotId, waitInit } = useStorageStore();
  await waitInit();
  if (importSnapshotId[importId]) {
    return;
  }
  await detectFetchSnapshot(id, importId);
};

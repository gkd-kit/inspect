import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import pLimit from 'p-limit';
import { uploadPoliciesAssets } from './github';
import { delay } from './others';
import {
  githubPngStorage,
  githubZipStorage,
  screenshotStorage,
  urlStorage,
} from './storage';
import Compressor from 'compressorjs';
import type { Snapshot } from './types';
import { message } from './discrete';

export const snapshotAsZip = async (snapshot: Snapshot) => {
  const zip = new JSZip();
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

export const snapshotAsPng = async (snapshot: Snapshot) => {
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
  // console.log([
  //   snapshot.id,
  //   (imgBf.byteLength / 1024).toFixed(3) + 'KB',
  //   (jpgBlob.size / 1024).toFixed(3) + 'KB',
  //   (1 - jpgBlob.size / imgBf.byteLength) * 100 + '%',
  // ]);
  const content = new Blob([jpgBlob]);
  return content;
};

export const exportSnapshotAsPng = async (snapshot: Snapshot) => {
  const fileName = `snapshot-${snapshot.id}.jpg`;
  saveAs(await snapshotAsPng(snapshot), fileName);
};

export const batchPngDownloadZip = async (snapshots: Snapshot[]) => {
  const zip = new JSZip();
  for (const snapshot of snapshots) {
    await delay();
    zip.file(snapshot.id + `.jpg`, snapshotAsPng(snapshot));
  }
  const batchZipFile = await zip.generateAsync({
    type: 'blob',
    compression: `STORE`,
  });
  saveAs(batchZipFile, `batch-png-${snapshots.length}.zip`);
};

export const batchZipDownloadZip = async (snapshots: Snapshot[]) => {
  const zip = new JSZip();
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

export const exportSnapshotAsPngUrl = async (snapshot: Snapshot) => {
  return (
    githubPngStorage[snapshot.id] ??
    uploadPoliciesAssets(
      await snapshotAsPng(snapshot).then((r) => r.arrayBuffer()),
      'file.jpg',
      'image/jpeg',
    ).then((r) => {
      // urlStorage[r.href] = snapshot.id;
      githubPngStorage[snapshot.id] = r.href;
      return r.href;
    })
  );
};

export const exportSnapshotAsZipUrl = async (snapshot: Snapshot) => {
  return (
    githubZipStorage[snapshot.id] ??
    uploadPoliciesAssets(
      await snapshotAsZip(snapshot).then((r) => r.arrayBuffer()),
      'file.zip',
      'application/x-zip-compressed',
    ).then((r) => {
      githubZipStorage[snapshot.id] = r.href;
      urlStorage[r.href] = snapshot.id;
      return r.href;
    })
  );
};

export const batchCreatePngUrl = async (snapshots: Snapshot[]) => {
  const limit = pLimit(3);
  return (
    await Promise.allSettled(
      snapshots.map((s) => limit(() => exportSnapshotAsPngUrl(s))),
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
      snapshots.map((s) => limit(() => exportSnapshotAsZipUrl(s))),
    )
  ).reduce<string[]>((p, c) => {
    if (c.status == 'fulfilled') {
      p.push(c.value);
    }
    return p;
  }, []);
};

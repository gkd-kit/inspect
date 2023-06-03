import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { GithubPoliciesAsset, uploadPoliciesAssets } from './github';
import { exportPngStore, storage, exportZipStore } from './storage';
import type { Snapshot } from './types';
import { delay } from './others';
import pLimit from 'p-limit';

export const snapshotAsZip = async (snapshot: Snapshot) => {
  const zip = new JSZip();
  zip
    .file(`snapshot.json`, JSON.stringify(snapshot))
    .file(`screenshot.png`, (await storage.getScreenshot(snapshot.id))!);
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
  const imgBf = (await storage.getScreenshot(snapshot.id))!;
  const content = new Blob([imgBf, JSON.stringify(snapshot)]);
  return content;
};

export const exportSnapshotAsPng = async (snapshot: Snapshot) => {
  const fileName = `snapshot-${snapshot.id}.png`;
  saveAs(await snapshotAsPng(snapshot), fileName);
};

export const batchPngDownloadZip = async (snapshots: Snapshot[]) => {
  const zip = new JSZip();
  for (const snapshot of snapshots) {
    await delay();
    zip.file(snapshot.id + `.png`, snapshotAsPng(snapshot));
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
    exportPngStore[snapshot.id] ??
    uploadPoliciesAssets(
      await snapshotAsPng(snapshot).then((r) => r.arrayBuffer()),
    ).then((r) => {
      exportPngStore[snapshot.id] = structuredClone(r);
      return r;
    })
  );
};

export const exportSnapshotAsZipUrl = async (snapshot: Snapshot) => {
  return (
    exportZipStore[snapshot.id] ??
    uploadPoliciesAssets(
      await snapshotAsZip(snapshot).then((r) => r.arrayBuffer()),
    ).then((r) => {
      exportZipStore[snapshot.id] = structuredClone(r);
      return r;
    })
  );
};

export const batchCreatePngUrl = async (snapshots: Snapshot[]) => {
  const limit = pLimit(3);
  return (
    await Promise.allSettled(
      snapshots.map((s) => limit(() => exportSnapshotAsPngUrl(s))),
    )
  ).reduce<GithubPoliciesAsset[]>((p, c) => {
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
  ).reduce<GithubPoliciesAsset[]>((p, c) => {
    if (c.status == 'fulfilled') {
      p.push(c.value);
    }
    return p;
  }, []);
};

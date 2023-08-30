import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import pLimit from 'p-limit';
import { GithubPoliciesAsset, uploadPoliciesAssets } from './github';
import { delay } from './others';
import {
  githubPngStorage,
  githubZipStorage,
  screenshotStorage,
} from './storage';
import type { Snapshot } from './types';

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
    githubPngStorage[snapshot.id] ??
    uploadPoliciesAssets(
      await snapshotAsPng(snapshot).then((r) => r.arrayBuffer()),
    ).then((r) => {
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
    ).then((r) => {
      githubZipStorage[snapshot.id] = r.href;
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

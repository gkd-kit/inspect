import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { uploadPoliciesAssets } from './github';
import { storage } from './storage';
import type { Snapshot } from './types';

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

export const exportSnapshotAsPngUrl = async (snapshot: Snapshot) => {
  return uploadPoliciesAssets(
    await snapshotAsPng(snapshot).then((r) => r.arrayBuffer()),
  );
};

export const exportSnapshotAsZipUrl = async (snapshot: Snapshot) => {
  return uploadPoliciesAssets(
    await snapshotAsZip(snapshot).then((r) => r.arrayBuffer()),
  );
};

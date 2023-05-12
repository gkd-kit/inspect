import JSZip from 'jszip';
import type { Snapshot } from './types';
import storage from './storage';
import { fileSave } from 'browser-fs-access';
import { delay } from './index';

export const exportSnapshotAsZip = async (snapshot: Snapshot) => {
  const zip = new JSZip();
  zip
    .file(`snapshot.json`, JSON.stringify(snapshot))
    .file(`window.json`, JSON.stringify(await storage.getWindow(snapshot.id)))
    .file(`screenshot.png`, (await storage.getScreenshot(snapshot.id))!);
  const content = await zip.generateAsync({
    type: 'blob',
    compression: `STORE`,
  });
  await fileSave(content, {
    fileName: `snapshot-${snapshot.id}.zip`,
  });
  await delay(500);
};

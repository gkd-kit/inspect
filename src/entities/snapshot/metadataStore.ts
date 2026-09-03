import { isIntString } from '@/shared/lib/number';
import { getImageId, getImportId } from '@/entities/snapshot/urls';
import {
  loadIndexedStorage,
  setStoredRecordValue,
} from '@/shared/storage/browserStorage';

const snapshotImportTimeData = await loadIndexedStorage<Record<string, number>>(
  'importTime',
  () => ({}),
);

const snapshotViewedTimeData = await loadIndexedStorage<Record<string, number>>(
  'snapshotViewedTime',
  () => ({}),
);

const snapshotImageIdData = await loadIndexedStorage<Record<string, string>>(
  'githubJpg',
  () => ({}),
  (object) => {
    Object.keys(object).forEach((key) => {
      const value = object[key];
      if (value.startsWith('https://')) {
        const imageId = getImageId(value);
        if (imageId) object[key] = imageId;
        else delete object[key];
      }
    });
    return object;
  },
);

const snapshotImportIdData = await loadIndexedStorage<Record<string, number>>(
  'githubZip',
  () => ({}),
  (object) => {
    Object.keys(object).forEach((key) => {
      const value = object[key] as unknown as string;
      if (isIntString(value)) return;
      const importId = getImportId(value);
      if (importId) object[key] = importId;
      else delete object[key];
    });
    return object;
  },
);

const importSnapshotIdData = await loadIndexedStorage<Record<string, number>>(
  'url',
  () => ({}),
  (object) => {
    Object.keys(object).forEach((key) => {
      if (isIntString(key)) return;
      const importId = getImportId(key);
      if (importId) object[importId] = object[key];
      delete object[key];
    });
    return object;
  },
);

export const snapshotImportTime = readonly(snapshotImportTimeData) as Readonly<
  Record<string, number>
>;
export const snapshotViewedTime = readonly(snapshotViewedTimeData) as Readonly<
  Record<string, number>
>;
export const snapshotImageId = readonly(snapshotImageIdData) as Readonly<
  Record<string, string>
>;
export const snapshotImportId = readonly(snapshotImportIdData) as Readonly<
  Record<string, number>
>;
export const importSnapshotId = readonly(importSnapshotIdData) as Readonly<
  Record<string, number>
>;

export const snapshotMetadataActions = {
  setImportTime(snapshotId: string | number, value?: number) {
    setStoredRecordValue(
      snapshotImportTimeData,
      'importTime',
      snapshotId,
      value,
    );
  },
  setViewedTime(snapshotId: string | number, value?: number) {
    setStoredRecordValue(
      snapshotViewedTimeData,
      'snapshotViewedTime',
      snapshotId,
      value,
    );
  },
  setImageId(snapshotId: string | number, value?: string) {
    setStoredRecordValue(snapshotImageIdData, 'githubJpg', snapshotId, value);
  },
  setImportId(snapshotId: string | number, value?: number) {
    setStoredRecordValue(snapshotImportIdData, 'githubZip', snapshotId, value);
  },
  setSnapshotId(importId: string | number, value?: number) {
    setStoredRecordValue(importSnapshotIdData, 'url', importId, value);
  },
};

export const useSnapshotMetadataStore = () => ({
  snapshotImportTime,
  snapshotViewedTime,
  snapshotImageId,
  snapshotImportId,
  importSnapshotId,
  actions: snapshotMetadataActions,
});

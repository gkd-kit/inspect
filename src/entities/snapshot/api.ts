import {
  requestWorkersJson,
  WORKERS_API_ORIGIN,
} from '../../shared/api/workers.ts';

interface SnapshotDetection {
  id: number;
  importId: number;
  created: boolean;
}

export const getSnapshotImportId = async (
  id: number,
): Promise<number | null> => {
  const url = new URL('/snapshot-detect/getImportId', WORKERS_API_ORIGIN);
  url.searchParams.set('id', String(id));
  return requestWorkersJson<number | null>(url);
};

export const detectRemoteSnapshot = async (
  id: number,
  importId: number,
): Promise<SnapshotDetection> => {
  const url = new URL('/snapshot-detect/detectSnapshot', WORKERS_API_ORIGIN);
  return requestWorkersJson<SnapshotDetection>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, importId }),
  });
};

import { networkFetch } from './network.ts';
export { WORKERS_API_ORIGIN, getWorkersProxyUrl } from './workers_proxy.ts';

interface WorkersApiError {
  error: true;
  message?: string;
}

const isWorkersApiError = (value: unknown): value is WorkersApiError => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    value.error === true
  );
};

export const requestWorkersJson = async <T>(
  url: URL,
  init?: RequestInit,
): Promise<T> => {
  const response = await networkFetch(url, init);
  if (!response.ok) {
    throw new Error(`Workers API returned HTTP ${response.status}`);
  }
  const result: unknown = await response.json();
  if (isWorkersApiError(result)) {
    throw new Error(result.message || 'Workers API request failed');
  }
  return result as T;
};

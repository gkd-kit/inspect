import { gmOk, type GmXhrOptions } from '@/shared/api/gm';
import { networkFetch } from '@/shared/api/network';
import { isAllowCorsUrl } from '@/shared/lib/url';
import { useNetworkAccessStore } from './store';

export const enhanceFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  xhrDetails?: (arg: GmXhrOptions) => GmXhrOptions,
): Promise<Response> => {
  try {
    return await networkFetch(input, init, xhrDetails);
  } catch (error) {
    const request = new Request(input, init);
    if (
      error instanceof TypeError &&
      !request.signal.aborted &&
      !gmOk() &&
      !isAllowCorsUrl(request.url)
    ) {
      useNetworkAccessStore().setNetworkErrorDialogVisible(true);
    }
    throw error;
  }
};

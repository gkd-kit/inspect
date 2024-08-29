import { store } from '@/store';
import type { PoliciesAsset } from 'user-attachments';
import { uploadPoliciesAssets } from 'user-attachments';
import { enhanceFetch } from './fetch';

export type GithubPoliciesAsset = PoliciesAsset;

export const uploadAsset = async (
  bf: ArrayBuffer,
  name: string,
): Promise<PoliciesAsset> => {
  return await uploadPoliciesAssets({
    file: new File([bf], name),
    url: 'https://github.com/gkd-kit/inspect/issues/1',
    fetch: enhanceFetch,
  }).catch((e) => {
    if (e instanceof Error && e.message === 'not found authenticity_token') {
      store.githubErrorDlgVisible = true;
    }
    throw e;
  });
};

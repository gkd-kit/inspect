import type { PoliciesAsset } from 'user-attachments';
import { UploadError, uploadPoliciesAssets } from 'user-attachments';
import { enhanceFetch } from './fetch';

export type GithubPoliciesAsset = PoliciesAsset;

export const uploadAsset = async (
  bf: ArrayBuffer,
  name: string,
): Promise<PoliciesAsset> => {
  return await uploadPoliciesAssets({
    repositoryId: '661952005',
    file: new File([bf], name),
    fetch: enhanceFetch,
  }).catch(async (e) => {
    if (e instanceof UploadError) {
      useGlobalStore().githubErrorDlgVisible = true;
    }
    throw e;
  });
};

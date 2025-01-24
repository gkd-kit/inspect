import type { PoliciesAsset } from 'user-attachments';
import { UploadError, uploadPoliciesAssets } from 'user-attachments';
import { enhanceFetch } from './fetch';

export type GithubPoliciesAsset = PoliciesAsset;

export const uploadAsset = async (
  fileBit: ArrayBuffer | Blob,
  name: string,
): Promise<PoliciesAsset> => {
  return await uploadPoliciesAssets({
    repositoryId: '661952005',
    file: new File([fileBit], name),
    fetch: enhanceFetch,
  }).catch(async (e) => {
    if (e instanceof UploadError) {
      useGlobalStore().githubErrorDlgVisible = true;
    }
    throw e;
  });
};

import { enhanceFetch } from './fetch';
import { isPngBf, isZipBf } from './file_type';
import { obj2form } from './others';
import store from './store';

const authenticityTokenPageUrl = `https://github.com/gkd-kit/inspect/issues/new`;
const repository_id = `661952005`;
const commonHeaders = {
  origin: `https://github.com`,
  referer: authenticityTokenPageUrl,
};

const getCsrfToken = async () => {
  const csrfSelector = `[data-upload-policy-url="/upload/policies/assets"] input.js-data-upload-policy-url-csrf`;
  const resp = await enhanceFetch(authenticityTokenPageUrl);
  const responseDoc = new DOMParser().parseFromString(
    await resp.text(),
    'text/html',
  );
  const csrfToken = responseDoc
    .querySelector(csrfSelector)
    ?.getAttribute(`value`);
  return csrfToken;
};

type S3Form = {
  key: string;
  acl: string;
  policy: string;
  'X-Amz-Algorithm': string;
  'X-Amz-Credential': string;
  'X-Amz-Date': string;
  'X-Amz-Signature': string;
  'Content-Type': string;
  'Cache-Control': string;
  'x-amz-meta-Surrogate-Control': string;
};
export type GithubPoliciesAsset = {
  id: number;
  name: string;
  size: number;
  content_type: string;
  original_name: string;
  href: string;
};

type UploadPoliciesAssetsRsonpse = {
  upload_url: string;
  header: {};
  asset: GithubPoliciesAsset;
  form: S3Form;
  same_origin: boolean;
  asset_upload_url: string;
  upload_authenticity_token: string;
  asset_upload_authenticity_token: string;
};

export const uploadPoliciesAssets = async (
  bf: ArrayBuffer,
): Promise<GithubPoliciesAsset> => {
  // const [name, content_type] = (() => {
  //   if (isPngBf(bf)) {
  //     return [`file.png`, `image/png`];
  //   } else if (isZipBf(bf)) {
  //     return [`file.zip`, `application/x-zip-compressed`];
  //   }
  //   throw new Error(`invalid buffer, it must be png or zip`);
  // })();
  // const file = new File([bf], name, { type: content_type });
  // const resp = await fetch(
  //   'https://github-upload-assets.lisonge.workers.dev/',
  //   {
  //     method: 'POST',
  //     body: obj2form({ file }),
  //   },
  // );
  // const xRpcOk = resp.headers.get('X_RPC_OK');
  // if (xRpcOk === 'true') {
  //   return resp.json();
  // }
  return uploadPoliciesAssetsByExtension(bf);
};

export const uploadPoliciesAssetsByExtension = async (bf: ArrayBuffer) => {
  const [name, content_type] = (() => {
    if (isPngBf(bf)) {
      return [`file.png`, `image/png`];
    } else if (isZipBf(bf)) {
      return [`file.zip`, `application/x-zip-compressed`];
    }
    throw new Error(`invalid buffer, it must be png or zip`);
  })();

  const authenticity_token = await getCsrfToken();
  if (!authenticity_token) {
    store.githubErrorDlgVisible = true;
    throw new Error(`failed get csrfToken`);
  }

  const policiesResp: UploadPoliciesAssetsRsonpse = await enhanceFetch(
    `https://github.com/upload/policies/assets`,
    {
      method: `POST`,
      body: obj2form({
        authenticity_token,
        content_type,
        name,
        size: bf.byteLength,
        repository_id,
      }),
      headers: commonHeaders,
    },
  ).then((r) => {
    if (!r.ok) {
      throw new Error(`failed upload policies assets`);
    }
    return r.json();
  });

  // violentmonkey success
  // tampermonkey failed https://github.com/Tampermonkey/tampermonkey/issues/1783
  // use fetch is also work, but console.error cors and can not get response
  const s3Resp = await enhanceFetch(policiesResp.upload_url, {
    method: `POST`,
    body: obj2form(policiesResp.form, {
      file: new File([bf], name, { type: content_type }),
    }),
    headers: commonHeaders,
  });
  if (!s3Resp.ok) {
    throw new Error(`upload s3 failed`);
  }

  const assetsResp = await enhanceFetch(
    new URL(policiesResp.asset_upload_url, `https://github.com/`).href,
    {
      method: `PUT`,
      body: obj2form({
        authenticity_token: policiesResp.asset_upload_authenticity_token,
      }),
      headers: {
        ...commonHeaders,
        // api must add `Accept` request headers
        Accept: `application/json`,
      },
    },
  );

  if (assetsResp.status != 200) {
    throw new Error(`failed check authenticity upload`);
  }

  return policiesResp.asset;
};

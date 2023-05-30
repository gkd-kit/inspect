import { enhanceFetch, GM_xmlhttpRequest } from './fetch';
import { isPngBf, isZipBf } from './file_type';
import { obj2form } from './others';

const authenticityTokenPageUrl = `https://github.com/lisonge/lisonge/issues/new`;
const repository_id = `280305380`;

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
export type PoliciesAsset = {
  id: number;
  name: string;
  size: number;
  content_type: string;
  href: string;
  original_name: string;
};

type UploadPoliciesAssetsRsonpse = {
  upload_url: string;
  header: {};
  asset: PoliciesAsset;
  form: S3Form;
  same_origin: boolean;
  asset_upload_url: string;
  upload_authenticity_token: string;
  asset_upload_authenticity_token: string;
};

export const uploadPoliciesAssets = async (
  bf: ArrayBuffer,
  fileName?: string,
) => {
  const [name, content_type] = (() => {
    if (isPngBf(bf)) {
      return [fileName || `file.png`, `image/png`];
    } else if (isZipBf(bf)) {
      return [fileName || `file.zip`, `application/x-zip-compressed`];
    }
    throw new Error(`invalid bf, it must be png or zip`);
  })();

  const authenticity_token = await getCsrfToken();
  if (!authenticity_token) {
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
    },
  ).then((r) => {
    if (!r.ok) {
      console.log(r);
      throw new Error(`failed upload policies assets`);
    }
    return r.json();
  });

  // it is work, but console.error cors and can not get response
  // try {
  //   const s3Resp = await fetch(policiesResp.upload_url, {
  //     method: `POST`,
  //     body: obj2form(policiesResp.form, {
  //       file: new File([bf], name, { type: content_type }),
  //     }),
  //     headers: {
  //       Referer: authenticityTokenPageUrl,
  //     },
  //   });
  // } catch {}

  // violentmonkey success
  // tampermonkey failed https://github.com/Tampermonkey/tampermonkey/issues/1783
  await new Promise<void>((res, rej) => {
    GM_xmlhttpRequest({
      url: policiesResp.upload_url,
      method: 'POST',
      // s3 api must keep correct form field order
      data: obj2form(policiesResp.form, {
        file: new File([bf], name, { type: content_type }),
      }),
      onload(response) {
        // const h = response.responseHeaders
        //   .split(`\r\n`)
        //   .map((s) => s.split(`: `, 2).map((s) => s) as [string, string])
        //   .filter((s) => s.length == 2);
        // const header = new Headers(h);
        // console.log(header.get(`Location`));
        if (!(200 <= response.status && response.status <= 299)) {
          console.log(response);
          rej(new Error(`upload s3 failed`));
        }
        res();
      },
      onerror(response) {
        rej(response);
      },
    });
  });

  const assetsResp = await enhanceFetch(
    new URL(policiesResp.asset_upload_url, `https://github.com/`).href,
    {
      method: `PUT`,
      body: obj2form({
        authenticity_token: policiesResp.asset_upload_authenticity_token,
      }),
      headers: {
        // api must add `Accept` request headers
        Accept: `application/json`,
      },
    },
  );

  if (assetsResp.status != 200) {
    console.log(assetsResp);
    throw new Error(`failed check authenticity upload`);
  }

  return policiesResp.asset;
};

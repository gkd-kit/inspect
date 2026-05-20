import type { PoliciesAsset } from 'user-attachments';
import { UploadError, uploadPoliciesAssets } from 'user-attachments';
import { enhanceFetch } from './fetch';
import { delay } from './others';

export type GithubPoliciesAsset = PoliciesAsset;

interface GithubGraphqlCommentResult {
  data: {
    addComment: {
      timelineEdge: {
        node: {
          id: string;
        };
      };
    };
  };
}

const graphqlFetch = async (
  data: unknown,
): Promise<GithubGraphqlCommentResult> => {
  return enhanceFetch('https://github.com/_graphql', {
    method: 'POST',
    headers: {
      'content-type': 'text/plain;charset=UTF-8',
      accept: 'application/json',
      'github-verified-fetch': 'true',
      origin: 'https://github.com',
      referer: 'https://github.com/gkd-kit/inspect/issues/46',
    },
    body: JSON.stringify(data),
  })
    .then(async (r) => {
      if (!r.ok) {
        console.error(r, await r.text());
        throw new Error('github comment graphql failed');
      }
      return r;
    })
    .then((r) => {
      return r.json();
    });
};

export const uploadAsset = async (
  fileBit: ArrayBuffer | Blob,
  name: string,
): Promise<PoliciesAsset> => {
  const r = await uploadPoliciesAssets({
    repositoryId: '661952005',
    file: new File([fileBit], name),
    fetch: enhanceFetch,
  }).catch(async (e) => {
    if (e instanceof UploadError) {
      useGlobalStore().githubErrorDlgVisible = true;
    }
    throw e;
  });
  // send file url text to github comment
  const commentResult = await graphqlFetch({
    persistedQueryName: 'addCommentMutation',
    query: 'edafa18ab5734f05c9893cbc92d0dfb1',
    variables: {
      connections: [
        'client:I_kwDOJ3SWBc6viUWN:__Issue__backTimelineItems_connection(visibleEventsOnly:true)',
      ],
      input: {
        body: r.href,
        subjectId: 'I_kwDOJ3SWBc6viUWN',
      },
    },
  });
  // delay is needed
  await delay(1000);
  // unsubscribe the comment
  await graphqlFetch({
    persistedQueryName: 'updateIssueSubscriptionMutation',
    query: 'd0752b2e49295017f67c84f21bfe41a3',
    variables: {
      input: { state: 'UNSUBSCRIBED', subscribableId: 'I_kwDOJ3SWBc6viUWN' },
    },
  });
  // delete the comment
  await graphqlFetch({
    persistedQueryName: 'deleteIssueCommentMutation',
    query: 'b0f125991160e607a64d9407db9c01b3',
    variables: {
      connections: [
        'client:I_kwDOJ3SWBc6viUWN:__Issue__frontTimelineItems_connection(visibleEventsOnly:true)',
        'client:I_kwDOJ3SWBc6viUWN:__Issue__backTimelineItems_connection(visibleEventsOnly:true)',
      ],
      input: { id: commentResult.data.addComment.timelineEdge.node.id },
    },
  });
  return r;
};

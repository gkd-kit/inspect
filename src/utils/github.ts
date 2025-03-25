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
          __typename: string;
          id: string;
          databaseId: number;
          body: string;
          bodyHTML: string;
          bodyVersion: string;
          viewerCanUpdate: boolean;
          url: string;
          createdAt: string;
          authorAssociation: string;
          viewerCanDelete: boolean;
          viewerCanMinimize: boolean;
          viewerCanReport: boolean;
          viewerCanReportToMaintainer: boolean;
          viewerCanBlockFromOrg: boolean;
          viewerCanUnblockFromOrg: boolean;
          isHidden: boolean;
          minimizedReason: any;
          showSpammyBadge: boolean;
          createdViaEmail: boolean;
          viewerDidAuthor: boolean;
          authorToRepoOwnerSponsorship: any;
          author: {
            __typename: string;
            id: string;
            login: string;
            avatarUrl: string;
          };
          repository: {
            id: string;
            name: string;
            owner: {
              __typename: string;
              id: string;
              login: string;
              url: string;
            };
            isPrivate: boolean;
            slashCommandsEnabled: boolean;
            nameWithOwner: string;
            databaseId: number;
          };
          issue: {
            number: number;
            id: string;
            locked: boolean;
            databaseId: number;
            author: {
              __typename: string;
              login: string;
              id: string;
            };
          };
          __isComment: string;
          viewerCanReadUserContentEdits: boolean;
          lastEditedAt: any;
          lastUserContentEdit: any;
          __isReactable: string;
          reactionGroups: Array<{
            content: string;
            viewerHasReacted: boolean;
            reactors: {
              totalCount: number;
              nodes: Array<any>;
            };
          }>;
          __isNode: string;
        };
      };
      subject: {
        __typename: string;
        id: string;
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
    query: '50e7774b5a519b88858e02e46e0348da',
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
  delay(1000).then(async () => {
    // unsubscribe the comment
    await graphqlFetch({
      query: 'd0752b2e49295017f67c84f21bfe41a3',
      variables: {
        input: { state: 'UNSUBSCRIBED', subscribableId: 'I_kwDOJ3SWBc6viUWN' },
      },
    });
    // delete the comment
    await graphqlFetch({
      query: 'b0f125991160e607a64d9407db9c01b3',
      variables: {
        connections: [],
        input: { id: commentResult.data.addComment.timelineEdge.node.id },
      },
    });
  });
  return r;
};

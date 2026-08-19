import process from 'node:process';

const GITHUB_API_ORIGIN = 'https://api.github.com';
const OWNER = 'gkd-kit';
const REPOSITORY = 'inspect';
const ISSUE_NUMBER = 46;
const PAGE_SIZE = 100;
const MINIMUM_COMMENT_AGE_MS = 10 * 60 * 1000;

interface IssueComment {
  id: number;
  created_at: string;
  html_url: string;
}

const githubToken = process.env.GITHUB_TOKEN?.trim();

if (!githubToken) {
  throw new Error('Missing GITHUB_TOKEN environment variable');
}

const githubFetch = async (path: string, init?: RequestInit) => {
  const response = await fetch(GITHUB_API_ORIGIN + path, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${githubToken}`,
      'user-agent': `${OWNER}-${REPOSITORY}-delete-issue-comments`,
      'x-github-api-version': '2026-03-10',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `GitHub API ${init?.method ?? 'GET'} ${path} failed: ` +
        `${response.status} ${response.statusText}\n${responseText}`,
    );
  }

  return response;
};

const getIssueComments = async () => {
  const comments: IssueComment[] = [];

  for (let page = 1; ; page += 1) {
    const response = await githubFetch(
      `/repos/${OWNER}/${REPOSITORY}/issues/${ISSUE_NUMBER}/comments` +
        `?per_page=${PAGE_SIZE}&page=${page}`,
    );
    const pageComments: unknown = await response.json();

    if (!Array.isArray(pageComments)) {
      throw new Error('GitHub API returned an invalid issue comments response');
    }

    comments.push(...(pageComments as IssueComment[]));

    if (pageComments.length < PAGE_SIZE) {
      return comments;
    }
  }
};

const deleteIssueComment = async (comment: IssueComment) => {
  console.log(`Deleting ${comment.html_url}`);
  await githubFetch(
    `/repos/${OWNER}/${REPOSITORY}/issues/comments/${comment.id}`,
    { method: 'DELETE' },
  );
};

const comments = await getIssueComments();

comments.sort((left, right) => {
  return left.created_at.localeCompare(right.created_at) || left.id - right.id;
});

const [firstComment, ...laterComments] = comments;

if (!firstComment) {
  console.log(`Issue #${ISSUE_NUMBER} has no comments to delete`);
} else {
  const now = Date.now();
  const recentComments: IssueComment[] = [];
  const commentsToDelete: IssueComment[] = [];

  for (const comment of laterComments) {
    const commentCreatedAt = Date.parse(comment.created_at);

    if (!Number.isFinite(commentCreatedAt)) {
      throw new Error(
        `GitHub API returned an invalid created_at value for ${comment.html_url}`,
      );
    }

    if (now - commentCreatedAt < MINIMUM_COMMENT_AGE_MS) {
      recentComments.push(comment);
    } else {
      commentsToDelete.push(comment);
    }
  }

  console.log(`Keeping the first comment: ${firstComment.html_url}`);
  console.log(`Keeping ${recentComments.length} recent comment(s)`);
  console.log(`Deleting ${commentsToDelete.length} later comment(s)`);

  for (const comment of commentsToDelete) {
    await deleteIssueComment(comment);
  }

  console.log('Finished deleting issue comments');
}

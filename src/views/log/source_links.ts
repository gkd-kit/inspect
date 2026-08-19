export type SourceLinkTarget = {
  path: string;
  displayPath: string;
  url: string;
};

export type SourceLinkContext = {
  repositoryUrl: string;
  commitId: string;
  commitUrl: string;
  pathsByFileName: ReadonlyMap<string, readonly string[]>;
};

export type LogVersionInfo = {
  versionName: string;
  versionCode: number;
  commitUrl: string;
};

export type SourceLineToken = {
  text: string;
  sourceTargets?: readonly SourceLinkTarget[];
};

type GitHubCommitInfo = Pick<
  SourceLinkContext,
  `repositoryUrl` | `commitId` | `commitUrl`
>;

const kotlinSourceReferenceRegex = /\b([A-Za-z\d]+\.kt):(\d+)\b/g;
const githubNameRegex = /^[A-Za-z\d_.-]+$/;
const gitCommitRegex = /^[a-f\d]{7,40}$/i;
const maxSourcePathSize = 1024;
const maxSourcePathDepth = 64;
const maxSourcePathSegmentSize = 255;

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value == `object` && value != null && !Array.isArray(value);
};

const stripByteOrderMark = (value: string) => value.replace(/^\uFEFF/, ``);

const parseGitHubCommitUrl = (
  value: unknown,
  declaredCommitId: unknown,
): GitHubCommitInfo | undefined => {
  if (typeof value != `string`) return;
  try {
    const url = new URL(value);
    if (
      url.protocol != `https:` ||
      url.hostname.toLowerCase() != `github.com` ||
      url.port ||
      url.username ||
      url.password
    ) {
      return;
    }
    const parts = url.pathname
      .split(`/`)
      .filter(Boolean)
      .map(decodeURIComponent);
    if (parts.length != 4 || parts[2]?.toLowerCase() != `commit`) return;
    const [owner, repository, , commitId] = parts;
    if (
      !owner ||
      !repository ||
      !commitId ||
      !githubNameRegex.test(owner) ||
      !githubNameRegex.test(repository) ||
      !gitCommitRegex.test(commitId)
    ) {
      return;
    }
    if (
      declaredCommitId != null &&
      (typeof declaredCommitId != `string` ||
        declaredCommitId.toLowerCase() != commitId.toLowerCase())
    ) {
      return;
    }
    return {
      repositoryUrl: `https://github.com/${owner}/${repository}`,
      commitId,
      commitUrl: `https://github.com/${owner}/${repository}/commit/${commitId}`,
    };
  } catch {}
};

const parseGitHubCommitInfo = (raw: string) => {
  try {
    const value: unknown = JSON.parse(stripByteOrderMark(raw));
    if (!isObject(value)) return;
    return parseGitHubCommitUrl(value.commitUrl, value.commitId);
  } catch {}
};

export const parseLogVersionInfo = (
  raw: string,
): LogVersionInfo | undefined => {
  try {
    const value: unknown = JSON.parse(stripByteOrderMark(raw));
    if (!isObject(value)) return;
    const commitInfo = parseGitHubCommitUrl(value.commitUrl, value.commitId);
    if (
      !commitInfo ||
      typeof value.versionName != `string` ||
      !value.versionName.trim() ||
      typeof value.versionCode != `number` ||
      !Number.isSafeInteger(value.versionCode)
    ) {
      return;
    }
    return {
      versionName: value.versionName.trim(),
      versionCode: value.versionCode,
      commitUrl: commitInfo.commitUrl,
    };
  } catch {}
};

const normalizeSourcePath = (value: string) => {
  const path = value.trim().replaceAll(`\\`, `/`);
  if (
    !path ||
    path.length > maxSourcePathSize ||
    path.startsWith(`/`) ||
    /^[A-Za-z]:\//.test(path) ||
    !path.toLowerCase().endsWith(`.kt`)
  ) {
    return;
  }
  const parts = path.split(`/`);
  if (
    parts.length > maxSourcePathDepth ||
    parts.some(
      (part) =>
        !part ||
        part == `.` ||
        part == `..` ||
        part.length > maxSourcePathSegmentSize,
    )
  ) {
    return;
  }
  return path;
};

const getSourcePathsByFileName = (raw: string) => {
  const pathsByFileName = new Map<string, string[]>();
  const lines = stripByteOrderMark(raw).split(/\r\n|\n|\r/);
  for (const line of lines) {
    const path = normalizeSourcePath(line);
    if (!path) continue;
    const fileName = path.split(`/`).at(-1);
    if (!fileName) continue;
    const paths = pathsByFileName.get(fileName) || [];
    if (!paths.includes(path)) paths.push(path);
    pathsByFileName.set(fileName, paths);
  }
  for (const paths of pathsByFileName.values()) {
    paths.sort((a, b) => a.localeCompare(b, `en`));
  }
  return pathsByFileName;
};

export const createSourceLinkContext = (
  versionRaw: string,
  sourcePathsRaw: string | undefined,
): SourceLinkContext | undefined => {
  if (sourcePathsRaw == null) return;
  const commitInfo = parseGitHubCommitInfo(versionRaw);
  if (!commitInfo) return;
  const pathsByFileName = getSourcePathsByFileName(sourcePathsRaw);
  if (pathsByFileName.size == 0) return;
  return {
    ...commitInfo,
    pathsByFileName,
  };
};

const getSourceUrl = (
  context: SourceLinkContext,
  path: string,
  lineNumber: number,
) => {
  const encodedPath = path.split(`/`).map(encodeURIComponent).join(`/`);
  return `${context.repositoryUrl}/blob/${context.commitId}/${encodedPath}#L${lineNumber}`;
};

export const getShortestUniquePathLabels = (paths: readonly string[]) => {
  const pathParts = paths.map((path) => path.split(`/`));
  return pathParts.map((parts, pathIndex) => {
    for (let depth = 1; depth <= parts.length; depth++) {
      const label = parts.slice(-depth).join(`/`);
      const unique = pathParts.every((otherParts, otherIndex) => {
        return (
          otherIndex == pathIndex || otherParts.slice(-depth).join(`/`) != label
        );
      });
      if (unique) return label;
    }
    return paths[pathIndex] || ``;
  });
};

export const getSourceLineTokens = (
  line: string,
  context: SourceLinkContext | undefined,
): SourceLineToken[] => {
  if (!context || !line.includes(`.kt:`)) return [{ text: line }];
  const tokens: SourceLineToken[] = [];
  let offset = 0;
  kotlinSourceReferenceRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = kotlinSourceReferenceRegex.exec(line))) {
    const fileName = match[1];
    const lineNumber = Number(match[2]);
    const paths = fileName ? context.pathsByFileName.get(fileName) : undefined;
    if (!paths?.length || !Number.isSafeInteger(lineNumber) || lineNumber < 1) {
      continue;
    }
    if (match.index > offset) {
      tokens.push({ text: line.slice(offset, match.index) });
    }
    const displayPaths = getShortestUniquePathLabels(paths);
    tokens.push({
      text: match[0],
      sourceTargets: paths.map((path, index) => ({
        path,
        displayPath: displayPaths[index] || path,
        url: getSourceUrl(context, path, lineNumber),
      })),
    });
    offset = match.index + match[0].length;
  }
  if (offset < line.length) tokens.push({ text: line.slice(offset) });
  return tokens.length ? tokens : [{ text: line }];
};

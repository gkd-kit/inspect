import { ApiError } from "./errors";

const MAX_REDIRECTS = 5;
const MAX_KNOWN_RESPONSE_SIZE = 32 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const GITHUB_HOSTNAME = "github.com";
const GITHUB_OBJECTS_HOSTNAME = "objects.githubusercontent.com";
const GITHUB_ATTACHMENT_PATHS = [
  /^\/user-attachments\/files\/([1-9][0-9]*)\/([^/]+)$/,
  /^\/gkd-kit\/inspect\/files\/([1-9][0-9]*)\/([^/]+)$/,
] as const;
const GITHUB_OBJECT_PATH =
  /^\/github-production-repository-file-[0-9a-f]+\/[1-9][0-9]*\/[1-9][0-9]*$/;
const REQUEST_HEADER_ALLOWLIST = [
  "accept",
  "accept-language",
  "range",
  "if-none-match",
  "if-modified-since",
] as const;
const RESPONSE_HEADER_ALLOWLIST = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-encoding",
  "content-language",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "vary",
] as const;

const isIpv4Hostname = (hostname: string): boolean => {
  const parts = hostname.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^[0-9]+$/.test(part) && Number(part) <= 255)
  );
};

const validateHttpsTarget = (target: URL, workerHostname: string): URL => {
  if (target.protocol !== "https:") {
    throw new ApiError("Only HTTPS URLs are allowed");
  }
  if (target.username || target.password) {
    throw new ApiError("URLs containing credentials are not allowed");
  }
  if (target.port && target.port !== "443") {
    throw new ApiError("Only the default HTTPS port is allowed");
  }
  const hostname = target.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname.length === 0 ||
    hostname === workerHostname.toLowerCase().replace(/\.$/, "") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".onion") ||
    hostname.includes(":") ||
    isIpv4Hostname(hostname) ||
    !hostname.includes(".")
  ) {
    throw new ApiError("The target hostname is not allowed");
  }
  target.hostname = hostname;
  return target;
};

const isAllowedGithubAttachmentPath = (pathname: string): boolean => {
  const match = GITHUB_ATTACHMENT_PATHS.map((pattern) =>
    pathname.match(pattern),
  ).find((value) => value !== null);
  if (!match) return false;
  const filenameSegment = match[2];
  if (!filenameSegment) return false;
  let filename: string;
  try {
    filename = decodeURIComponent(filenameSegment);
  } catch {
    return false;
  }
  return (
    filename.length > 0 &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    !filename.includes("\0") &&
    !/%(?:2f|5c|00)/i.test(filename) &&
    filename.toLowerCase().endsWith(".zip")
  );
};

const validateInitialTarget = (
  target: URL,
  workerHostname: string,
): URL => {
  target = validateHttpsTarget(target, workerHostname);
  if (
    target.hostname !== GITHUB_HOSTNAME ||
    target.search.length > 0 ||
    target.hash.length > 0 ||
    !isAllowedGithubAttachmentPath(target.pathname)
  ) {
    throw new ApiError("Only GitHub ZIP attachment URLs are allowed");
  }
  return target;
};

const validateRedirectTarget = (
  target: URL,
  workerHostname: string,
): URL => {
  target = validateHttpsTarget(target, workerHostname);
  if (target.hash.length > 0) {
    throw new ApiError("The redirect target is not allowed");
  }
  if (
    target.hostname === GITHUB_HOSTNAME &&
    target.search.length === 0 &&
    isAllowedGithubAttachmentPath(target.pathname)
  ) {
    return target;
  }
  if (
    target.hostname === GITHUB_OBJECTS_HOSTNAME &&
    GITHUB_OBJECT_PATH.test(target.pathname)
  ) {
    return target;
  }
  throw new ApiError("The redirect target is not allowed");
};

const createUpstreamHeaders = (request: Request): Headers => {
  const headers = new Headers();
  for (const name of REQUEST_HEADER_ALLOWLIST) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
};

const fetchWithValidatedRedirects = async (
  initialTarget: URL,
  workerHostname: string,
  headers: Headers,
): Promise<Response> => {
  let target = initialTarget;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    let response: Response;
    try {
      response = await fetch(target, {
        method: "GET",
        headers,
        redirect: "manual",
      });
    } catch {
      throw new ApiError("Unable to fetch the upstream URL");
    }
    if (!REDIRECT_STATUSES.has(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    if (redirectCount === MAX_REDIRECTS) {
      throw new ApiError("The upstream URL redirected too many times");
    }
    target = validateRedirectTarget(new URL(location, target), workerHostname);
  }
  throw new ApiError("The upstream URL redirected too many times");
};

const createProxyResponse = (upstream: Response): Response => {
  const declaredLength = Number(upstream.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_KNOWN_RESPONSE_SIZE
  ) {
    throw new ApiError("The upstream response exceeds the size limit");
  }
  const headers = new Headers();
  for (const name of RESPONSE_HEADER_ALLOWLIST) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const body =
    upstream.status === 204 || upstream.status === 304 ? null : upstream.body;
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};

export const handleProxy = async (
  request: Request,
  env: Pick<Env, "RATE_LIMITER">,
): Promise<Response> => {
  const requestUrl = new URL(request.url);
  const targetValues = requestUrl.searchParams.getAll("url");
  if (targetValues.length !== 1 || !targetValues[0]) {
    throw new ApiError("Exactly one url query parameter is required");
  }
  let target: URL;
  try {
    target = validateInitialTarget(new URL(targetValues[0]), requestUrl.hostname);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("url must be an absolute URL");
  }

  const clientKey = request.headers.get("cf-connecting-ip") ?? "local";
  const limit = await env.RATE_LIMITER.limit({
    key: `${clientKey}:${target.hostname}`,
  });
  if (!limit.success) {
    throw new ApiError("Too many proxy requests", { "Retry-After": "60" });
  }

  const upstream = await fetchWithValidatedRedirects(
    target,
    requestUrl.hostname,
    createUpstreamHeaders(request),
  );
  return createProxyResponse(upstream);
};

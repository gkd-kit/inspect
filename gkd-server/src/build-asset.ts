import { ApiError, type ErrorResponse } from "./errors";

const MAX_BUILD_KEY_SIZE = 256;
const MAX_COMMIT_ID_SIZE = 64;
const MAX_TAG_SIZE = 256;
const MAX_REQUEST_BODY_SIZE = 4096;
const JSON_CONTENT_TYPE = "application/json";
const URL_ENCODED_CONTENT_TYPE = "application/x-www-form-urlencoded";
const MULTIPART_CONTENT_TYPE = "multipart/form-data";
const textEncoder = new TextEncoder();

type BuildAssetRow = {
  asset_id: number;
  commit_id: string | null;
  tag: string | null;
};

type BuildAssetListRow = {
  build_key: string;
  asset_id: number;
  commit_id: string | null;
  tag: string | null;
};

type BuildAsset = {
  buildKey: string;
  assetId: number;
  commitId: string | null;
  tag: string | null;
};

type BuildAssetInput = Pick<BuildAsset, "buildKey" | "assetId"> & {
  metadata: Pick<BuildAsset, "commitId" | "tag"> | null;
};

export type GetBuildAssetResponse =
  | Pick<BuildAsset, "assetId" | "commitId" | "tag">
  | null
  | ErrorResponse;

export type GetBuildAssetListResponse = BuildAsset[] | ErrorResponse;

export type CreateBuildAssetResponse = BuildAsset | ErrorResponse;

const parseBuildKey = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    textEncoder.encode(value).byteLength > MAX_BUILD_KEY_SIZE
  ) {
    throw new ApiError(
      `buildKey must be a non-empty string of at most ${MAX_BUILD_KEY_SIZE} UTF-8 bytes without surrounding whitespace`,
    );
  }
  return value;
};

const parseAssetId = (value: unknown, allowString: boolean): number => {
  const numberValue =
    allowString && typeof value === "string" && /^[0-9]+$/.test(value)
      ? Number(value)
      : value;
  if (
    typeof numberValue !== "number" ||
    !Number.isInteger(numberValue) ||
    numberValue <= 0 ||
    numberValue > 2147483647
  ) {
    throw new ApiError("assetId must be a positive 32-bit integer");
  }
  return numberValue;
};

const parseNullableString = (
  value: unknown,
  field: "commitId" | "tag",
  maxSize: number,
  emptyStringIsNull: boolean,
): string | null => {
  if (value === null || (emptyStringIsNull && value === "")) return null;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    textEncoder.encode(value).byteLength > maxSize
  ) {
    throw new ApiError(
      `${field} must be null or a non-empty string of at most ${maxSize} UTF-8 bytes without surrounding whitespace`,
    );
  }
  return value;
};

const hasExactKeys = (values: string[], expected: string[]): boolean => {
  return (
    values.length === expected.length &&
    expected.every((key) => values.includes(key))
  );
};

const hasMetadataKeys = (keys: Iterable<string>): boolean => {
  const values = [...keys];
  if (hasExactKeys(values, ["buildKey", "assetId"])) return false;
  if (
    hasExactKeys(values, ["buildKey", "assetId", "commitId", "tag"])
  ) {
    return true;
  }
  throw new ApiError(
    "Request body must contain only buildKey and assetId, with both commitId and tag optionally included",
  );
};

const readBodyBytes = async (request: Request): Promise<Uint8Array> => {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REQUEST_BODY_SIZE
  ) {
    throw new ApiError("Request body is too large");
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_REQUEST_BODY_SIZE) {
    throw new ApiError("Request body is too large");
  }
  return bytes;
};

const readJsonBody = (bytes: Uint8Array): BuildAssetInput => {
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError("Request body is not valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError("Request body must be a JSON object");
  }
  const record = body as Record<string, unknown>;
  const metadataProvided = hasMetadataKeys(Object.keys(record));
  return {
    buildKey: parseBuildKey(record.buildKey),
    assetId: parseAssetId(record.assetId, false),
    metadata: metadataProvided
      ? {
          commitId: parseNullableString(
            record.commitId,
            "commitId",
            MAX_COMMIT_ID_SIZE,
            false,
          ),
          tag: parseNullableString(record.tag, "tag", MAX_TAG_SIZE, false),
        }
      : null,
  };
};

const readFormBody = async (
  bytes: Uint8Array,
  contentType: string,
): Promise<BuildAssetInput> => {
  let form: FormData;
  try {
    form = await new Response(bytes, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new ApiError("Request body is not valid form data");
  }
  const keys = [...new Set(form.keys())];
  const metadataProvided = hasMetadataKeys(keys);
  const buildKeyValues = form.getAll("buildKey");
  const assetIdValues = form.getAll("assetId");
  if (
    buildKeyValues.length !== 1 ||
    assetIdValues.length !== 1 ||
    typeof buildKeyValues[0] !== "string" ||
    typeof assetIdValues[0] !== "string"
  ) {
    throw new ApiError("buildKey and assetId must each be one form field");
  }
  const commitIdValues = form.getAll("commitId");
  const tagValues = form.getAll("tag");
  if (
    metadataProvided &&
    (commitIdValues.length !== 1 ||
      tagValues.length !== 1 ||
      typeof commitIdValues[0] !== "string" ||
      typeof tagValues[0] !== "string")
  ) {
    throw new ApiError("commitId and tag must each be one form field");
  }
  return {
    buildKey: parseBuildKey(buildKeyValues[0]),
    assetId: parseAssetId(assetIdValues[0], true),
    metadata: metadataProvided
      ? {
          commitId: parseNullableString(
            commitIdValues[0],
            "commitId",
            MAX_COMMIT_ID_SIZE,
            true,
          ),
          tag: parseNullableString(
            tagValues[0],
            "tag",
            MAX_TAG_SIZE,
            true,
          ),
        }
      : null,
  };
};

const readBuildAsset = async (request: Request): Promise<BuildAssetInput> => {
  const url = new URL(request.url);
  if ([...url.searchParams].length > 0) {
    throw new ApiError("POST query parameters are not allowed");
  }
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (
    mediaType !== JSON_CONTENT_TYPE &&
    mediaType !== URL_ENCODED_CONTENT_TYPE &&
    mediaType !== MULTIPART_CONTENT_TYPE
  ) {
    throw new ApiError("Content-Type must be JSON or form data");
  }
  const bytes = await readBodyBytes(request);
  return mediaType === JSON_CONTENT_TYPE
    ? readJsonBody(bytes)
    : readFormBody(bytes, contentType);
};

export const getBuildAsset = async (
  request: Request,
  database: D1Database,
): Promise<Pick<BuildAsset, "assetId" | "commitId" | "tag"> | null> => {
  if (request.body !== null) {
    throw new ApiError("GET request body is not allowed");
  }
  const searchParams = new URL(request.url).searchParams;
  const buildKeyValues = searchParams.getAll("buildKey");
  if (
    buildKeyValues.length !== 1 ||
    [...searchParams.keys()].some((key) => key !== "buildKey")
  ) {
    throw new ApiError("GET query must contain exactly one buildKey");
  }
  const buildKey = parseBuildKey(buildKeyValues[0]);
  const row = await database
    .prepare(
      `SELECT asset_id, commit_id, tag
       FROM build_asset WHERE build_key = ? LIMIT 1`,
    )
    .bind(buildKey)
    .first<BuildAssetRow>();
  return row === null
    ? null
    : {
        assetId: row.asset_id,
        commitId: row.commit_id,
        tag: row.tag,
      };
};

export const getBuildAssetList = async (
  request: Request,
  database: D1Database,
): Promise<BuildAsset[]> => {
  if (request.body !== null) {
    throw new ApiError("GET request body is not allowed");
  }
  const searchParams = new URL(request.url).searchParams;
  if ([...searchParams].length > 0) {
    throw new ApiError("GET query parameters are not allowed");
  }
  const { results } = await database
    .prepare(
      `SELECT build_key, asset_id, commit_id, tag
       FROM build_asset ORDER BY build_key`,
    )
    .all<BuildAssetListRow>();
  return results.map((row) => ({
    buildKey: row.build_key,
    assetId: row.asset_id,
    commitId: row.commit_id,
    tag: row.tag,
  }));
};

export const createBuildAsset = async (
  request: Request,
  database: D1Database,
): Promise<BuildAsset> => {
  const buildAsset = await readBuildAsset(request);
  const statement =
    buildAsset.metadata === null
      ? database
          .prepare(
            `INSERT INTO build_asset (build_key, asset_id) VALUES (?, ?)
             ON CONFLICT(build_key) DO UPDATE SET asset_id = excluded.asset_id
             RETURNING build_key, asset_id, commit_id, tag`,
          )
          .bind(buildAsset.buildKey, buildAsset.assetId)
      : database
          .prepare(
            `INSERT INTO build_asset (build_key, asset_id, commit_id, tag)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(build_key) DO UPDATE SET
               asset_id = excluded.asset_id,
               commit_id = excluded.commit_id,
               tag = excluded.tag
             RETURNING build_key, asset_id, commit_id, tag`,
          )
          .bind(
            buildAsset.buildKey,
            buildAsset.assetId,
            buildAsset.metadata.commitId,
            buildAsset.metadata.tag,
          );
  const row = await statement.first<BuildAssetListRow>();
  if (row === null) throw new Error("Build asset upsert returned no row");
  return {
    buildKey: row.build_key,
    assetId: row.asset_id,
    commitId: row.commit_id,
    tag: row.tag,
  };
};

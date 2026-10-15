import { ApiError } from "./errors";
import { extractSnapshotJson, MAX_ZIP_SIZE } from "./zip";

const MAX_REQUEST_BODY_SIZE = 1024;

type SnapshotRow = {
  import_id: number | null;
};

type SnapshotListRow = {
  id: number;
  import_id: number | null;
};

type DetectionResult = {
  id: number;
  importId: number;
  created: boolean;
};

const parsePositiveSafeInteger = (value: unknown, name: string): number => {
  const numberValue =
    typeof value === "string" && /^[0-9]+$/.test(value)
      ? Number(value)
      : value;
  if (
    typeof numberValue !== "number" ||
    !Number.isSafeInteger(numberValue) ||
    numberValue <= 0
  ) {
    throw new ApiError(`${name} must be a positive safe integer`);
  }
  return numberValue;
};

const getStoredImportId = async (
  database: D1Database,
  id: number,
): Promise<number | null> => {
  const row = await database
    .prepare("SELECT import_id FROM snapshot WHERE id = ? LIMIT 1")
    .bind(id)
    .first<SnapshotRow>();
  return row?.import_id ?? null;
};

const readDetectionRequest = async (
  request: Request,
): Promise<{ id: number; importId: number }> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError("Content-Type must be application/json");
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_SIZE) {
    throw new ApiError("Request body is too large");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BODY_SIZE) {
    throw new ApiError("Request body is too large");
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError("Request body is not valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError("Request body must be an object");
  }
  const record = body as Record<string, unknown>;
  return {
    id: parsePositiveSafeInteger(record.id, "id"),
    importId: parsePositiveSafeInteger(record.importId, "importId"),
  };
};

const fetchSnapshotId = async (importId: number): Promise<number> => {
  const attachmentUrl = `https://github.com/user-attachments/files/${importId}/file.zip`;
  let response: Response;
  try {
    response = await fetch(attachmentUrl);
  } catch {
    throw new ApiError("Unable to fetch the GitHub attachment");
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new ApiError("GitHub attachment was not found");
    }
    throw new ApiError(`GitHub attachment returned HTTP ${response.status}`);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ZIP_SIZE) {
    throw new ApiError("ZIP exceeds the size limit");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_ZIP_SIZE) {
    throw new ApiError("ZIP exceeds the size limit");
  }
  let text: string;
  try {
    text = await extractSnapshotJson(bytes);
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Invalid snapshot ZIP",
    );
  }
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(text);
  } catch {
    throw new ApiError("snapshot.json is not valid JSON");
  }
  if (typeof snapshot !== "object" || snapshot === null) {
    throw new ApiError("snapshot.json must contain an object");
  }
  return parsePositiveSafeInteger(
    (snapshot as Record<string, unknown>).id,
    "snapshot.id",
  );
};

export const getImportId = async (
  idValue: unknown,
  database: D1Database,
): Promise<number | null> => {
  return getStoredImportId(
    database,
    parsePositiveSafeInteger(idValue, "id"),
  );
};

export const getSnapshotList = async (
  database: D1Database,
): Promise<SnapshotListRow[]> => {
  const { results } = await database.prepare(
    "SELECT id, import_id FROM snapshot ORDER BY id",
  ).all<SnapshotListRow>();
  return results;
};

const detectSnapshotById = async (
  id: number,
  importId: number,
  env: Env,
): Promise<DetectionResult> => {
  const existingImportId = await getStoredImportId(env.DB, id);
  if (existingImportId !== null) {
    return { id, importId: existingImportId, created: false };
  }

  const snapshotId = await fetchSnapshotId(importId);
  if (snapshotId !== id) {
    throw new ApiError(
      `snapshot.json id ${snapshotId} does not match requested id ${id}`,
    );
  }
  await env.DB.prepare(
    `INSERT INTO snapshot (id, import_id) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET import_id = excluded.import_id
     WHERE snapshot.import_id IS NULL`,
  )
    .bind(id, importId)
    .run();
  const canonicalImportId = await getStoredImportId(env.DB, id);
  if (canonicalImportId === null) {
    throw new Error("D1 did not persist the snapshot mapping");
  }
  return {
    id,
    importId: canonicalImportId,
    created: canonicalImportId === importId,
  };
};

export const detectSnapshot = async (
  idValue: unknown,
  importIdValue: unknown,
  env: Env,
): Promise<DetectionResult> => {
  return detectSnapshotById(
    parsePositiveSafeInteger(idValue, "id"),
    parsePositiveSafeInteger(importIdValue, "importId"),
    env,
  );
};

export const detectSnapshotFromRequest = async (
  request: Request,
  env: Env,
): Promise<DetectionResult> => {
  const { id, importId } = await readDetectionRequest(request);
  return detectSnapshotById(id, importId, env);
};

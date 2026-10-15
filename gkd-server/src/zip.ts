import { Unzip, UnzipInflate } from "fflate";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const MAX_ZIP_COMMENT_SIZE = 0xffff;
const UTF8_FLAG = 0x0800;
const ENCRYPTED_FLAG = 0x0001;

export const MAX_ZIP_SIZE = 16 * 1024 * 1024;
export const MAX_UNCOMPRESSED_SIZE = 32 * 1024 * 1024;
export const MAX_SNAPSHOT_JSON_SIZE = 4 * 1024 * 1024;
export const MAX_ENTRY_COUNT = 8;
export const MAX_ENTRY_NAME_SIZE = 256;

type ZipEntryMetadata = {
  name: string;
  compressionMethod: number;
  flags: number;
  uncompressedSize: number;
};

const decodeEntryName = (bytes: Uint8Array, flags: number): string => {
  if ((flags & UTF8_FLAG) === 0 && bytes.some((byte) => byte > 0x7f)) {
    throw new Error("ZIP entry names must use UTF-8 or ASCII");
  }
  try {
    return new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes);
  } catch {
    throw new Error("ZIP contains an invalid UTF-8 entry name");
  }
};

const assertSafeEntryName = (name: string): void => {
  if (
    name.length === 0 ||
    name.includes("\0") ||
    name.includes("\\") ||
    name.startsWith("/") ||
    /^[A-Za-z]:/.test(name)
  ) {
    throw new Error("ZIP contains an unsafe entry path");
  }
  const path = name.endsWith("/") ? name.slice(0, -1) : name;
  const segments = path.split("/");
  if (
    segments.length === 0 ||
    segments.length > 8 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.length > 128,
    )
  ) {
    throw new Error("ZIP contains an unsafe entry path");
  }
};

export const assertSafeSnapshotZip = (data: Uint8Array): void => {
  if (data.byteLength > MAX_ZIP_SIZE) {
    throw new Error("ZIP exceeds the compressed size limit");
  }
  if (data.byteLength < EOCD_MIN_SIZE) {
    throw new Error("Not a valid ZIP file");
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const searchStart = Math.max(
    0,
    data.byteLength - EOCD_MIN_SIZE - MAX_ZIP_COMMENT_SIZE,
  );
  let eocdOffset = -1;
  for (
    let offset = data.byteLength - EOCD_MIN_SIZE;
    offset >= searchStart;
    offset--
  ) {
    if (
      view.getUint32(offset, true) === EOCD_SIGNATURE &&
      offset + EOCD_MIN_SIZE + view.getUint16(offset + 20, true) ===
        data.byteLength
    ) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Not a valid ZIP file");

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDisk = view.getUint16(eocdOffset + 6, true);
  const diskEntryCount = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    diskEntryCount !== entryCount ||
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    throw new Error("Split and ZIP64 archives are not supported");
  }
  if (entryCount > MAX_ENTRY_COUNT) {
    throw new Error("ZIP contains too many entries");
  }
  if (
    centralOffset > eocdOffset ||
    centralSize > eocdOffset - centralOffset ||
    centralOffset + centralSize !== eocdOffset
  ) {
    throw new Error("ZIP central directory is corrupt");
  }

  const entries: ZipEntryMetadata[] = [];
  let offset = centralOffset;
  let totalUncompressedSize = 0;
  while (offset < eocdOffset) {
    if (
      offset + 46 > eocdOffset ||
      view.getUint32(offset, true) !== CENTRAL_FILE_SIGNATURE
    ) {
      throw new Error("ZIP central directory is corrupt");
    }
    const flags = view.getUint16(offset + 8, true);
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error("ZIP64 archives are not supported");
    }
    if (nameLength > MAX_ENTRY_NAME_SIZE) {
      throw new Error("ZIP entry name exceeds the size limit");
    }
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > eocdOffset) {
      throw new Error("ZIP central directory is corrupt");
    }
    const nameBytes = data.subarray(offset + 46, offset + 46 + nameLength);
    const name = decodeEntryName(nameBytes, flags);
    assertSafeEntryName(name);
    entries.push({ name, compressionMethod, flags, uncompressedSize });
    totalUncompressedSize += uncompressedSize;
    if (
      !Number.isSafeInteger(totalUncompressedSize) ||
      totalUncompressedSize > MAX_UNCOMPRESSED_SIZE
    ) {
      throw new Error("ZIP exceeds the uncompressed size limit");
    }
    offset = nextOffset;
  }
  if (entries.length !== entryCount || offset !== eocdOffset) {
    throw new Error("ZIP central directory entry count is inconsistent");
  }

  const snapshotEntries = entries.filter(
    (entry) => entry.name === "snapshot.json",
  );
  if (snapshotEntries.length !== 1) {
    throw new Error("ZIP must contain exactly one root snapshot.json entry");
  }
  const snapshotEntry = snapshotEntries[0];
  if (!snapshotEntry) throw new Error("snapshot.json is missing");
  if ((snapshotEntry.flags & ENCRYPTED_FLAG) !== 0) {
    throw new Error("Encrypted ZIP entries are not supported");
  }
  if (
    snapshotEntry.compressionMethod !== 0 &&
    snapshotEntry.compressionMethod !== 8
  ) {
    throw new Error("snapshot.json uses an unsupported compression method");
  }
  if (snapshotEntry.uncompressedSize > MAX_SNAPSHOT_JSON_SIZE) {
    throw new Error("snapshot.json exceeds the size limit");
  }
};

export const extractSnapshotJson = async (
  data: Uint8Array,
): Promise<string> => {
  assertSafeSnapshotZip(data);
  return await new Promise<string>((resolve, reject) => {
    let found = false;
    let settled = false;
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const unzip = new Unzip((file) => {
      if (file.name !== "snapshot.json") return;
      if (found) {
        fail(new Error("ZIP contains duplicate snapshot.json entries"));
        return;
      }
      found = true;
      file.ondata = (error, chunk, final) => {
        if (error) {
          fail(error);
          return;
        }
        if (settled) return;
        if (byteLength + chunk.byteLength > MAX_SNAPSHOT_JSON_SIZE) {
          file.terminate();
          fail(new Error("snapshot.json exceeds the size limit"));
          return;
        }
        chunks.push(chunk);
        byteLength += chunk.byteLength;
        if (!final) return;
        const result = new Uint8Array(byteLength);
        let resultOffset = 0;
        for (const part of chunks) {
          result.set(part, resultOffset);
          resultOffset += part.byteLength;
        }
        try {
          const text = new TextDecoder("utf-8", {
            fatal: true,
            ignoreBOM: false,
          }).decode(result);
          settled = true;
          resolve(text);
        } catch {
          fail(new Error("snapshot.json is not valid UTF-8"));
        }
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    try {
      unzip.push(data, true);
      if (!found) fail(new Error("snapshot.json is missing"));
    } catch (error) {
      fail(error);
    }
  });
};

import { env, exports } from "cloudflare:workers";
import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBuildAssetList } from "../src/build-asset";
import app from "../src/index";

const GKD_SERVER_TOKEN = "test-gkd-api-auth-token";
const TEST_COMMIT_ID = "0123456789abcdef0123456789abcdef01234567";

const makeSnapshotZip = (id: number): Uint8Array => {
  return zipSync(
    {
      "snapshot.json": strToU8(JSON.stringify({ id, nodes: [] })),
      "screenshot.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    },
    { level: 0 },
  );
};

const makeAttachmentResponse = (id: number): Response => {
  const bytes = makeSnapshotZip(id);
  return new Response(bytes, {
    headers: {
      "Content-Length": String(bytes.byteLength),
      "Content-Type": "application/zip",
    },
  });
};

const postDetection = (id: number, importId: number): Promise<Response> => {
  return exports.default.fetch(
    "https://worker.test/snapshot-detect/detectSnapshot",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, importId }),
    },
  );
};

const postBuildAsset = (
  body: BodyInit,
  contentType?: string,
  query = "",
  authorization: string | null = `Bearer ${GKD_SERVER_TOKEN}`,
): Promise<Response> => {
  const headers = new Headers();
  if (contentType) headers.set("Content-Type", contentType);
  if (authorization !== null) {
    headers.set("Authorization", authorization);
  }
  return exports.default.fetch(
    `https://worker.test/build-asset/createBuildAsset${query}`,
    {
      method: "POST",
      headers,
      body,
    },
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("routing and CORS", () => {
  it("returns JSON errors with HTTP 200 and 204 for preflight", async () => {
    const missing = await exports.default.fetch("https://worker.test/missing");
    expect(missing.status).toBe(200);
    expect(await missing.json()).toEqual({
      error: true,
      message: "Not Found",
    });

    const unknownApi = await exports.default.fetch(
      "https://worker.test/snapshot-detect/unknown",
    );
    expect(unknownApi.status).toBe(200);

    const preflight = await exports.default.fetch(
      "https://worker.test/build-asset/createBuildAsset",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://client.test",
          "Access-Control-Request-Headers": "Authorization, Content-Type",
          "Access-Control-Request-Method": "POST",
        },
      },
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
    expect(preflight.headers.get("access-control-allow-methods")).toBe(
      "GET,HEAD,POST,OPTIONS",
    );
    expect(preflight.headers.get("access-control-allow-headers")).toContain(
      "Authorization",
    );
    expect(preflight.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns HTTP 200 errors for unsupported methods", async () => {
    const response = await exports.default.fetch(
      "https://worker.test/snapshot-detect/getImportId?id=123",
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");

    const detection = await exports.default.fetch(
      "https://worker.test/snapshot-detect/detectSnapshot",
      { method: "PUT" },
    );
    expect(detection.status).toBe(200);
    expect(detection.headers.get("allow")).toBe(
      "GET, HEAD, POST, OPTIONS",
    );
  });

  it("serves HEAD through registered GET routes", async () => {
    const response = await exports.default.fetch(
      "https://worker.test/snapshot-detect/getImportId?id=123",
      { method: "HEAD" },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});

describe("snapshot detection", () => {
  it("returns null before insertion and persists a verified mapping", async () => {
    const lookupBefore = await exports.default.fetch(
      "https://worker.test/snapshot-detect/getImportId?id=123",
    );
    expect(lookupBefore.status).toBe(200);
    expect(await lookupBefore.json()).toBeNull();

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(makeAttachmentResponse(123)));
    const created = await postDetection(123, 456);
    expect(created.status).toBe(200);
    expect(await created.json()).toEqual({
      id: 123,
      importId: 456,
      created: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.com/user-attachments/files/456/file.zip",
    );

    const lookupAfter = await exports.default.fetch(
      "https://worker.test/snapshot-detect/getImportId?id=123",
    );
    expect(await lookupAfter.json()).toBe(456);
    const row = await env.DB.prepare(
      "SELECT id, import_id FROM snapshot WHERE id = ?",
    )
      .bind(123)
      .first();
    expect(row).toEqual({ id: 123, import_id: 456 });
  });

  it("is idempotent and skips the attachment fetch for existing rows", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(makeAttachmentResponse(123)),
    );
    expect((await postDetection(123, 456)).status).toBe(200);
    vi.restoreAllMocks();
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const duplicate = await postDetection(123, 999);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({
      id: 123,
      importId: 456,
      created: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles concurrent writes without overwriting the winning mapping", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      return Promise.resolve(makeAttachmentResponse(123));
    });
    const responses = await Promise.all([
      postDetection(123, 456),
      postDetection(123, 789),
    ]);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    const stored = await env.DB.prepare(
      "SELECT import_id FROM snapshot WHERE id = 123",
    ).first<{ import_id: number }>();
    expect([456, 789]).toContain(stored?.import_id);
  });

  it("lists stored snapshots", async () => {
    await env.DB.prepare(
      "INSERT INTO snapshot (id, import_id) VALUES (?, ?), (?, ?)",
    )
      .bind(2, 20, 1, 10)
      .run();
    const response = await exports.default.fetch(
      "https://worker.test/snapshot-detect/getSnapshotList",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: 1, import_id: 10 },
      { id: 2, import_id: 20 },
    ]);
  });

  it("supports the legacy GET parameters for detection", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(makeAttachmentResponse(123)),
    );
    const response = await exports.default.fetch(
      "https://worker.test/snapshot-detect/detectSnapshot?id=123&importId=456",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 123,
      importId: 456,
      created: true,
    });
  });

  it("rejects invalid parameters and mismatched snapshots", async () => {
    const invalid = await exports.default.fetch(
      "https://worker.test/snapshot-detect/getImportId?id=9007199254740992",
    );
    expect(invalid.status).toBe(200);
    expect(await invalid.json()).toEqual({
      error: true,
      message: "id must be a positive safe integer",
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(makeAttachmentResponse(999)),
    );
    const mismatch = await postDetection(123, 456);
    expect(mismatch.status).toBe(200);
    expect(await mismatch.json()).toEqual({
      error: true,
      message: "snapshot.json id 999 does not match requested id 123",
    });
  });

  it("rejects malformed archives", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(new Uint8Array([1, 2, 3]))),
    );
    const response = await postDetection(123, 456);
    expect(response.status).toBe(200);
    expect((await response.json()) as object).toMatchObject({
      error: true,
    });
  });
});

describe("build assets", () => {
  it("lists all build assets in build key order", async () => {
    const empty = await exports.default.fetch(
      "https://worker.test/build-asset/getBuildAssetList",
    );
    expect(empty.status).toBe(200);
    expect(empty.headers.get("cache-control")).toBe("no-store");
    expect(await empty.json()).toEqual([]);

    await env.DB.prepare(
      `INSERT INTO build_asset (build_key, asset_id)
       VALUES (?, ?), (?, ?), (?, ?)`,
    )
      .bind("release:2", 200, "release:10", 1000, "release:1", 100)
      .run();
    await env.DB.prepare(
      `UPDATE build_asset SET commit_id = ?, tag = ? WHERE build_key = ?`,
    )
      .bind(TEST_COMMIT_ID, "v10.0.0", "release:10")
      .run();

    const response = await exports.default.fetch(
      "https://worker.test/build-asset/getBuildAssetList",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        buildKey: "release:1",
        assetId: 100,
        commitId: null,
        tag: null,
      },
      {
        buildKey: "release:10",
        assetId: 1000,
        commitId: TEST_COMMIT_ID,
        tag: "v10.0.0",
      },
      {
        buildKey: "release:2",
        assetId: 200,
        commitId: null,
        tag: null,
      },
    ]);
  });

  it("rejects parameters from forbidden sources for the build asset list", async () => {
    const query = await exports.default.fetch(
      "https://worker.test/build-asset/getBuildAssetList?buildKey=release%3A1",
    );
    expect(query.status).toBe(200);
    expect(await query.json()).toEqual({
      error: true,
      message: "GET query parameters are not allowed",
    });

    const path = await exports.default.fetch(
      "https://worker.test/build-asset/getBuildAssetList/release%3A1",
    );
    expect(path.status).toBe(200);
    expect(await path.json()).toMatchObject({ error: true });

    await env.DB.prepare(
      `INSERT INTO build_asset (build_key, asset_id)
       VALUES (?, ?), (?, ?)`,
    )
      .bind("release:1", 100, "release:2", 200)
      .run();
    const header = await exports.default.fetch(
      "https://worker.test/build-asset/getBuildAssetList",
      { headers: { "X-Build-Key": "release:1" } },
    );
    expect(header.status).toBe(200);
    expect(await header.json()).toEqual([
      {
        buildKey: "release:1",
        assetId: 100,
        commitId: null,
        tag: null,
      },
      {
        buildKey: "release:2",
        assetId: 200,
        commitId: null,
        tag: null,
      },
    ]);

    const requestWithBody = new Request(
      "https://worker.test/build-asset/getBuildAssetList",
    );
    Object.defineProperty(requestWithBody, "body", {
      value: new ReadableStream(),
    });
    await expect(getBuildAssetList(requestWithBody, env.DB)).rejects.toThrow(
      "GET request body is not allowed",
    );
  });

  it("requires the shared bearer token before writing", async () => {
    const malformed = await postBuildAsset(
      "not-json",
      "application/json",
      "?forbidden=true",
      null,
    );
    expect(malformed.status).toBe(200);
    expect(await malformed.json()).toEqual({
      error: true,
      message: "Unauthorized",
    });

    for (const authorization of [
      null,
      "",
      "Bearer wrong-token",
      `Token ${GKD_SERVER_TOKEN}`,
    ]) {
      const response = await postBuildAsset(
        JSON.stringify({ buildKey: "unauthorized", assetId: 123 }),
        "application/json",
        "",
        authorization,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        error: true,
        message: "Unauthorized",
      });
    }

    expect(
      await env.DB.prepare(
        "SELECT asset_id FROM build_asset WHERE build_key = ?",
      )
        .bind("unauthorized")
        .first(),
    ).toBeNull();
  });

  it("fails closed when the Worker token is not configured", async () => {
    const response = await app.request(
      "https://worker.test/build-asset/createBuildAsset",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GKD_SERVER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ buildKey: "unconfigured", assetId: 123 }),
      },
      {
        DB: env.DB,
        RATE_LIMITER: env.RATE_LIMITER,
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      error: true,
      message: "Unauthorized",
    });
  });

  it("returns null before creation and reads a JSON-created asset", async () => {
    const missing = await exports.default.fetch(
      "https://worker.test/build-asset/getBuildAsset?buildKey=release%3A1",
    );
    expect(missing.status).toBe(200);
    expect(await missing.json()).toBeNull();

    const created = await postBuildAsset(
      JSON.stringify({ buildKey: "release:1", assetId: 456 }),
      "application/json",
    );
    expect(created.status).toBe(200);
    expect(await created.json()).toEqual({
      buildKey: "release:1",
      assetId: 456,
      commitId: null,
      tag: null,
    });

    const found = await exports.default.fetch(
      "https://worker.test/build-asset/getBuildAsset?buildKey=release%3A1",
    );
    expect(await found.json()).toEqual({
      assetId: 456,
      commitId: null,
      tag: null,
    });
    expect(
      await env.DB.prepare(
        `SELECT build_key, asset_id, commit_id, tag
         FROM build_asset WHERE build_key = ?`,
      )
        .bind("release:1")
        .first(),
    ).toEqual({
      build_key: "release:1",
      asset_id: 456,
      commit_id: null,
      tag: null,
    });
  });

  it("upserts metadata and preserves it for legacy requests", async () => {
    await postBuildAsset(
      JSON.stringify({
        buildKey: "release:1",
        assetId: 456,
        commitId: TEST_COMMIT_ID,
        tag: "v1.0.0",
      }),
      "application/json",
    );
    const legacyUpdate = await postBuildAsset(
      JSON.stringify({ buildKey: "release:1", assetId: 789 }),
      "application/json",
    );
    expect(await legacyUpdate.json()).toEqual({
      buildKey: "release:1",
      assetId: 789,
      commitId: TEST_COMMIT_ID,
      tag: "v1.0.0",
    });

    const found = await exports.default.fetch(
      "https://worker.test/build-asset/getBuildAsset?buildKey=release%3A1",
    );
    expect(await found.json()).toEqual({
      assetId: 789,
      commitId: TEST_COMMIT_ID,
      tag: "v1.0.0",
    });

    const cleared = await postBuildAsset(
      JSON.stringify({
        buildKey: "release:1",
        assetId: 789,
        commitId: null,
        tag: null,
      }),
      "application/json",
    );
    expect(await cleared.json()).toEqual({
      buildKey: "release:1",
      assetId: 789,
      commitId: null,
      tag: null,
    });
  });

  it("accepts URL-encoded and multipart forms", async () => {
    const urlEncoded = await postBuildAsset(
      new URLSearchParams({
        buildKey: "form:1",
        assetId: "123",
        commitId: TEST_COMMIT_ID,
        tag: "",
      }),
      "application/x-www-form-urlencoded",
    );
    expect(await urlEncoded.json()).toEqual({
      buildKey: "form:1",
      assetId: 123,
      commitId: TEST_COMMIT_ID,
      tag: null,
    });

    const form = new FormData();
    form.set("buildKey", "form:2");
    form.set("assetId", "234");
    form.set("commitId", "");
    form.set("tag", "v2.0.0");
    const multipart = await postBuildAsset(form);
    expect(await multipart.json()).toEqual({
      buildKey: "form:2",
      assetId: 234,
      commitId: null,
      tag: "v2.0.0",
    });
  });

  it("rejects forbidden parameter sources and malformed values", async () => {
    const invalidGet = await exports.default.fetch(
      "https://worker.test/build-asset/getBuildAsset?buildKey=a&extra=b",
    );
    expect(await invalidGet.json()).toEqual({
      error: true,
      message: "GET query must contain exactly one buildKey",
    });

    const queryPost = await postBuildAsset(
      JSON.stringify({ buildKey: "a", assetId: 1 }),
      "application/json",
      "?extra=b",
    );
    expect(await queryPost.json()).toEqual({
      error: true,
      message: "POST query parameters are not allowed",
    });

    for (const body of [
      { buildKey: "", assetId: 1 },
      { buildKey: " a", assetId: 1 },
      { buildKey: "a", assetId: 0 },
      { buildKey: "a", assetId: 2147483648 },
      { buildKey: "a", assetId: "1" },
      { buildKey: "a", assetId: 1, extra: true },
      { buildKey: "a", assetId: 1, commitId: TEST_COMMIT_ID },
      { buildKey: "a", assetId: 1, commitId: "", tag: null },
      { buildKey: "a", assetId: 1, commitId: null, tag: " release" },
      { buildKey: "a", assetId: 1, commitId: "a".repeat(65), tag: null },
      { buildKey: "a", assetId: 1, commitId: null, tag: "a".repeat(257) },
    ]) {
      const response = await postBuildAsset(
        JSON.stringify(body),
        "application/json",
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ error: true });
    }
  });

  it("rejects unsupported or oversized bodies", async () => {
    const unsupported = await postBuildAsset("buildKey=a&assetId=1", "text/plain");
    expect(await unsupported.json()).toEqual({
      error: true,
      message: "Content-Type must be JSON or form data",
    });

    const oversized = await postBuildAsset(
      JSON.stringify({ buildKey: "a".repeat(4096), assetId: 1 }),
      "application/json",
    );
    expect(await oversized.json()).toEqual({
      error: true,
      message: "Request body is too large",
    });
  });

  it("enforces metadata constraints in D1", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO build_asset (build_key, asset_id, commit_id, tag)
         VALUES (?, ?, ?, ?)`,
      )
        .bind("invalid:commit", 1, "a".repeat(65), null)
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        `INSERT INTO build_asset (build_key, asset_id, commit_id, tag)
         VALUES (?, ?, ?, ?)`,
      )
        .bind("invalid:tag", 1, null, " tag")
        .run(),
    ).rejects.toThrow();
  });
});

describe("GET proxy", () => {
  const currentAttachment =
    "https://github.com/user-attachments/files/30034251/log-1784092724705.zip";
  const legacyAttachment =
    "https://github.com/gkd-kit/inspect/files/14993995/file.zip";
  const objectDownload =
    "https://objects.githubusercontent.com/github-production-repository-file-5c1aeb/661952005/14993995?X-Amz-Signature=test";
  const proxyUrl = (target: string): string =>
    `https://worker.test/proxy?url=${encodeURIComponent(target)}`;

  it("streams the upstream response and strips sensitive headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response("proxied", {
          status: 206,
          headers: {
            "Content-Type": "text/plain",
            "Content-Range": "bytes 0-6/7",
            "Set-Cookie": "secret=value",
            "X-Upstream-Secret": "hidden",
          },
        }),
      ),
    );
    const response = await exports.default.fetch(
      proxyUrl(currentAttachment),
      { headers: { Range: "bytes=0-6", Cookie: "private=value" } },
    );
    expect(response.status).toBe(206);
    expect(await response.text()).toBe("proxied");
    expect(response.headers.get("content-range")).toBe("bytes 0-6/7");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-upstream-secret")).toBeNull();
    const upstreamInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const upstreamHeaders = new Headers(upstreamInit.headers);
    expect(upstreamHeaders.get("range")).toBe("bytes=0-6");
    expect(upstreamHeaders.get("cookie")).toBeNull();
  });

  it("accepts current and legacy GitHub ZIP attachment URLs", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(new Response("attachment")));
    for (const target of [currentAttachment, legacyAttachment]) {
      const response = await exports.default.fetch(proxyUrl(target));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("attachment");
    }
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      currentAttachment,
      legacyAttachment,
    ]);
  });

  it("follows and revalidates GitHub download redirects", async () => {
    let requestCount = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      requestCount++;
      return Promise.resolve(
        requestCount === 1
          ? new Response(null, {
              status: 302,
              headers: { Location: objectDownload },
            })
          : new Response("done"),
      );
    });
    const response = await exports.default.fetch(proxyUrl(legacyAttachment));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      legacyAttachment,
      objectDownload,
    ]);
  });

  it("rejects redirects to unsafe targets", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { Location: "https://127.0.0.1/private" },
        }),
      ),
    );
    const response = await exports.default.fetch(proxyUrl(currentAttachment));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ error: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects non-attachment targets before fetching", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    for (const target of [
      "https://example.com/file.zip",
      "https://f.gkd.li/14993995",
      "https://raw.githubusercontent.com/gkd-kit/inspect/main/file.zip",
      "https://github.com/gkd-kit/inspect/releases/download/v1/file.zip",
      "https://github.com/user-attachments/assets/89796d25-b360-4486-9cf7-79a5e598022c",
      "https://github.com/user-attachments/files/not-a-number/file.zip",
      "https://github.com/user-attachments/files/123/path/file.zip",
      "https://github.com/user-attachments/files/123/file.txt",
      "https://github.com/user-attachments/files/123/file.zip?download=1",
      "https://github.com/user-attachments/files/123/file.zip#fragment",
      "https://github.com/user-attachments/files/123/log%2Fsecret.zip",
      "https://github.com/user-attachments/files/123/log%252Fsecret.zip",
      objectDownload,
      "http://github.com/user-attachments/files/123/file.zip",
      "https://127.0.0.1/data",
      "https://localhost/data",
      "https://worker.test/proxy",
      "https://user:pass@github.com/user-attachments/files/123/file.zip",
      "https://github.com:444/user-attachments/files/123/file.zip",
    ]) {
      const response = await exports.default.fetch(proxyUrl(target));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ error: true });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts url only from exactly one query parameter", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const requests = [
      new Request("https://worker.test/proxy", {
        headers: { "X-Url": currentAttachment },
      }),
      new Request(
        `https://worker.test/proxy?url=${encodeURIComponent(currentAttachment)}&url=${encodeURIComponent(legacyAttachment)}`,
      ),
      new Request("https://worker.test/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentAttachment }),
      }),
    ];
    for (const request of requests) {
      const response = await exports.default.fetch(request);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ error: true });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a JSON error when the native limiter rejects the request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await app.request(
      proxyUrl(currentAttachment),
      undefined,
      {
        RATE_LIMITER: {
          limit: vi.fn().mockResolvedValue({ success: false }),
        } as RateLimit,
      } as Env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      error: true,
      message: "Too many proxy requests",
    });
    expect(response.headers.get("retry-after")).toBe("60");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

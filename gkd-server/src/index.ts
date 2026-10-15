import { Hono } from "hono";
import { cors } from "hono/cors";
import { methodNotAllowed } from "hono/method-not-allowed";
import { assertAuthorization } from "./auth";
import {
  createBuildAsset,
  getBuildAsset,
  getBuildAssetList,
} from "./build-asset";
import { ApiError } from "./errors";
import { handleProxy } from "./proxy";
import {
  detectSnapshot,
  detectSnapshotFromRequest,
  getImportId,
  getSnapshotList,
} from "./snapshot-detect";

type HonoEnv = {
  Bindings: Env & {
    GKD_API_AUTH_TOKEN?: string;
  };
};

const app = new Hono<HonoEnv>();
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

app.use("*", async (context, next) => {
  await next();
  context.header("X-Content-Type-Options", "nosniff");
  if (
    context.req.path !== "/proxy" &&
    context.res.status !== 200 &&
    context.res.headers.get("content-type")?.startsWith("application/json")
  ) {
    context.res = new Response(context.res.body, {
      status: 200,
      headers: context.res.headers,
    });
  }
});

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: [
      "Accept",
      "Accept-Language",
      "Authorization",
      "Content-Type",
      "Range",
      "If-None-Match",
      "If-Modified-Since",
    ],
    allowMethods: ["GET", "HEAD", "POST", "OPTIONS"],
    exposeHeaders: [
      "Accept-Ranges",
      "Content-Disposition",
      "Content-Length",
      "Content-Range",
      "Content-Type",
      "ETag",
      "Last-Modified",
      "Retry-After",
    ],
    maxAge: 86400,
  }),
);

app.use(
  methodNotAllowed({
    app,
    onMethodNotAllowed: (context, methods) => {
      const allowed = [...methods, "OPTIONS"];
      context.header("Allow", allowed.join(", "));
      return context.json({
        error: true,
        message: `Allowed methods: ${allowed.join(", ")}`,
      });
    },
  }),
);

app.get("/snapshot-detect/getSnapshotList", async (context) =>
  context.json(await getSnapshotList(context.env.DB), {
    headers: NO_STORE_HEADERS,
  }),
);
app.get("/snapshot-detect/getImportId", async (context) =>
  context.json(
    await getImportId(context.req.query("id"), context.env.DB),
    { headers: NO_STORE_HEADERS },
  ),
);
app.get("/snapshot-detect/detectSnapshot", async (context) => {
  const result = await detectSnapshot(
    context.req.query("id"),
    context.req.query("importId"),
    context.env,
  );
  return context.json(result, { headers: NO_STORE_HEADERS });
});
app.post("/snapshot-detect/detectSnapshot", async (context) => {
  const result = await detectSnapshotFromRequest(context.req.raw, context.env);
  return context.json(result, { headers: NO_STORE_HEADERS });
});
app.get("/build-asset/getBuildAsset", async (context) =>
  context.json(await getBuildAsset(context.req.raw, context.env.DB), {
    headers: NO_STORE_HEADERS,
  }),
);
app.get("/build-asset/getBuildAssetList", async (context) =>
  context.json(await getBuildAssetList(context.req.raw, context.env.DB), {
    headers: NO_STORE_HEADERS,
  }),
);
app.post("/build-asset/createBuildAsset", async (context) => {
  assertAuthorization(
    context.req.raw,
    context.env.GKD_API_AUTH_TOKEN,
  );
  return context.json(await createBuildAsset(context.req.raw, context.env.DB), {
    headers: NO_STORE_HEADERS,
  });
});
app.get("/proxy", (context) => handleProxy(context.req.raw, context.env));

app.notFound((context) =>
  context.json({ error: true, message: "Not Found" }, 404),
);

app.onError((error, context) => {
  if (error instanceof ApiError) {
    for (const [name, value] of error.headers) context.header(name, value);
    return context.json({
      error: true,
      message: error.message,
    });
  }
  console.error(error);
  return context.json({
    error: true,
    message: "Internal Server Error",
  });
});

export default app;

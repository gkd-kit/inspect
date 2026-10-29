# Inspect 服务端开发说明

服务端使用 Hono 和 Cloudflare Workers，为 GKD 提供快照映射、构建附件查询和公开 GitHub 附件代理。依赖与锁文件统一维护在仓库根目录，前端说明见 [gkd-inspect/README.md](../gkd-inspect/README.md)。

## 目录结构

```text
gkd-server/
├── src/              # Worker API 实现
├── test/             # Workers / D1 集成测试
├── migrations/       # D1 数据库迁移
├── wrangler.jsonc    # Worker 与数据库绑定配置
└── vitest.config.ts  # Cloudflare Vitest 测试配置
```

## 接口说明

- `GET /snapshot-detect/getSnapshotList`：返回已存储的全部快照与导入 ID 映射。
- `GET /snapshot-detect/getImportId?id=<positive-safe-integer>`：根据正安全整数快照 ID 返回已存储的 GitHub 导入 ID，不存在时返回 `null`。
- `GET /snapshot-detect/detectSnapshot?id=123&importId=456`：保留原有的 query 参数接口。
- `POST /snapshot-detect/detectSnapshot`：接受 JSON `{ "id": 123, "importId": 456 }`，作为写入映射的另一种调用方式。GET 和 POST 共用检测逻辑：已有非空映射时直接返回已有导入 ID；否则验证公开 GitHub 附件中的 `snapshot.json` 与请求 ID 一致，再将映射存入 D1。响应为 `{ "id": 123, "importId": 456, "created": true }`，直接返回已有映射时 `created` 为 `false`。
- `GET /build-asset/getBuildAsset?buildKey=<string>`：返回 `{ "assetId": 123, "commitId": "...", "tag": "..." }`，不存在时返回 `null`；两个 Git 元数据字段均可为 `null`。
- `GET /build-asset/getBuildAssetList`：按 `buildKey` 排序，返回全部已存储的 `{ "buildKey": "...", "assetId": 123, "commitId": "...", "tag": "..." }` 映射。
- `POST /build-asset/createBuildAsset`：接受 JSON、URL 编码表单或 multipart 表单，包含 `buildKey` 和 `assetId`，也可同时提供 `commitId` 和 `tag`。接口要求 `Authorization: Bearer <token>`，创建或更新 D1 映射并返回上述四个字段。缺失的 Git 元数据在 JSON 中使用 `null`，在表单中使用空字段；旧版仅传两个字段的更新会保留已有 Git 元数据。
- `GET /proxy?url=<encoded-github-attachment-url>`：流式代理公开 GitHub ZIP 附件，并执行限流与请求头过滤。支持当前的 `https://github.com/user-attachments/files/<id>/<filename>.zip` 和旧版的 `https://github.com/gkd-kit/inspect/files/<id>/<filename>.zip` 链接。

业务路由显式注册 GET 和 POST，HEAD 由 Hono 基于 GET 处理，OPTIONS 由 CORS 中间件处理。不支持的路径、方法及业务错误均返回包含 `error: true` 的 HTTP 200 JSON；正常 JSON 接口直接返回业务数据，不添加响应包装。

代理不会转发 Cookie、认证头或其他私有请求状态。初始地址必须符合上述 GitHub ZIP 附件格式，且不能包含 query 或 fragment。重定向由代码逐次处理，仅允许继续访问受支持的附件地址或 GitHub 的 `objects.githubusercontent.com` 仓库文件存储路径。直接传入 CDN、GitHub Raw、Release、图片附件地址，以及非 GitHub 主机、带凭据的地址、IP 地址、本地主机名、非默认端口和非 HTTPS 地址都会被拒绝。

代理成功时透明传输上游响应，保留上游状态码、选定的响应头和响应体。Worker 自身产生的代理错误遵循上述 JSON 错误协议。

## 认证配置

在 Cloudflare 控制台的 Worker 设置中，将共享的 `GKD_SERVER_TOKEN` 配置为明文变量。Wrangler 已设置 `keep_vars`，部署时会保留控制台管理的变量。本地开发时，在已被 Git 忽略的 `gkd-server/.dev.vars` 中配置：

```dotenv
GKD_SERVER_TOKEN=local-development-token
```

调用需要认证的接口时，将该值作为 Bearer token 发送。缺失、格式错误或不匹配的凭据会在解析请求体或修改 D1 之前被拒绝。

## 本地开发

Node.js 与 pnpm 版本以根目录 `package.json` 的 `devEngines` 为准，依赖版本维护在根目录 `pnpm-workspace.yaml` 中。先在仓库根目录安装依赖，再进入服务端目录：

```sh
pnpm install
cd gkd-server
pnpm d1:migrate:local  # 应用本地 D1 迁移
pnpm dev               # 启动本地 Worker
```

修改 `wrangler.jsonc` 后，可执行 `pnpm types` 刷新编辑器使用的类型；类型检查命令也会自动生成类型。

## 测试与检查

服务端使用 Vitest。以下命令均在 `gkd-server` 目录执行：

```sh
pnpm test        # Workers / D1 集成测试
pnpm test:watch  # 监听模式
pnpm type-check  # 生成 Worker 类型并检查源码和测试类型
pnpm check       # 类型检查、测试和 Wrangler 部署预演
```

部署预演不会发布 Worker 或执行远程数据库迁移。若需检查依赖安全性，可在仓库根目录执行 `pnpm audit --audit-level high --registry=https://registry.npmjs.org/`；该命令不包含在 `check` 或部署工作流中。

在仓库根目录，也可使用 `pnpm dev:server`、`pnpm test:server` 和 `pnpm check:server` 调用对应服务端命令。根目录的 `pnpm check` 会依次检查前后端两个项目。

## 部署

配置将名为 `gkd` 的 D1 数据库绑定为 `DB`。部署构建附件接口前，需应用仓库中的数据库迁移。已有的快照迁移使用 `CREATE TABLE IF NOT EXISTS`，用于记录迁移基线，不会替换快照数据；后续迁移添加 `build_asset` 表及其可为空的 Git 元数据列。

在已配置目标 Cloudflare 账号认证的环境中，从 `gkd-server` 目录执行：

```sh
pnpm check
pnpm d1:migrate:remote  # 应用远程 D1 迁移
pnpm deploy             # 发布 Worker
```

仓库根目录的部署入口为 `pnpm deploy:server`，该命令不会自动执行检查或数据库迁移。

当前 `wrangler.jsonc` 的 Worker 名称为 `gkd-kit-workers`，启用了 `workers.dev`，未声明自定义域名路由。线上域名绑定和回滚目标需以 Cloudflare 账号中的实际配置为准。

[deploy-server.yml](../.github/workflows/deploy-server.yml) 在 `main` 分支的服务端、共享依赖或该工作流文件变化时触发，也支持手动运行。流程使用 `pnpm/setup` 安装根目录声明的运行环境与依赖，再在 `gkd-server` 中依次执行检查、远程 D1 迁移和 Worker 部署。

CI 使用以下仓库 Secrets：

- `CLOUDFLARE_API_TOKEN`：需要 Workers Scripts Edit 和 D1 Edit 权限。
- `CLOUDFLARE_ACCOUNT_ID`：目标 Cloudflare 账号 ID。

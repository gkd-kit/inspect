# Inspect 前端开发说明

## 目录结构

前端使用 Vue、Vite 和 Tailwind CSS。依赖与锁文件统一维护在仓库根目录，后端说明见 [gkd-server/README.md](../gkd-server/README.md)。

```text
gkd-inspect/
├── src/              # app / pages / features / entities / shared
├── eslint-rules/     # 项目 ESLint 规则
├── plugins/          # Vite 插件
├── scripts/          # 构建与维护脚本
├── vite.config.ts    # 开发与构建配置
└── vitest.config.ts  # 前端测试配置
```

## 本地开发

Node.js 与 pnpm 版本以根目录 `package.json` 的 `devEngines` 为准。以下命令均在仓库根目录执行。

```sh
pnpm install
pnpm dev          # 启动前端，默认 http://127.0.0.1:8444
```

前端默认通过 `src/shared/api/workers.ts` 中的 `WORKERS_API_ORIGIN` 访问 `https://api.gkd.li`。联调本地服务端时需调整该地址；启动本地 Worker 不会自动切换前端 API 地址。

## 测试与检查

前端使用 Vitest，以下命令均在仓库根目录执行。

```sh
pnpm test                              # 前端全部测试
pnpm test:watch                        # 前端监听模式
pnpm test src/features/log-viewer      # 按路径筛选前端测试

pnpm lint:check                        # 前端 ESLint 检查
pnpm lint                              # 前端 ESLint 自动修复
pnpm type-check                        # 前端类型检查
pnpm format                            # 全仓库格式化

pnpm --dir gkd-inspect run check        # 前端 lint、类型、测试和构建
```

## 构建与部署

```sh
pnpm build         # 构建到 gkd-inspect/dist
pnpm preview       # 本地预览构建产物
pnpm build:mirror  # 镜像构建，同时更新前端 package.json 的版本号
```

镜像构建将大部分资源地址指向对应 npm 版本的 npmmirror 路径，Worker 入口仍使用同源地址。本地构建和预览使用 `pnpm build`。

[deploy-inspect.yml](../.github/workflows/deploy-inspect.yml) 在 `main` 分支的前端、共享依赖或该工作流文件变化时触发，也支持手动运行。流程执行镜像构建、发布 `@gkd-kit/inspect` 到 npm，再部署到 Cloudflare Pages 和 Netlify。

CI 使用以下配置：

- 需在 npm 包设置中配置 Trusted Publisher，仓库为 `gkd-kit/inspect`，工作流文件名为 `deploy-inspect.yml`；工作流已声明 `id-token: write`。
- Cloudflare Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
- Netlify Secrets：`NETLIFY_AUTH_TOKEN`、`NETLIFY_SITE_ID`。

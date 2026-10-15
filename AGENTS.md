# 项目公共规范

本文件适用于整个仓库。前端专属规范见 [gkd-inspect/AGENTS.md](gkd-inspect/AGENTS.md)，后端专属规范见 [gkd-server/AGENTS.md](gkd-server/AGENTS.md)。

## 临时文件

- 临时文件可以放在项目根目录的 `.local/` 中，该目录已加入 Git 忽略，不提交到仓库。

## 依赖管理

- 将所有项目依赖统一声明在根目录 `package.json` 的 `dependencies` 中，不使用 `devDependencies`、`peerDependencies` 或 `optionalDependencies`。
- 所有依赖版本统一维护在根目录 `pnpm-workspace.yaml` 的默认 `catalog` 中，并使用 `^version` 格式。
- `package.json` 中的依赖必须使用 `catalog:` 引用，不直接填写版本号。
- Node.js 和 pnpm 的开发环境版本统一维护在根目录 `package.json` 的 `devEngines` 中。

## 源码文件类型

- 项目逻辑源码、脚本和包含可执行代码的工具配置只能使用 `.ts`、`.tsx` 或 `.vue` 文件；样式文件使用 `.css`。JSON、JSONC、YAML 等声明式配置及 SQL 数据库迁移不受此扩展名限制。
- 禁止新增 `.js`、`.mjs`、`.cjs`、`.jsx`、`.mts` 或 `.cts` 文件。
- `dist` 构建产物、`node_modules` 依赖及源码中的 JavaScript 输出文件名字符串不受此限制。

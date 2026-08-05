# Dependency management

- 将所有项目依赖统一声明在 `package.json` 的 `dependencies` 中，不使用 `devDependencies`、`peerDependencies` 或 `optionalDependencies`。
- 所有依赖版本统一维护在 `pnpm-workspace.yaml` 的默认 `catalog` 中，并使用 `^version` 格式。
- `package.json` 中的依赖必须使用 `catalog:` 引用，不直接填写版本号。
- Node.js 和 pnpm 的开发环境版本统一维护在 `package.json` 的 `devEngines` 中。

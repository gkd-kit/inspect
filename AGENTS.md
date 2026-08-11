# 项目规范

## 依赖管理

- 将所有项目依赖统一声明在 `package.json` 的 `dependencies` 中，不使用 `devDependencies`、`peerDependencies` 或 `optionalDependencies`。
- 所有依赖版本统一维护在 `pnpm-workspace.yaml` 的默认 `catalog` 中，并使用 `^version` 格式。
- `package.json` 中的依赖必须使用 `catalog:` 引用，不直接填写版本号。
- Node.js 和 pnpm 的开发环境版本统一维护在 `package.json` 的 `devEngines` 中。

## Vue 原生标签

- Vue 模板、JSX/TSX、`h('tag')` 和 `document.createElement('tag')` 只能使用项目白名单中的原生标签。
- 原生标签白名单的唯一代码来源是 `eslint-rules/native-element-allowlist.ts` 中的 `allowedNativeElementNames`，新增标签必须先更新该列表。
- 当前允许的通用及交互标签为：`div`、`span`、`a`、`button`、`input`、`img`、`canvas`、`svg`。
- 当前允许的表格标签为：`table`、`caption`、`colgroup`、`col`、`thead`、`tbody`、`tfoot`、`tr`、`th`、`td`。
- 当前允许的 Vue 内建标签为：`template`、`slot`、`component`。
- 不使用 `header`、`main`、`section`、`aside`、`article`、`nav`、`footer`、`pre`、`code`、`mark` 等白名单外的语义化标签；无原生行为要求时使用 `div` 或 `span`。
- Vue 组件统一使用 PascalCase，禁止用小写组件名绕过或混淆原生标签检查。
- `index.html` 的文档骨架标签及独立 SVG 资源不受此 Vue/TS 规则约束。

## 源码文件类型

- 项目源码、脚本和工具配置只能使用 `.ts`、`.tsx` 或 `.vue` 文件。
- 禁止新增 `.js`、`.mjs`、`.cjs`、`.jsx`、`.mts` 或 `.cts` 文件；ESLint 会将这些扩展名报告为错误。
- `dist` 构建产物、`node_modules` 依赖及源码中的 JavaScript 输出文件名字符串不受此限制。

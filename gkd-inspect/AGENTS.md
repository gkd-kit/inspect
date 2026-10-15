# 前端项目规范

本文件适用于当前目录及其所有子目录，与根目录公共规范共同生效。以下路径均相对于 `gkd-inspect/`。

## Vue 原生标签

- Vue 模板、JSX/TSX、`h('tag')` 和 `document.createElement('tag')` 只能使用项目白名单中的原生标签。
- 原生标签白名单的唯一代码来源是 `eslint-rules/native-element-allowlist.ts` 中的 `allowedNativeElementNames`，新增标签必须先更新该列表。
- 不使用 `header`、`main`、`section`、`aside`、`article`、`nav`、`footer`、`pre`、`code`、`mark` 等白名单外的语义化标签；无原生行为要求时使用 `div` 或 `span`。
- `index.html` 的文档骨架标签及独立 SVG 资源不受此 Vue/TS 规则约束。

## SVG 图标

- SVG 图标文件的根 `<svg>` 元素必须且只能包含 `viewBox` 属性，禁止设置 `xmlns`、`fill`、`stroke`、`width`、`height`、`class`、`style` 等其他属性。
- 单色图标的 `fill`、`stroke`、`stroke-width`、`stroke-linecap`、`stroke-linejoin` 等呈现属性必须写在 `<path>`、`<rect>` 等内部元素上；需要继承组件颜色时使用 `currentColor`。
- 多色图标的颜色、透明度和其他呈现属性也必须写在对应的内部元素上，不得通过根 `<svg>` 统一设置。

## 可复用组件命名

- 跨业务、无领域语义的项目级 UI 组件统一放在 `src/shared/ui`，组件文件名和组件名必须以 `Gk` 开头，例如 `GkSvg`、`GkDraggableCard`。
- `Gk` 前缀只用于共享 UI 基础组件；页面组件和包含业务、路由、Store、网络或持久化语义的组件不得使用 `Gk` 前缀。
- `Gk` 组件只能依赖浏览器 API、第三方 UI、其他 `Gk` 组件以及 `src/shared` 内的通用代码，不得依赖 `app`、`pages`、`features` 或 `entities`。
- 业务组件即使在多个页面复用，也应使用领域前缀表达归属，例如 `SnapshotActionCard`、`SelectorTrackGraph`。
- 与组件绑定的公开类型使用完整组件名前缀，例如 `GkDraggableCardValue`；非组件工具函数不强制使用 `Gk` 前缀。
- 所有项目组件继续使用 PascalCase；禁止通过别名、全局注册或小写标签绕过组件命名检查。

## 源码架构边界

- 源码依赖方向为 `app -> pages -> features -> entities -> shared`，低层不得反向依赖高层。
- `pages` 只负责路由页面组合，业务流程放在 `features`，稳定业务对象和纯逻辑放在 `entities`，无业务语义的能力放在 `shared`。
- 跨功能切片依赖必须在 `eslint-rules/import-boundaries.ts` 的 `featureDependencies` 白名单中声明，禁止通过深层相对路径绕过边界。
- Store 和项目组件必须显式导入，不通过自动导入隐藏业务依赖。

## 响应式状态修改

- 业务状态和共享状态只能在命名 action 中修改；用户事件、路由钩子和生命周期钩子必须显式调用相应 action。
- `computed` 必须保持纯计算，不得在计算过程中修改其他状态或触发路由、网络、存储等副作用。
- 禁止使用 `watch`、`watchEffect`、`watchImmediate`、VueUse watcher、`whenever`、`syncRef` 等观察器隐式修改状态或启动业务流程。
- URL、持久化存储、网络请求和加载状态应在触发操作的 action 中显式更新；异步 action 必须处理过期结果，避免旧请求覆盖新状态。
- 只有隔离 DOM、动画或第三方命令式实例的适配器可以使用 watcher；适配器文件必须加入 `eslint.config.ts` 中 watcher 规则的例外文件列表，且不得修改业务或共享状态。
- Store 对外只暴露只读状态和命名 action，不暴露可由调用方直接修改的响应式对象。

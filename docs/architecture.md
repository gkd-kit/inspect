# 前端架构

## 目标

本项目按职责组织源码，依赖方向固定为：

```text
main -> app -> pages -> features -> entities -> shared
```

本次迁移只调整源码归属、依赖表达和命名约束，不改变路由、接口、存储键、数据库名、交互或视觉行为。

## 目录职责

```text
src/
  app/        应用装配、路由、全局外壳和应用级 UI
  pages/      与路由一一对应的页面入口和页面组合
  features/   用户可感知的业务能力和业务流程
  entities/   稳定业务对象、类型、解析和领域计算
  shared/     不含业务语义的 UI、基础设施、工具和资源
```

- `app` 可以组合所有下层模块，但下层模块不得反向依赖 `app`。
- `pages` 保持轻量，只负责组合 feature 和 entity，不承载可独立复用的业务流程。
- `features` 可以依赖 entity 和 shared。确有必要的跨 feature 依赖必须将目标 feature 及其公开模块加入 ESLint 白名单。
- `entities` 默认只依赖 shared；领域间依赖必须是明确、稳定且单向的。
- `shared` 不得依赖任何业务目录。
- 跨层引用优先使用 `@/` 绝对路径。Node 原生测试直接加载的纯 TypeScript 模块可使用带 `.ts` 后缀的相对路径，以避免运行时无法解析别名。

边界由 `eslint-rules/import-boundaries.ts` 自动检查。

## 组件命名

`src/shared/ui` 中的项目级可复用组件统一以 `Gk` 开头：

- `SvgIcon` 迁移为 `GkSvg`
- `DraggableCard` 迁移为 `GkDraggableCard`
- `FullScreenDialog` 迁移为 `GkFullscreenDialog`
- `BodyScrollbar` 迁移为 `GkBodyScrollbar`

`Gk` 表示无业务语义的共享 UI，不表示“被多个地方使用”。包含领域、路由、Store、网络或持久化语义的组件应留在所属 feature/entity，并使用领域前缀，例如 `SnapshotActionCard`、`SelectorTrackGraph`。

组件均显式导入，不做全局组件注册，也不依赖自动生成的全局组件类型。命名规则由 `eslint-rules/component-conventions.ts` 自动检查。

## 状态与副作用

- 通用浏览器存储适配位于 `shared/storage`。
- 设置状态位于 `features/settings`，沿用 `settings` 存储键。
- 快照元数据位于 `entities/snapshot`，沿用 `importTime`、`snapshotViewedTime`、`githubJpg`、`githubZip`、`url` 等存储键。
- 选择器库位于 `features/selector-library`，继续使用 `selectorLibrary` 数据库、`presets` store、`v1` key 和原广播命名空间。
- Store 只对外暴露只读状态与命名 action；事件、路由和生命周期通过 action 显式修改状态。
- `computed` 保持纯计算，业务流程不使用 watcher 隐式触发。

## 路由页面与业务视图

路由只引用 `pages`：

- `pages/home/HomePage.vue` 组合 `SnapshotListView`
- `pages/import/ImportPage.vue` 组合 `ImportSnapshotView`
- `pages/selector-library/SelectorLibraryPage.vue` 组合 `SelectorLibraryView`
- `pages/snapshot/SnapshotPage.vue` 组合 `SnapshotInspectorView`
- `pages/device/DevicePage.vue` 组合 `DeviceControlView`
- `pages/log/LogPage.vue` 组合 `LogViewerView`
- `pages/selector/SelectorPage.vue` 组合 `SelectorTesterView`
- `pages/svg/SvgPage.vue` 组合 `IconBrowserView`

这样路由入口保持稳定，复杂实现可在 feature 内独立演进。

## 迁移检查

统一执行：

```shell
pnpm check
```

该命令依次运行 ESLint、Vue/TypeScript 类型检查、全部 Node 测试和生产构建。迁移或新增模块时，还应确认：

1. 没有重新引入 `views`、`components`、`domain`、`store`、`composables`、`utils` 等旧式顶层职责目录。
2. 新共享组件使用 `Gk` 前缀，业务组件不使用该前缀。
3. 新依赖遵守分层方向，跨 feature 依赖有明确理由并受 ESLint 白名单约束。
4. 路由路径、接口参数、持久化键和用户可见行为保持兼容。

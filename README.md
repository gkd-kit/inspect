# @gkd-kit/inspect

- <https://i.gkd.li>

GKD 网页端审查工具,

- 抓取快照
- 审查快照
- 分享快照
- 连接调试 GKD 内部 HTTP Server
- 实时启用订阅规则, 实时执行点击选择器
- 选择器路径视图
- 按全局、应用或界面范围收藏并复用选择器
- 可配置生成规则, 支持静态诊断和截图点击生成 `position`

## 本地开发

仓库包含前端 [gkd-inspect](./gkd-inspect) 和服务端 [gkd-server](./gkd-server/README.md)，依赖与锁文件统一放在根目录。

在根目录执行：

```sh
pnpm install
pnpm dev          # 启动前端
pnpm dev:server   # 启动服务端
pnpm check        # 检查两个子项目并执行构建与部署预演
```

前端构建产物位于 `gkd-inspect/dist`。服务端命令可使用 `pnpm --dir gkd-server run <命令>` 执行。

## 运行环境

- Chrome 117 及以上版本

<details open>
  <summary>示例: 审查快照</summary>

![image](https://github.com/gkd-kit/inspect/assets/38517192/f37ec43c-cb39-4745-ad5b-e11a02cc5c28)

</details>

<details open>
  <summary>示例: 选择器路径视图</summary>

![image](https://github.com/gkd-kit/inspect/assets/38517192/27d0656a-2239-426c-930c-749ffb9f189b)

</details>

<details open>
  <summary>示例: 实时执行点击选择器</summary>

![2023-09-02_14-12-08](https://github.com/gkd-kit/inspect/assets/38517192/af79f677-bac0-49a3-964c-6d4cace9d9c9)

</details>

## 快照示例

- <https://i.gkd.li/i/14045424>
- <https://i.gkd.li/i/14039510>
- <https://i.gkd.li/i/14035418>
- <https://i.gkd.li/i/14034770>
- <https://i.gkd.li/i/14031920>
- <https://i.gkd.li/i/14018243>
- <https://i.gkd.li/i/14011298>
- <https://i.gkd.li/i/13999908>

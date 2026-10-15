# Workers API 规范

本文件适用于当前目录及其所有子目录。

## HTTP 方法

- 业务接口只允许使用 `GET` 和 `POST`。
- 禁止新增 `PUT`、`PATCH`、`DELETE`、`HEAD`、`OPTIONS` 或其它 HTTP 方法的业务接口。
- 框架为 CORS、协议兼容等目的自动处理的 `OPTIONS` 或 `HEAD` 响应不得承载业务逻辑，也不得作为业务接口使用。

## 参数传递

- `GET` 接口的所有业务参数只能通过 URL query string 传递。
- `GET` 接口禁止从请求 body、表单、路径参数或自定义请求头读取业务参数。
- `POST` 接口的所有业务参数只能通过请求 body 传递，且只允许以下格式：
  - `application/json`
  - `application/x-www-form-urlencoded`
  - `multipart/form-data`
- `POST` 接口禁止通过 query string、路径参数或自定义请求头传递业务参数。
- 路由路径必须是静态路径，禁止使用 `/:id`、`/*` 等动态路径承载业务参数。
- `Authorization`、`Content-Type` 等认证或协议头不属于业务参数，可以按需使用。

## 响应协议

- 所有业务接口的 HTTP 状态码必须返回 `200`，包括参数错误、认证失败、资源不存在和服务内部错误等情况。
- 错误响应必须是 JSON 对象，并且必须包含字面量字段 `error: true`；可以按需增加 `message`、`code` 等错误字段。
- 正常响应直接返回业务 JSON，不得为了统一格式额外包裹 `data`、`result`、`success` 或 `error: false` 等字段。
- 接口响应类型必须建模为“正常业务数据类型与错误对象类型”的联合类型。
- 禁止使用 `ApiResponse<T>`、`Result<T>` 等泛型响应包装类型表达接口响应。
- 客户端必须根据 JSON 中是否存在 `error: true` 区分错误分支，不能依赖 HTTP 状态码判断业务成功或失败。
- `/proxy` 的成功响应是透明传输响应，可以透传上游状态码、响应头和非 JSON body；Worker 自身产生的代理错误仍必须遵守上述 JSON 错误协议。

## 实现与检查

- 使用 Hono 注册路由时，只能调用 `app.get(...)`、`app.post(...)` 或对应 Router 的 `get(...)`、`post(...)`。
- 新增或修改接口时，测试必须覆盖允许的参数来源，并验证从禁止来源传入参数不会被接受。
- 接口测试必须验证所有业务分支均返回 HTTP `200`，错误分支包含 `error: true`，正常分支没有额外响应包装。
- 设计文档、README 示例和测试请求也必须遵守本规范。

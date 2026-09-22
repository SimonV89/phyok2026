# `packages` 共享包规划

## 1. 目标

`packages` 用来承载前端 Monorepo 中的共享能力。

---

## 2. 推荐包

- `api-client`
- `domain`
- `store`
- `ui`
- `tokens`
- `utils`
- `eslint-config`
- `tsconfig`

---

## 3. 各包职责

## `api-client`

- `/v2` API SDK
- 统一错误码处理
- 请求封装

## `domain`

- DTO
- 领域类型
- 枚举

## `store`

- Redux store
- slice
- middleware

## `ui`

- 通用组件
- Chat 组件
- CMS 基础组件

---

## 4. 结论

共享包先把边界划清，比一开始就写很多代码更重要。

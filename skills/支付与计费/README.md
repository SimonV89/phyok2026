# 支付与计费

> 涉及支付、额度、计费扣减时必须遵守的规范。

## 额度扣减规则

1. **仅在流式成功结束时扣减**：`stream.completed` 且 `status === "completed"`
2. **必须通过 `runId` 幂等**：防止重试或中断导致的重复扣减
3. **登录用户默认赠送 20 次**额度
4. `runId` 必须记录到 `billing_usage_record` 表

## 额度刷新时机

必须主动刷新额度的三个时间点：

1. **对话流成功结束后**：立即刷新
2. **窗口重新聚焦时**（`window.focus`）：主动刷新账户余额
3. **页面可见性改变时**（`visibilitychange → visible`）：主动刷新并查询未完成订单状态

## 支付宝签名规范

- **签名字符串拼接时**：必须严格处理 `sign_type` 参与签名的逻辑
- 常见错误：遗漏 `sign_type` 导致 `invalid-signature`
- 签名算法：RSA2，`ALIPAY_SIGN_TYPE=RSA2`，`ALIPAY_VERSION=1.0`

## 支付端侧路由

必须对移动端和桌面端进行环境分流：

| 场景 | 端侧 | 支付方式 | 跳转行为 |
|------|------|---------|---------|
| 移动端 | WAP | `alipay.trade.wap.pay` | 当前页 `location.assign()` |
| 桌面端 | Page | `alipay.trade.page.pay` | 优先 `window.open()` 新标签页 |

判断逻辑：
```ts
const isMobile = /android|iphone|ipad|ipod|mobile|harmonyos/.test(ua) ||
  window.matchMedia?.("(max-width: 860px)")?.matches;
```

## 订单状态查询

- `fetchPaymentOrder(orderNo, { refresh: true })` 时显式传 `refresh=true`
- 支付成功后提示："支付成功，额度已到账。"
- 支付回调 canonical payload 拼接：按 key 字典序排序后拼接 `key=value&` 形式

## 相关文档

- [工程约束/计费幂等](../工程约束/README.md)

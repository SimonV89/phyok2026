"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { fetchPaymentOrder, type CreateAlipayOrderResponse } from "@/lib/chat-api";

const TERMINAL_STATUS = new Set(["PAID", "CLOSED", "TRADE_CLOSED", "TRADE_SUCCESS", "TRADE_FINISHED"]);

export function PaymentResultClient() {
  const searchParams = useSearchParams();
  const orderNo = searchParams.get("out_trade_no") ?? searchParams.get("orderNo") ?? "";
  const [order, setOrder] = useState<CreateAlipayOrderResponse["data"] | null>(null);
  const [loading, setLoading] = useState(Boolean(orderNo));
  const [error, setError] = useState<string | null>(null);

  const statusLabel = useMemo(() => {
    if (!order?.status) {
      return "等待确认";
    }
    if (order.status === "PAID") {
      return "支付成功";
    }
    if (order.status === "PENDING" || order.status === "CREATED") {
      return "等待支付完成";
    }
    if (order.status === "CLOSED") {
      return "订单已关闭";
    }
    return order.status;
  }, [order?.status]);

  useEffect(() => {
    if (!orderNo) {
      setLoading(false);
      setError("缺少订单号，无法查询支付结果。");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadOrder = async (refresh: boolean) => {
      try {
        setLoading(true);
        const result = await fetchPaymentOrder(orderNo, { refresh });
        if (cancelled) {
          return;
        }
        setOrder(result);
        setError(null);
        if (!TERMINAL_STATUS.has(result.status ?? "")) {
          timer = setTimeout(() => {
            void loadOrder(true);
          }, 4000);
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "支付结果查询失败。");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrder(true);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [orderNo]);

  return (
    <main className="payment-result-shell">
      <section className="payment-result-card">
        <div className="hero-kicker">Alipay Result</div>
        <h1>{statusLabel}</h1>
        <p>支付结果页会自动轮询订单状态；如果支付宝异步回调稍慢，这里会继续刷新直到订单进入稳定状态。</p>

        {orderNo ? (
          <div className="payment-result-meta">
            <span>订单号 · {orderNo}</span>
            {order?.tradeNo ? <span>支付宝流水 · {order.tradeNo}</span> : null}
          </div>
        ) : null}

        {loading ? <div className="payment-result-banner">正在同步支付宝订单状态...</div> : null}
        {error ? <div className="history-stage-banner error">{error}</div> : null}

        {order ? (
          <div className="payment-result-panel">
            <div className="payment-result-stat">
              <strong>{(order.amountFen / 100).toFixed(2)} 元</strong>
              <span>
                {order.planId} · {order.quota ?? 0} 次有效调用
              </span>
            </div>
            <div className="payment-result-meta">
              <span>状态 · {order.status ?? "UNKNOWN"}</span>
              <span>到期时间 · {new Date(order.expiresAt).toLocaleString("zh-CN")}</span>
              {order.paidAt ? <span>支付完成 · {new Date(order.paidAt).toLocaleString("zh-CN")}</span> : null}
            </div>
            {order.status !== "PAID" && order.payUrl ? (
              <a href={order.payUrl} target="_blank" rel="noreferrer" className="send-button payment-result-button">
                重新打开支付宝支付页
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="payment-result-actions">
          <Link href="/" className="toolbar-login">
            返回首页
          </Link>
          {order?.payUrl ? (
            <a href={order.payUrl} target="_blank" rel="noreferrer" className="toolbar-login">
              再次打开支付页
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}

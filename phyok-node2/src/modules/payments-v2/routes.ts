import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "../../config/env";
import { createFailure, createSuccess, ERROR_CODES, extractExternalHeaders } from "../../packages/contracts/api";
import { proxyJavaJson } from "../../packages/domain-clients/java-service-proxy";

const createAlipayOrderSchema = z.object({
  planId: z.enum(["starter", "standard", "unlimited"])
});

const DEGRADED_PLAN_AMOUNT_FEN: Record<z.infer<typeof createAlipayOrderSchema>["planId"], number> = {
  starter: 500,
  standard: 1000,
  unlimited: 2500
};

export const paymentsV2Routes = async (app: FastifyInstance) => {
  app.post("/alipay/create", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const parsed = createAlipayOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "Invalid alipay create payload.", {
          issues: parsed.error.issues
        })
      );
      return;
    }

    let payload;
    try {
      payload = await proxyJavaJson<Record<string, unknown>>({
        baseUrl: env.javaPaymentBaseUrl,
        path: "/v2/payments/alipay/create",
        method: "POST",
        headers: externalHeaders,
        body: parsed.data
      });
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
      const orderNo = `pay_local_${randomUUID()}`;
      payload = createSuccess(externalHeaders.requestId, {
        orderNo,
        planId: parsed.data.planId,
        amountFen: DEGRADED_PLAN_AMOUNT_FEN[parsed.data.planId],
        quota: parsed.data.planId === "starter" ? 10 : parsed.data.planId === "standard" ? 30 : 100,
        status: "CREATED",
        paymentChannel: "alipay",
        payUrl: `https://openapi.alipay.com/gateway.do?mock=1&orderNo=${encodeURIComponent(orderNo)}`,
        qrCodeUrl: `https://render.alipay.com/p/s/i?mock=1&orderNo=${encodeURIComponent(orderNo)}`,
        qrCodeContent: `https://render.alipay.com/p/s/i?mock=1&orderNo=${encodeURIComponent(orderNo)}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
    }

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });

  app.get("/orders/:orderNo", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const orderNo = z.string().trim().min(1).safeParse((request.params as { orderNo?: string }).orderNo);
    const refresh = z.coerce.boolean().safeParse((request.query as { refresh?: string | boolean }).refresh ?? false);
    if (!orderNo.success) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "Invalid payment order number.", {
          issues: orderNo.error.issues
        })
      );
      return;
    }

    let payload;
    try {
      payload = await proxyJavaJson<Record<string, unknown>>({
        baseUrl: env.javaPaymentBaseUrl,
        path: `/v2/payments/orders/${encodeURIComponent(orderNo.data)}`,
        method: "GET",
        headers: externalHeaders,
        query: refresh.success && refresh.data ? { refresh: "true" } : undefined
      });
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
      payload = createFailure(externalHeaders.requestId, "PAYMENT_ORDER_NOT_FOUND", "本地调试环境未找到该订单。");
    }

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });
};

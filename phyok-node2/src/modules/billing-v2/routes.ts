import type { FastifyInstance } from "fastify";

import { env } from "../../config/env";
import { createSuccess } from "../../packages/contracts/api";
import { proxyJavaJson } from "../../packages/domain-clients/java-service-proxy";
import { extractExternalHeaders } from "../../packages/contracts/api";

const DEGRADED_PLANS = [
  {
    id: "starter",
    name: "尝鲜",
    priceFen: 500,
    quota: 10,
    description: "适合先体验一段聚焦式探索。",
    highlight: "10 次有效调用"
  },
  {
    id: "standard",
    name: "标准",
    priceFen: 1000,
    quota: 30,
    description: "适合稳定使用，覆盖连续整理与复盘。",
    highlight: "30 次有效调用",
    recommended: true
  },
  {
    id: "unlimited",
    name: "畅享",
    priceFen: 2500,
    quota: 100,
    description: "适合高频深入使用，保留更充足的探索空间。",
    highlight: "100 次有效调用"
  }
] as const;

function isSeedUser(email?: string): boolean {
  return typeof email === "string" && /^100(1\d|[2-8]\d|9[0-9])@xx\.com$/i.test(email.trim());
}

export const billingV2Routes = async (app: FastifyInstance) => {
  app.get("/account", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    let payload;
    try {
      payload = await proxyJavaJson<Record<string, unknown>>({
        baseUrl: env.javaBillingBaseUrl,
        path: "/v2/billing/account",
        method: "GET",
        headers: externalHeaders
      });
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
      const seedUser = isSeedUser(externalHeaders.userEmail);
      payload = createSuccess(externalHeaders.requestId, {
        plan: seedUser ? "seed-gift" : "starter",
        monthlyTokenLimit: seedUser ? 100 : 20,
        consumedTokens: 0,
        remainingTokens: seedUser ? 100 : 20,
        quotaState: "HEALTHY",
        billingStatus: seedUser ? "SEEDED" : "LOCAL_DEBUG",
        paymentChannel: "alipay",
        seedUser,
        recommendedPlanId: "standard"
      });
    }

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });

  app.get("/overview", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    let payload;
    try {
      payload = await proxyJavaJson<Record<string, unknown>>({
        baseUrl: env.javaBillingBaseUrl,
        path: "/v2/billing/overview",
        method: "GET",
        headers: externalHeaders
      });
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
      payload = createSuccess(externalHeaders.requestId, {
        plan: "local-debug",
        quotaState: "HEALTHY",
        scene: "chat.send"
      });
    }

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });

  app.get("/plans", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    let payload;
    try {
      payload = await proxyJavaJson<Record<string, unknown>>({
        baseUrl: env.javaBillingBaseUrl,
        path: "/v2/billing/plans",
        method: "GET",
        headers: externalHeaders
      });
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
      payload = createSuccess(externalHeaders.requestId, {
        paymentChannel: "alipay",
        items: DEGRADED_PLANS
      });
    }

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });
};

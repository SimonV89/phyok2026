import type { FastifyInstance } from "fastify";

import { env } from "../../config/env";
import { proxyJavaJson } from "../../packages/domain-clients/java-service-proxy";
import { extractExternalHeaders } from "../../packages/contracts/api";

export const billingV2Routes = async (app: FastifyInstance) => {
  app.get("/account", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const payload = await proxyJavaJson<Record<string, unknown>>({
      baseUrl: env.javaBillingBaseUrl,
      path: "/v2/billing/account",
      method: "GET",
      headers: externalHeaders
    });

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });

  app.get("/overview", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const payload = await proxyJavaJson<Record<string, unknown>>({
      baseUrl: env.javaBillingBaseUrl,
      path: "/v2/billing/overview",
      method: "GET",
      headers: externalHeaders
    });

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });
};

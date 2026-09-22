import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../../config/env";
import { proxyJavaJson } from "../../packages/domain-clients/java-service-proxy";
import { createFailure, extractExternalHeaders, ERROR_CODES } from "../../packages/contracts/api";

const sendCodeSchema = z.object({
  email: z.string().email(),
  locale: z.string().trim().optional()
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(4).max(8)
});

export const authV2Routes = async (app: FastifyInstance) => {
  app.post("/email/send-code", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const parsed = sendCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "Invalid send-code payload.", {
          issues: parsed.error.issues
        })
      );
      return;
    }

    const payload = await proxyJavaJson<Record<string, unknown>>({
      baseUrl: env.javaAuthBaseUrl,
      path: "/v2/auth/email/send-code",
      method: "POST",
      headers: externalHeaders,
      body: parsed.data
    });

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });

  app.post("/email/verify", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "Invalid verify payload.", {
          issues: parsed.error.issues
        })
      );
      return;
    }

    const payload = await proxyJavaJson<Record<string, unknown>>({
      baseUrl: env.javaAuthBaseUrl,
      path: "/v2/auth/email/verify",
      method: "POST",
      headers: externalHeaders,
      body: parsed.data
    });

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });
};

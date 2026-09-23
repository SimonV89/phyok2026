import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "../../config/env";
import { proxyJavaJson } from "../../packages/domain-clients/java-service-proxy";
import { createFailure, createSuccess, extractExternalHeaders, ERROR_CODES } from "../../packages/contracts/api";

const sendCodeSchema = z.object({
  email: z.string().email(),
  locale: z.string().trim().optional()
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(4).max(8)
});

const localDebugCodeStore = new Map<string, string>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isDevSeedLoginEnabled(): boolean {
  return env.localDebugAllowDegraded && env.devSeedLoginEnabled && Boolean(env.devSeedEmailPattern && env.devSeedEmailCode);
}

function isSeedEmail(email: string): boolean {
  if (!isDevSeedLoginEnabled()) {
    return false;
  }
  try {
    return new RegExp(env.devSeedEmailPattern, "i").test(normalizeEmail(email));
  } catch {
    return false;
  }
}

function buildLocalDebugAuthPayload(email: string, appId: string) {
  const normalizedEmail = normalizeEmail(email);
  const safeUserId = `user_${normalizedEmail.replace(/[^a-z0-9]+/g, "_")}`;
  const sessionId = `sess_${safeUserId}`;
  return {
    sessionToken: `debug-token:${normalizedEmail}`,
    refreshToken: `debug-refresh:${normalizedEmail}`,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    newUser: false,
    principal: {
      tenantId: "tenant-demo",
      appId,
      userId: safeUserId,
      sessionId,
      roles: ["USER"]
    }
  };
}

function resolveLocalDebugCode(email: string): string {
  if (isSeedEmail(email)) {
    return env.devSeedEmailCode;
  }
  return env.devDefaultAuthCode;
}

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

    let payload;
    try {
      payload = await proxyJavaJson<Record<string, unknown>>({
        baseUrl: env.javaAuthBaseUrl,
        path: "/v2/auth/email/send-code",
        method: "POST",
        headers: externalHeaders,
        body: parsed.data
      });
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
      const normalizedEmail = normalizeEmail(parsed.data.email);
      const debugCode = resolveLocalDebugCode(normalizedEmail);
      if (!debugCode) {
        payload = createFailure(
          externalHeaders.requestId,
          "AUTH_LOCAL_DEBUG_NOT_CONFIGURED",
          "本地调试验证码未配置，请在 env2.local 中显式设置。"
        );
        await reply.code(400).send(payload);
        return;
      }
      localDebugCodeStore.set(normalizedEmail, debugCode);
      payload = createSuccess(externalHeaders.requestId, {
        accepted: true,
        ticket: `local-debug-${randomUUID()}`,
        retryAfterSec: 0,
        expiresInSec: 1800
      });
    }

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

    let payload;
    try {
      payload = await proxyJavaJson<Record<string, unknown>>({
        baseUrl: env.javaAuthBaseUrl,
        path: "/v2/auth/email/verify",
        method: "POST",
        headers: externalHeaders,
        body: parsed.data
      });
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
      const normalizedEmail = normalizeEmail(parsed.data.email);
      const expectedCode = localDebugCodeStore.get(normalizedEmail) ?? resolveLocalDebugCode(normalizedEmail);
      if (!expectedCode) {
        payload = createFailure(
          externalHeaders.requestId,
          "AUTH_LOCAL_DEBUG_NOT_CONFIGURED",
          "本地调试验证码未配置，请在 env2.local 中显式设置。"
        );
        await reply.code(400).send(payload);
        return;
      }
      if (parsed.data.code !== expectedCode) {
        payload = createFailure(
          externalHeaders.requestId,
          "AUTH_INVALID_EMAIL_CODE",
          "验证码无效或已过期。"
        );
      } else {
        payload = createSuccess(
          externalHeaders.requestId,
          buildLocalDebugAuthPayload(normalizedEmail, externalHeaders.appId)
        );
      }
    }

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });
};

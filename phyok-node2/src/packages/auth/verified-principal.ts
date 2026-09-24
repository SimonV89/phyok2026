import { env } from "../../config/env";
import type { ExternalRequestHeaders } from "../contracts/api";

export type VerifiedPrincipal = {
  tenantId: string;
  appId: string;
  userId: string;
  sessionId: string;
  email: string;
  ownerScope: string;
  authorization: string;
};

export async function verifyPrincipal(headers: ExternalRequestHeaders): Promise<VerifiedPrincipal | null> {
  const authorization = headers.authorization?.trim();
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  try {
    const response = await fetch(`${env.javaAuthBaseUrl}/internal/auth/verify-token`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "X-Request-Id": headers.requestId
      },
      body: "{}",
      signal: AbortSignal.timeout(env.javaDomainTimeoutMs)
    });
    if (!response.ok) {
      return null;
    }
    const result = (await response.json()) as {
      code?: string;
      data?: { tenantId?: string; appId?: string; userId?: string; sessionId?: string; roles?: string[]; email?: string };
    };
    const identity = result.data;
    if (
      result.code !== "OK" ||
      !identity?.tenantId ||
      !identity.appId ||
      !identity.userId ||
      !identity.sessionId ||
      !identity.email ||
      identity.userId === "unknown" ||
      !identity.roles?.includes("USER")
    ) {
      return null;
    }
    return {
      tenantId: identity.tenantId,
      appId: identity.appId,
      userId: identity.userId,
      sessionId: identity.sessionId,
      email: identity.email.trim().toLowerCase(),
      ownerScope: `verified:${identity.tenantId}:${identity.appId}:${identity.userId}`,
      authorization
    };
  } catch {
    return null;
  }
}

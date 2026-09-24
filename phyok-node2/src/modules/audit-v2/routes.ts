import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../../config/env";
import { proxyJavaJson } from "../../packages/domain-clients/java-service-proxy";
import { createFailure, createSuccess, ERROR_CODES, extractExternalHeaders } from "../../packages/contracts/api";
import { verifyPrincipal } from "../../packages/auth/verified-principal";

const auditSearchQuerySchema = z.object({
  tenantId: z.string().trim().optional(),
  appId: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  eventType: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  pageNo: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});

export const auditV2Routes = async (app: FastifyInstance) => {
  app.get("/events/search", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const principal = await verifyPrincipal(externalHeaders);
    if (!principal) {
      await reply.code(401).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_UNAUTHORIZED, "请先登录后再查看记录。")
      );
      return;
    }
    const parsed = auditSearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "Invalid audit query.", {
          issues: parsed.error.issues
        })
      );
      return;
    }

    let payload;
    try {
      payload = await proxyJavaJson<Record<string, unknown>>({
        baseUrl: env.javaAuditBaseUrl,
        path: "/v2/audits/events/search",
        method: "GET",
        headers: {
          ...externalHeaders,
          appId: principal.appId,
          userId: principal.userId,
          sessionId: principal.sessionId,
          userEmail: principal.email
        },
        query: {
          tenantId: principal.tenantId,
          appId: principal.appId,
          userId: principal.userId,
          eventType: parsed.data.eventType,
          entityType: parsed.data.entityType,
          entityId: parsed.data.entityId,
          pageNo: parsed.data.pageNo ? String(parsed.data.pageNo) : undefined,
          pageSize: parsed.data.pageSize ? String(parsed.data.pageSize) : undefined
        }
      });
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
      payload = createSuccess(externalHeaders.requestId, {
        pageNo: parsed.data.pageNo ?? 1,
        pageSize: parsed.data.pageSize ?? 5,
        total: 2,
        items: [
          {
            id: "audit_local_001",
            tenantId: "tenant-demo",
            appId: principal.appId,
            userId: principal.userId,
            traceId: `${externalHeaders.traceId}:local`,
            requestId: externalHeaders.requestId,
            eventType: "GRAPH_TRACE_START",
            sourceService: "node2-local-debug",
            entityType: "CHAT_RUN",
            entityId: "local-run-1",
            payloadJson: "{\"mode\":\"local-debug\"}",
            createdAt: new Date().toISOString()
          },
          {
            id: "audit_local_002",
            tenantId: "tenant-demo",
            appId: principal.appId,
            userId: principal.userId,
            traceId: `${externalHeaders.traceId}:local`,
            requestId: externalHeaders.requestId,
            eventType: "GRAPH_TRACE_COMPLETE",
            sourceService: "node2-local-debug",
            entityType: "CHAT_RUN",
            entityId: "local-run-1",
            payloadJson: "{\"mode\":\"local-debug\"}",
            createdAt: new Date().toISOString()
          }
        ]
      });
    }

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });
};

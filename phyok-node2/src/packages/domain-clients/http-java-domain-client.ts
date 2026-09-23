import { env } from "../../config/env";
import {
  ERROR_CODES,
  buildInternalHeaders,
  createFailure,
  type ApiFailure,
  type ApiSuccess
} from "../contracts/api";
import type {
  BillingPrecheckResult,
  DomainClients,
  GatewayContext,
  MemoryGateResult,
  VerifiedIdentity
} from "./types";
import type {
  KnowledgeSnippet,
  MemoryFragment
} from "../graph-flows/self-explore/state";

type HttpJavaDomainClientOptions = {
  defaultBaseUrl: string;
  authBaseUrl: string;
  billingBaseUrl: string;
  auditBaseUrl: string;
  callerService?: string;
};

type JsonEnvelope<T> = ApiSuccess<T> | ApiFailure;

export class HttpJavaDomainClient implements DomainClients {
  constructor(private readonly options: HttpJavaDomainClientOptions) {}

  async verifyToken(ctx: GatewayContext): Promise<VerifiedIdentity> {
    if (!ctx.authorization?.trim()) {
      throw new Error(`${ERROR_CODES.BFF_UNAUTHORIZED}: 请先登录后再开始对话。`);
    }

    try {
      const identity = await this.request<VerifiedIdentity>(ctx, {
        method: "POST",
        path: "/internal/auth/verify-token",
        body: {}
      });
      if (
        identity.userId === "unknown" ||
        identity.sessionId === "unknown" ||
        identity.roles.includes("ANONYMOUS")
      ) {
        throw new Error(`${ERROR_CODES.BFF_UNAUTHORIZED}: 登录态已失效，请重新登录后继续。`);
      }
      return identity;
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
      return this.createLocalDebugIdentity(ctx);
    }
  }

  async getMemoryGate(ctx: GatewayContext, query: string): Promise<MemoryGateResult> {
    return this.request<MemoryGateResult>(ctx, {
      method: "GET",
      path: "/v2/memories/gate-check",
      query: {
        q: query
      }
    });
  }

  async recallMemory(query: string, ctx: GatewayContext): Promise<MemoryFragment[]> {
    const data = await this.request<{ items: MemoryFragment[] } | MemoryFragment[]>(ctx, {
      method: "POST",
      path: "/internal/memory/retrieve",
      body: {
        query,
        topK: 6,
        minScore: 0.72,
        timelineRoots: [],
        topicTags: []
      }
    });
    return Array.isArray(data) ? data : data.items;
  }

  async recallKnowledge(query: string, ctx: GatewayContext): Promise<KnowledgeSnippet[]> {
    const data = await this.request<{ items: KnowledgeSnippet[] } | KnowledgeSnippet[]>(ctx, {
      method: "POST",
      path: "/internal/knowledge/retrieve",
      body: {
        query,
        topK: 4
      }
    });
    return Array.isArray(data) ? data : data.items;
  }

  async upsertMemoryPlan(query: string, ctx: GatewayContext): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(ctx, {
      method: "POST",
      path: "/internal/memory/upsert",
      idempotencyKey: `${ctx.requestId}:memory-upsert`,
      body: {
        source: "self_explore_agent_pro",
        mode: "plan_preview",
        query
      }
    });
  }

  async createMemoryFragment(
    input: { contentText: string; timelineRoot?: string; searchable?: boolean },
    ctx: GatewayContext
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(ctx, {
      method: "POST",
      path: "/v2/memories",
      idempotencyKey: `${ctx.requestId}:memory-create`,
      body: {
        tenantId: ctx.tenantId || "tenant-demo",
        appId: ctx.appId,
        userId: ctx.userId,
        timelineRoot: input.timelineRoot || "TODAY",
        contentText: input.contentText,
        searchable: input.searchable ?? true
      }
    });
  }

  async emitAuditTrace(ctx: GatewayContext, phase: "start" | "complete" | "error"): Promise<void> {
    const path =
      phase === "start"
        ? "/internal/audit/trace-start"
        : phase === "complete"
          ? "/internal/audit/trace-complete"
          : "/internal/audit/trace-event";
    try {
      await this.request<Record<string, unknown>>(ctx, {
        method: "POST",
        path,
        body: {
          phase,
          requestId: ctx.requestId,
          traceId: ctx.traceId,
          tenantId: ctx.tenantId,
          appId: ctx.appId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          sourceService: "agent-runtime-langgraph"
        }
      });
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
    }
  }

  async precheckBilling(ctx: GatewayContext): Promise<BillingPrecheckResult> {
    try {
      return await this.request<BillingPrecheckResult>(ctx, {
        method: "POST",
        path: "/internal/billing/precheck",
        body: {
          scene: "chat.send"
        }
      });
    } catch (error) {
      if (!env.localDebugAllowDegraded) {
        throw error;
      }
      return {
        allowed: true,
        plan: "local-debug"
      };
    }
  }

  private async request<T>(
    ctx: GatewayContext,
    options: {
      method: "GET" | "POST";
      path: string;
      query?: Record<string, string>;
      idempotencyKey?: string;
      body?: Record<string, unknown>;
    }
  ): Promise<T> {
    const internalHeaders = buildInternalHeaders({
      authorization: ctx.authorization,
      requestId: ctx.requestId,
      traceId: ctx.traceId,
      appId: ctx.appId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      callerService: this.options.callerService || "agent-runtime-langgraph"
    });

    const url = new URL(options.path, this.resolveBaseUrl(options.path));
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error(`JAVA_DOMAIN_TIMEOUT: ${options.path}`));
    }, env.javaDomainTimeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": internalHeaders.requestId,
          "X-Trace-Id": internalHeaders.traceId,
          "X-App-Id": internalHeaders.appId,
          "X-User-Id": internalHeaders.userId,
          "X-Session-Id": internalHeaders.sessionId,
          "X-Caller-Service": internalHeaders.callerService,
          ...(internalHeaders.tenantId ? { "X-Tenant-Id": internalHeaders.tenantId } : {}),
          ...(internalHeaders.authorization ? { Authorization: internalHeaders.authorization } : {}),
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
        },
        body: options.method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        const timeoutMessage = reason instanceof Error ? reason.message : `JAVA_DOMAIN_TIMEOUT: ${options.path}`;
        throw new Error(timeoutMessage);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const rawPayload = await response.text();
    if (!rawPayload.trim()) {
      throw new Error(`JAVA_DOMAIN_EMPTY_RESPONSE: ${options.path} (status ${response.status})`);
    }

    let payload: JsonEnvelope<T>;
    try {
      payload = JSON.parse(rawPayload) as JsonEnvelope<T>;
    } catch {
      const snippet = rawPayload.slice(0, 240).replace(/\s+/g, " ").trim();
      throw new Error(
        `JAVA_DOMAIN_INVALID_JSON: ${options.path} (status ${response.status})${snippet ? ` body=${snippet}` : ""}`
      );
    }

    if (!response.ok || payload.code !== "OK") {
      const failure =
        payload && "code" in payload && payload.code !== "OK"
          ? payload
          : createFailure(ctx.requestId, "JAVA_DOMAIN_HTTP_ERROR", `Request failed: ${options.path}`);
      if (
        options.path === "/internal/auth/verify-token" &&
        (failure.code === "AUTH_UNAUTHORIZED" || failure.code === ERROR_CODES.BFF_UNAUTHORIZED)
      ) {
        throw new Error(`${ERROR_CODES.BFF_UNAUTHORIZED}: ${failure.message || "请先登录后再开始对话。"}`);
      }
      throw new Error(`${failure.code}: ${failure.message}`);
    }

    return (payload as ApiSuccess<T>).data;
  }

  private resolveBaseUrl(path: string): string {
    if (path.startsWith("/internal/auth/") || path.startsWith("/v2/auth/")) {
      return this.options.authBaseUrl;
    }
    if (path.startsWith("/internal/billing/") || path.startsWith("/v2/billing/")) {
      return this.options.billingBaseUrl;
    }
    if (path.startsWith("/internal/audit/") || path.startsWith("/v2/audits/")) {
      return this.options.auditBaseUrl;
    }
    return this.options.defaultBaseUrl;
  }

  private createLocalDebugIdentity(ctx: GatewayContext): VerifiedIdentity {
    const rawToken = ctx.authorization?.replace(/^Bearer\s+/i, "").trim();
    const email = rawToken?.startsWith("debug-token:")
      ? rawToken.slice("debug-token:".length).trim().toLowerCase()
      : env.localDebugIdentityEmail;
    const safeUserId = `user_${email.replace(/[^a-z0-9]+/g, "_")}`;
    const sessionId = rawToken?.startsWith("debug-token:") ? `sess_${safeUserId}` : ctx.sessionId;
    return {
      tenantId: "tenant-demo",
      appId: ctx.appId,
      userId: safeUserId,
      roles: ["USER"],
      sessionId
    };
  }
}

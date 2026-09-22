import {
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
    return this.request<VerifiedIdentity>(ctx, {
      method: "POST",
      path: "/internal/auth/verify-token",
      body: {}
    });
  }

  async getMemoryGate(ctx: GatewayContext, query: string): Promise<MemoryGateResult> {
    return this.request<MemoryGateResult>(ctx, {
      method: "GET",
      path: "/internal/memory/gate-check",
      query: {
        requiredCount: "5",
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

  async emitAuditTrace(ctx: GatewayContext, phase: "start" | "complete" | "error"): Promise<void> {
    const path =
      phase === "start"
        ? "/internal/audit/trace-start"
        : phase === "complete"
          ? "/internal/audit/trace-complete"
          : "/internal/audit/trace-event";
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
  }

  async precheckBilling(ctx: GatewayContext): Promise<BillingPrecheckResult> {
    return this.request<BillingPrecheckResult>(ctx, {
      method: "POST",
      path: "/internal/billing/precheck",
      body: {
        scene: "chat.send"
      }
    });
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

    const response = await fetch(url, {
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
      body: options.method === "GET" ? undefined : JSON.stringify(options.body ?? {})
    });

    const payload = (await response.json()) as JsonEnvelope<T>;
    if (!response.ok || payload.code !== "OK") {
      const failure =
        payload && "code" in payload && payload.code !== "OK"
          ? payload
          : createFailure(ctx.requestId, "JAVA_DOMAIN_HTTP_ERROR", `Request failed: ${options.path}`);
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
}

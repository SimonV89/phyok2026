import {
  createGrpcEnvelope,
  GRPC_SERVICES,
  type MemoryGateCheckRequest
} from "../contracts/grpc";
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

type GrpcJavaDomainClientOptions = {
  fallback: DomainClients;
};

export class GrpcJavaDomainClient implements DomainClients {
  constructor(private readonly options: GrpcJavaDomainClientOptions) {}

  async verifyToken(ctx: GatewayContext): Promise<VerifiedIdentity> {
    return this.options.fallback.verifyToken(ctx);
  }

  async getMemoryGate(ctx: GatewayContext, _query: string): Promise<MemoryGateResult> {
    const payload: MemoryGateCheckRequest = {
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      requiredCount: 5
    };

    const envelope = createGrpcEnvelope({
      service: GRPC_SERVICES.memoryGate,
      method: "CheckMemoryGate",
      requestId: ctx.requestId,
      traceId: ctx.traceId,
      appId: ctx.appId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      payload
    });

    void envelope;
    return this.options.fallback.getMemoryGate(ctx, _query);
  }

  async recallMemory(query: string, ctx: GatewayContext): Promise<MemoryFragment[]> {
    const envelope = createGrpcEnvelope({
      service: GRPC_SERVICES.memoryRecall,
      method: "RecallMemory",
      requestId: ctx.requestId,
      traceId: ctx.traceId,
      appId: ctx.appId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      payload: {
        userId: ctx.userId,
        query,
        topK: 6,
        tags: []
      }
    });

    void envelope;
    return this.options.fallback.recallMemory(query, ctx);
  }

  async recallKnowledge(query: string, ctx: GatewayContext): Promise<KnowledgeSnippet[]> {
    return this.options.fallback.recallKnowledge(query, ctx);
  }

  async upsertMemoryPlan(query: string, ctx: GatewayContext): Promise<Record<string, unknown>> {
    return this.options.fallback.upsertMemoryPlan(query, ctx);
  }

  async createMemoryFragment(
    input: { contentText: string; timelineRoot?: string; searchable?: boolean },
    ctx: GatewayContext
  ): Promise<Record<string, unknown>> {
    return this.options.fallback.createMemoryFragment(input, ctx);
  }

  async emitAuditTrace(ctx: GatewayContext, phase: "start" | "complete" | "error"): Promise<void> {
    return this.options.fallback.emitAuditTrace(ctx, phase);
  }

  async precheckBilling(ctx: GatewayContext): Promise<BillingPrecheckResult> {
    return this.options.fallback.precheckBilling(ctx);
  }
}

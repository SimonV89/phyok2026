import type {
  KnowledgeSnippet,
  MemoryFragment
} from "../graph-flows/self-explore/state";

export type GatewayContext = {
  authorization?: string;
  requestId: string;
  traceId: string;
  tenantId?: string;
  appId: string;
  userId: string;
  sessionId: string;
};

export type VerifiedIdentity = {
  tenantId?: string;
  appId: string;
  userId: string;
  roles: string[];
  sessionId: string;
};

export type MemoryGateResult = {
  requestId: string;
  currentCount: number;
  requiredCount: number;
  passed: boolean;
};

export type BillingPrecheckResult = {
  allowed: boolean;
  plan: string;
};

export type AuditTracePhase = "start" | "complete" | "error";

export type DomainClients = {
  verifyToken(ctx: GatewayContext): Promise<VerifiedIdentity>;
  getMemoryGate(ctx: GatewayContext, query: string): Promise<MemoryGateResult>;
  recallMemory(query: string, ctx: GatewayContext): Promise<MemoryFragment[]>;
  recallKnowledge(query: string, ctx: GatewayContext): Promise<KnowledgeSnippet[]>;
  upsertMemoryPlan(query: string, ctx: GatewayContext): Promise<Record<string, unknown>>;
  createMemoryFragment(
    input: { contentText: string; timelineRoot?: string; searchable?: boolean },
    ctx: GatewayContext
  ): Promise<Record<string, unknown>>;
  emitAuditTrace(ctx: GatewayContext, phase: AuditTracePhase): Promise<void>;
  precheckBilling(ctx: GatewayContext): Promise<BillingPrecheckResult>;
};

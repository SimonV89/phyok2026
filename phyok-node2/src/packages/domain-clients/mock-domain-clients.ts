import type {
  KnowledgeSnippet,
  MemoryFragment
} from "../graph-flows/self-explore/state";
import type {
  AuditTracePhase,
  BillingPrecheckResult,
  DomainClients,
  GatewayContext,
  MemoryGateResult,
  VerifiedIdentity
} from "./types";

function scoreFromQuery(query: string, seed: number): number {
  return Number((0.72 + ((query.length + seed) % 17) * 0.01).toFixed(2));
}

async function verifyToken(_ctx: GatewayContext): Promise<VerifiedIdentity> {
  return {
    tenantId: "tenant_local",
    appId: _ctx.appId || "phyok-chat-web",
    userId: _ctx.userId || "guest_anonymous",
    roles: ["user"],
    sessionId: _ctx.sessionId
  };
}

async function getMemoryGate(ctx: GatewayContext, query: string): Promise<MemoryGateResult> {
  const baseCount = query.includes("第一次") || query.includes("刚开始") ? 3 : 8;
  return {
    requestId: ctx.requestId,
    currentCount: baseCount,
    requiredCount: 5,
    passed: baseCount >= 5
  };
}

async function recallMemory(query: string): Promise<MemoryFragment[]> {
  const tag = query.includes("原生家庭")
    ? ["family_origin", "attachment"]
    : query.includes("关系")
      ? ["relationship", "anxiety"]
      : ["self", "emotion"];

  return [
    {
      fragmentId: "mem_001",
      title: "最近一次被触发的关系场景",
      content: "对方变得冷淡时，我会立刻担心自己被抛下，然后反复确认对方是否还在乎我。",
      score: scoreFromQuery(query, 1),
      topicTags: tag,
      emotionTags: ["anxious", "fear"]
    },
    {
      fragmentId: "mem_002",
      title: "更早的人际经验",
      content: "小时候表达需要时经常被说太敏感，于是我学会先压住感受，再通过猜测别人情绪来保护自己。",
      score: scoreFromQuery(query, 2),
      topicTags: ["childhood", "relationship_script"],
      emotionTags: ["shame", "alert"]
    }
  ];
}

async function recallKnowledge(query: string): Promise<KnowledgeSnippet[]> {
  return [
    {
      documentId: "doc_001",
      title: "依恋与自动化关系脚本",
      content: `与“${query.slice(0, 20)}”相关的知识线索：当个体在早期关系中缺乏稳定回应时，后续亲密关系里更容易出现过度警觉与确认需求。`,
      score: scoreFromQuery(query, 3)
    }
  ];
}

async function upsertMemoryPlan(query: string) {
  return {
    operation: "upsert",
    title: "本轮对话提炼出的记忆线索",
    fragments: [
      {
        summary: query.slice(0, 80),
        topicTags: ["current_round", "self_explore"]
      }
    ]
  };
}

async function createMemoryFragment(input: { contentText: string; timelineRoot?: string; searchable?: boolean }) {
  return {
    id: `mem_local_${Date.now()}`,
    timelineRoot: input.timelineRoot || "TODAY",
    contentText: input.contentText,
    searchable: input.searchable ?? true,
    sourceType: "local-debug"
  };
}

async function emitAuditTrace(_ctx: GatewayContext, _status: AuditTracePhase) {
  return;
}

async function precheckBilling(): Promise<BillingPrecheckResult> {
  return {
    allowed: true,
    plan: "starter"
  };
}

export function createMockDomainClients(): DomainClients {
  return {
    verifyToken,
    getMemoryGate,
    recallMemory: async (query) => recallMemory(query),
    recallKnowledge: async (query) => recallKnowledge(query),
    upsertMemoryPlan: async (query) => upsertMemoryPlan(query),
    createMemoryFragment: async (input) => createMemoryFragment(input),
    emitAuditTrace,
    precheckBilling: async () => precheckBilling()
  };
}

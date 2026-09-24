import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../../config/env";
import { createFailure, createSuccess, ERROR_CODES, extractExternalHeaders } from "../../packages/contracts/api";
import { verifyPrincipal } from "../../packages/auth/verified-principal";
import { proxyJavaJson } from "../../packages/domain-clients/java-service-proxy";
import { getConversationSummaryPage } from "../chat-v2/runtime";

const starMapQuerySchema = z.object({
  timelineRoot: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  appId: z.string().trim().optional(),
  limit: z.coerce.number().int().min(12).max(260).optional()
});

const TIMELINE_ORDER = ["EARLY", "CHILDHOOD", "STUDENT", "WORK", "TODAY"] as const;
const PEER_LINK_THRESHOLD = 0.18;
const MAX_PEERS_PER_NODE = 2;

function normalizeTimelineRoot(value?: string): (typeof TIMELINE_ORDER)[number] | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  return TIMELINE_ORDER.find((item) => item === normalized);
}

function inferTimeline(text: string, updatedAt: number): (typeof TIMELINE_ORDER)[number] {
  const normalized = text.toLowerCase();
  if (/(幼年|婴儿|很小|最早)/.test(normalized)) {
    return "EARLY";
  }
  if (/(童年|小学|父母|原生家庭|小时候|妈妈|爸爸)/.test(normalized)) {
    return "CHILDHOOD";
  }
  if (/(初中|高中|大学|学生|校园|老师|同学|宿舍|考试)/.test(normalized)) {
    return "STUDENT";
  }
  if (/(工作|同事|老板|项目|职场|公司|开会|加班)/.test(normalized)) {
    return "WORK";
  }
  const ageDays = Math.max(0, (Date.now() - updatedAt) / (1000 * 60 * 60 * 24));
  if (ageDays > 365 * 6) {
    return "EARLY";
  }
  if (ageDays > 365 * 3) {
    return "CHILDHOOD";
  }
  if (ageDays > 365) {
    return "STUDENT";
  }
  if (ageDays > 90) {
    return "WORK";
  }
  return "TODAY";
}

function normalizeForSimilarity(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\u4e00-\u9fa5]+/gu, "");
}

function computeSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeForSimilarity(left);
  const normalizedRight = normalizeForSimilarity(right);
  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }
  const leftTokens = new Set<string>();
  const rightTokens = new Set<string>();
  for (let index = 0; index < normalizedLeft.length; index += 1) {
    leftTokens.add(normalizedLeft[index]);
    if (index + 1 < normalizedLeft.length) {
      leftTokens.add(normalizedLeft.slice(index, index + 2));
    }
  }
  for (let index = 0; index < normalizedRight.length; index += 1) {
    rightTokens.add(normalizedRight[index]);
    if (index + 1 < normalizedRight.length) {
      rightTokens.add(normalizedRight.slice(index, index + 2));
    }
  }
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }
  return intersection / Math.max(leftTokens.size, rightTokens.size, 1);
}

function buildPairKey(left: string, right: string): string {
  return left <= right ? `${left}::${right}` : `${right}::${left}`;
}

function buildLocalDebugStarMap(ownerScope: string, limit: number, timelineRoot?: (typeof TIMELINE_ORDER)[number]) {
  const summaryPage = getConversationSummaryPage({
    ownerScope,
    pageNo: 1,
    pageSize: limit
  });
  const memoryNodes = summaryPage.items
    .map((item, index) => {
      const text = [item.title, item.latestPreview, item.latestUserMessage, item.latestAssistantMessage].filter(Boolean).join(" ");
      return {
        id: `history-${item.conversationId}`,
        type: "memory",
        timelineRoot: inferTimeline(text, item.updatedAt),
        label: item.title || "历史会话",
        contentText: item.latestPreview || item.latestAssistantMessage || item.latestUserMessage,
        score: Math.min(0.95, 0.58 + Math.min(item.turnCount, 8) * 0.04),
        sourceType: "local-debug",
        conversationId: item.conversationId,
        tags: [item.status === "completed" ? "COMPLETED" : "RUNNING", `${item.turnCount}T`, `${item.attachmentCount}A`],
        createdAt: new Date(item.updatedAt).toISOString()
      };
    })
    .filter((node) => !timelineRoot || node.timelineRoot === timelineRoot);

  const visibleRoots = timelineRoot ? TIMELINE_ORDER.filter((item) => item === timelineRoot) : TIMELINE_ORDER;
  const nodes = [
    ...visibleRoots.map((root) => ({
      id: `root-${root.toLowerCase()}`,
      type: "root",
      timelineRoot: root,
      label: root,
      contentText: null,
      score: null,
      sourceType: "local-debug",
      conversationId: null,
      tags: [root],
      createdAt: null
    })),
    ...memoryNodes
  ];

  const links = memoryNodes.map((node) => ({
    source: `root-${node.timelineRoot.toLowerCase()}`,
    target: node.id,
    type: "root",
    score: 1
  }));

  const existingPairs = new Set<string>();
  for (const root of visibleRoots) {
    const group = memoryNodes.filter((node) => node.timelineRoot === root);
    for (const current of group) {
      const topPeers = group
        .filter((candidate) => candidate.id !== current.id)
        .map((candidate) => ({
          candidate,
          similarity: computeSimilarity(current.contentText ?? "", candidate.contentText ?? "")
        }))
        .filter((item) => item.similarity > PEER_LINK_THRESHOLD)
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, MAX_PEERS_PER_NODE);

      for (const peer of topPeers) {
        const pairKey = buildPairKey(current.id, peer.candidate.id);
        if (existingPairs.has(pairKey)) {
          continue;
        }
        existingPairs.add(pairKey);
        links.push({
          source: current.id,
          target: peer.candidate.id,
          type: "peer",
          score: Number(peer.similarity.toFixed(3))
        });
      }
    }
  }

  return {
    view: timelineRoot ? timelineRoot.toLowerCase() : "all",
    limit,
    totalMemories: memoryNodes.length,
    nodes,
    links
  };
}

export const memoryV2Routes = async (app: FastifyInstance) => {
  app.get("/star-map", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const principal = await verifyPrincipal(externalHeaders);
    if (!principal) {
      await reply.code(401).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_UNAUTHORIZED, "请先登录后再查看记忆星图。")
      );
      return;
    }
    const parsed = starMapQuerySchema.safeParse(request.query);
    const timelineRoot = normalizeTimelineRoot(parsed.success ? parsed.data.timelineRoot : undefined);
    const limit = parsed.success ? (parsed.data.limit ?? 180) : 180;
    const allowDegraded = env.localDebugAllowDegraded || process.env.NODE_ENV !== "production";

    let payload;
    try {
      const query: Record<string, string> = {
        limit: String(limit)
      };
      if (timelineRoot) {
        query.timelineRoot = timelineRoot;
      }
      query.userId = principal.userId;
      query.appId = principal.appId;
      query.tenantId = principal.tenantId;
      payload = await proxyJavaJson<Record<string, unknown>>({
        baseUrl: env.javaDomainBaseUrl,
        path: "/v2/memories/star-map",
        method: "GET",
        headers: {
          ...externalHeaders,
          appId: principal.appId,
          userId: principal.userId,
          sessionId: principal.sessionId,
          userEmail: principal.email
        },
        query
      });
      if (allowDegraded && payload.code !== "OK") {
        payload = createSuccess(
          externalHeaders.requestId,
          buildLocalDebugStarMap(principal.ownerScope, limit, timelineRoot)
        );
      }
    } catch (error) {
      if (!allowDegraded) {
        throw error;
      }
      payload = createSuccess(
        externalHeaders.requestId,
        buildLocalDebugStarMap(principal.ownerScope, limit, timelineRoot)
      );
    }

    await reply.code(payload.code === "OK" ? 200 : 400).send(payload);
  });
};

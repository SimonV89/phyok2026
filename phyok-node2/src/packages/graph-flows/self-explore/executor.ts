import {
  getDomainClients,
  type GatewayContext
} from "../../domain-clients";
import type { StreamEventName, SseEventPayloadMap } from "../../contracts/sse";
import { createInitialSelfExploreState, type SelfExploreState } from "./state";
import type { ChatV2Attachment } from "../../../modules/chat-v2/runtime";

type Emit = <T extends StreamEventName>(event: T, data: SseEventPayloadMap[T]) => void;

type ExecuteInput = {
  runId: string;
  requestId: string;
  conversationId: string;
  query: string;
  attachments: ChatV2Attachment[];
  context: GatewayContext;
  signal: AbortSignal;
  emit: Emit;
};

function ensureNotAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new Error("aborted");
  }
}

async function sleep(ms: number, signal: AbortSignal) {
  ensureNotAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new Error("aborted"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function containsAny(text: string, list: string[]) {
  return list.some((item) => text.includes(item));
}

function detectSchool(text: string): string {
  if (containsAny(text, ["客体", "客体关系"])) {
    return "object_relations";
  }
  if (containsAny(text, ["自体", "自体心理"])) {
    return "self_psychology";
  }
  if (containsAny(text, ["人本", "存在主义"])) {
    return "humanistic_psychology";
  }
  if (containsAny(text, ["积极心理"])) {
    return "positive_psychology";
  }
  if (containsAny(text, ["正念"])) {
    return "mindfulness_psychology";
  }
  if (containsAny(text, ["森田"])) {
    return "morita_psychology";
  }
  if (containsAny(text, ["精神分析", "潜意识"])) {
    return "classical_psychoanalysis";
  }
  return "other_school";
}

function buildActionsFromState(state: SelfExploreState) {
  if (state.primaryIntent === "memory_create") {
    return [
      {
        id: "memory_more_detail",
        label: "补充更多细节",
        prompt: "我想继续补充这段经历的更多具体细节。"
      },
      {
        id: "memory_confirm",
        label: "确认沉淀记忆",
        prompt: "请把这轮整理出的个人记忆线索沉淀下来。"
      }
    ];
  }
  if (state.primaryIntent === "memory_repair") {
    return [
      {
        id: "repair_confirm",
        label: "继续修复记忆",
        prompt: "请继续帮我确认这条记忆需要怎么修改。"
      },
      {
        id: "repair_cancel",
        label: "暂不修改",
        prompt: "我想先保留现状，再想想是否要修改。"
      }
    ];
  }
  if (state.primaryIntent === "psychology_explore") {
    return [
      {
        id: "school_switch",
        label: "换个流派再看",
        prompt: "请换一个心理学流派的视角继续解释我刚才的问题。"
      },
      {
        id: "link_to_self",
        label: "结合我自己",
        prompt: "请结合我的经历，继续说明这个心理学流派和我有什么关系。"
      }
    ];
  }
  return [
    {
      id: "deeper_scene",
      label: "继续拆场景",
      prompt: "请继续帮我拆最近一次被触发的具体场景。"
    },
    {
      id: "root_cause",
      label: "探索更深根因",
      prompt: "请继续往更深处看，这背后的核心冲突可能是什么？"
    },
    {
      id: "memory_save",
      label: "沉淀这轮记忆",
      prompt: "请把这轮对话里重要的个人记忆线索整理出来。"
    }
  ];
}

function chunkText(text: string, size: number) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

function buildResponse(state: SelfExploreState) {
  if (state.primaryIntent === "memory_create") {
    return [
      "我先把这轮内容当作可沉淀的个人线索来整理。",
      "",
      `我听到的核心经历是：${state.normalizedInput.plainText}`,
      "",
      "从记忆整理的角度，这里最有价值的通常包括：事件场景、重要人物、当时的情绪、你后来形成的自我判断。",
      "",
      `我已先形成一份写入计划：${JSON.stringify(state.memoryWritePlan, null, 2)}`,
      "",
      "如果你愿意，下一步可以继续补细节，让记忆碎片更稳定。"
    ].join("\n");
  }

  if (state.primaryIntent === "memory_repair") {
    const actionLine = state.needsConfirmation
      ? "这类操作影响较大，正式变更前需要你再次确认。"
      : "这类调整影响较小，可以进入后续修复流程。";
    return [
      "我先把你对旧记忆的修正意图收拢一下。",
      "",
      `当前识别到的修复动作倾向是：${state.memoryAction || "unclear"}`,
      actionLine,
      "",
      "如果你愿意，下一步我会先帮你确认：原记忆哪里不准确、你希望保留什么、你想改成什么。"
    ].join("\n");
  }

  if (state.primaryIntent === "psychology_explore") {
    return [
      `这轮我先按“${state.school || "other_school"}”的视角来讲。`,
      "",
      state.evidencePack.composed,
      "",
      "先不急着下结论，更重要的是看：这个理论视角如何帮助你理解自己现在的体验，而不是只停在知识层面。"
    ].join("\n");
  }

  if (!state.memoryGatePassed) {
    return [
      "我能继续深挖，但先要提醒你：当前可用于深度探索的个人记忆线索还不够。",
      "",
      `现在大约只有 ${state.memoryCount} 条，正式进入深度探索至少建议有 5 条。`,
      "",
      "你可以先告诉我一个最近最具体的场景，我会先帮你沉淀成记忆，再继续往下探索。"
    ].join("\n");
  }

  const expertTitle =
    state.explorationTrack === "family_origin_explore"
      ? "原生家庭"
      : state.explorationTrack === "root_cause_explore"
        ? "困扰根因"
        : "潜意识与关系脚本";

  return [
    `我先沿着“${expertTitle}”这条线继续往下看。`,
    "",
    state.evidencePack.composed,
    "",
    "如果先用一句话收拢：你现在的反应不像是单次情绪波动，更像是一个在关系里被反复触发的旧脚本。",
    "接下来最值得看的，不是你是不是做错了，而是这个脚本当年是如何形成、又为什么一直延续到现在。"
  ].join("\n");
}

export async function executeSelfExploreFlow(input: ExecuteInput) {
  const domainClients = getDomainClients();
  let activeContext: GatewayContext = { ...input.context };
  const state = createInitialSelfExploreState({
    runId: input.runId,
    requestId: input.requestId,
    conversationId: input.conversationId,
    query: input.query,
    attachments: input.attachments
  });

  const emitTool = async (tool: string, label: string, work?: () => Promise<void>) => {
    input.emit("tool.started", { runId: state.runId, tool, label });
    if (work) {
      await work();
    } else {
      await sleep(80, input.signal);
    }
    input.emit("tool.completed", { runId: state.runId, tool, label: `${label}完成` });
  };

  const identity = await domainClients.verifyToken(activeContext);
  activeContext = {
    ...activeContext,
    tenantId: identity.tenantId,
    appId: identity.appId || activeContext.appId,
    userId: identity.userId || activeContext.userId,
    sessionId: identity.sessionId || activeContext.sessionId
  };
  await domainClients.emitAuditTrace(activeContext, "start");
  await domainClients.precheckBilling(activeContext);

  input.emit("message.started", {
    runId: state.runId,
    conversationId: state.conversationId,
    createdAt: Date.now()
  });

  await emitTool("parse_multimodal", "多模态入口预处理", async () => {
    if (state.attachments.length === 0) {
      state.multimodalDigest.summary = "本轮没有附件输入。";
      return;
    }
    state.multimodalDigest = {
      summary: `检测到 ${state.attachments.length} 个附件，按文档要求将先进入 knowledge_base，再判断是否提炼为 memory_fragments。`,
      attachments: state.attachments.map((item) => ({
        name: item.name,
        kind: item.kind,
        mimeType: item.mimeType
      }))
    };
    await sleep(110, input.signal);
  });

  await emitTool("input-normalizer", "输入规范化", async () => {
    state.normalizedInput = {
      plainText: state.query.trim(),
      summary: state.attachments.length > 0 ? state.multimodalDigest.summary : "文本输入已归一化。"
    };
  });
  state.output.thinking.push("正在归一化输入，识别本轮主意图与上下文。");

  await emitTool("intent-router", "意图识别", async () => {
    const lower = state.normalizedInput.plainText.toLowerCase();
    if (containsAny(state.normalizedInput.plainText, ["删除记忆", "删掉", "更正", "修改记忆", "修复记忆"])) {
      state.primaryIntent = "memory_repair";
      state.memoryAction = containsAny(state.normalizedInput.plainText, ["删除", "删掉"])
        ? "delete"
        : containsAny(state.normalizedInput.plainText, ["合并"])
          ? "merge"
          : "update";
      state.needsConfirmation = state.memoryAction === "delete" || state.memoryAction === "merge";
      return;
    }
    if (containsAny(state.normalizedInput.plainText, ["记住", "沉淀", "记忆碎片", "帮我记下"])) {
      state.primaryIntent = "memory_create";
      return;
    }
    if (containsAny(lower, ["心理学", "流派", "精神分析", "客体", "自体", "人本", "正念", "森田"])) {
      state.primaryIntent = "psychology_explore";
      state.school = detectSchool(state.normalizedInput.plainText);
      return;
    }
    state.primaryIntent = "deep_explore";
    state.needsMemoryGate = true;
    if (containsAny(state.normalizedInput.plainText, ["原生家庭", "父母", "童年"])) {
      state.explorationTrack = "family_origin_explore";
    } else if (containsAny(state.normalizedInput.plainText, ["根因", "为什么总是", "总会这样"])) {
      state.explorationTrack = "root_cause_explore";
    } else {
      state.explorationTrack = "unconscious_explore";
    }
  });
  state.output.thinking.push(`当前主意图识别为 ${state.primaryIntent}。`);

  await emitTool("retrieval-planner", "检索规划", async () => {
    state.retrievalPlan = {
      memory: state.primaryIntent === "deep_explore" ? "required" : state.primaryIntent === "psychology_explore" ? "optional" : "skip",
      knowledge:
        state.primaryIntent === "deep_explore" && state.attachments.length > 0
          ? "optional_if_attachment_exists"
          : state.primaryIntent === "psychology_explore"
            ? "optional"
            : "skip"
    };
  });

  if (state.primaryIntent === "memory_create") {
    await emitTool("memory-write-planner", "记忆写入规划", async () => {
      state.memoryWritePlan = await domainClients.upsertMemoryPlan(
        state.normalizedInput.plainText,
        activeContext
      );
    });
  } else if (state.primaryIntent === "memory_repair") {
    state.memoryWritePlan = {
      operation: state.memoryAction,
      requiresConfirmation: state.needsConfirmation
    };
  } else {
    if (state.primaryIntent === "deep_explore") {
      await emitTool("memory-gate-check", "记忆门槛检查", async () => {
        const gate = await domainClients.getMemoryGate(activeContext, state.normalizedInput.plainText);
        state.memoryCount = gate.currentCount;
        state.memoryGatePassed = gate.passed;
      });
      if (!state.memoryGatePassed) {
        state.output.thinking.push("记忆门槛不足，改为引导用户先沉淀记忆。");
      }
    }

    if (state.primaryIntent === "psychology_explore" || state.memoryGatePassed) {
      await emitTool("memory-retrieve", "召回记忆碎片", async () => {
        state.evidencePack.memory = await domainClients.recallMemory(
          state.normalizedInput.plainText,
          activeContext
        );
        for (const item of state.evidencePack.memory) {
          input.emit("citation.appended", {
            runId: state.runId,
            source: "memory_fragments",
            title: item.title,
            content: item.content,
            score: item.score
          });
        }
      });

      const shouldLoadKnowledge =
        state.primaryIntent === "psychology_explore" ||
        (state.primaryIntent === "deep_explore" && state.attachments.length > 0);
      if (shouldLoadKnowledge) {
        await emitTool("knowledge-retrieve", "召回知识片段", async () => {
          state.evidencePack.knowledge = await domainClients.recallKnowledge(
            state.normalizedInput.plainText,
            activeContext
          );
          for (const item of state.evidencePack.knowledge) {
            input.emit("citation.appended", {
              runId: state.runId,
              source: "knowledge_base",
              title: item.title,
              content: item.content,
              score: item.score
            });
          }
        });
      }
    }

    await emitTool("evidence-composer", "证据拼装", async () => {
      const memoryBlock =
        state.evidencePack.memory.length > 0
          ? `记忆依据：\n${state.evidencePack.memory
              .map((item) => `- ${item.title}：${item.content}`)
              .join("\n")}`
          : "记忆依据：当前主要依赖用户刚刚提供的线索。";
      const knowledgeBlock =
        state.evidencePack.knowledge.length > 0
          ? `知识依据：\n${state.evidencePack.knowledge
              .map((item) => `- ${item.title}：${item.content}`)
              .join("\n")}`
          : "";
      state.evidencePack.composed = [memoryBlock, knowledgeBlock].filter(Boolean).join("\n\n");
    });
  }

  await emitTool("response-polisher", "Floyd 风格收口", async () => {
    state.output.response = buildResponse(state);
    state.output.actions = buildActionsFromState(state);
    state.output.thinking.push("正在按 Floyd 的温柔、克制、深切关怀风格整理最终回答。");
  });

  for (const chunk of chunkText(state.output.thinking.join("\n"), 22)) {
    input.emit("thinking.delta", {
      runId: state.runId,
      delta: chunk
    });
    await sleep(50, input.signal);
  }

  for (const chunk of chunkText(state.output.response, 24)) {
    input.emit("message.delta", {
      runId: state.runId,
      delta: chunk
    });
    await sleep(45, input.signal);
  }

  input.emit("interaction.required", {
    runId: state.runId,
    title: "你想怎么继续？",
    description: "可以直接点一个动作继续，也可以自己改写你的下一句。",
    actions: state.output.actions
  });

  input.emit("usage.reported", {
    runId: state.runId,
    inputChars: state.query.length,
    outputChars: state.output.response.length,
    attachmentCount: state.attachments.length
  });

  await domainClients.emitAuditTrace(activeContext, "complete");

  return {
    state,
    thinking: state.output.thinking.join("\n"),
    response: state.output.response,
    actions: state.output.actions
  };
}

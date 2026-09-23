import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import path from "node:path";

import { env } from "../../config/env";
import { ERROR_CODES } from "../../packages/contracts/api";
import type { StreamEventName, SseEventPayloadMap } from "../../packages/contracts/sse";
import { executeSelfExploreFlow } from "../../packages/graph-flows/self-explore/executor";

export type ChatV2Attachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "audio" | "document" | "other";
};

export type ChatV2Action = {
  id: string;
  label: string;
  prompt: string;
};

export type ChatHistoryItem = {
  id: string;
  runId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  status: ChatV2RunStatus;
  createdAt: number;
  attachments: ChatV2Attachment[];
  thinking?: string;
  actions?: ChatV2Action[];
};

export type ConversationHistorySummary = {
  conversationId: string;
  latestRunId: string;
  title: string;
  latestPreview: string;
  latestUserMessage: string;
  latestAssistantMessage: string;
  status: ChatV2RunStatus;
  attachmentCount: number;
  turnCount: number;
  startedAt: number;
  updatedAt: number;
};

export type ChatV2Event = {
  seq: number;
  event: StreamEventName | "heartbeat";
  data: Record<string, unknown>;
};

export type ChatV2RunStatus = "queued" | "running" | "completed" | "failed" | "stopped";

type ChatRunInput = {
  authorization?: string;
  requestId: string;
  traceId: string;
  appId: string;
  userId: string;
  sessionId: string;
  conversationId: string;
  message: string;
  attachments: ChatV2Attachment[];
};

type ChatRunState = {
  runId: string;
  input: ChatRunInput;
  status: ChatV2RunStatus;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  thinking: string;
  answer: string;
  actions: ChatV2Action[];
  errorMessage: string | null;
  events: ChatV2Event[];
  subscribers: Map<string, ServerResponse>;
  sequence: number;
  started: boolean;
  abortController: AbortController;
};

type PersistedChatRunState = {
  runId: string;
  input: Omit<ChatRunInput, "authorization">;
  status: ChatV2RunStatus;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  thinking: string;
  answer: string;
  actions: ChatV2Action[];
  errorMessage: string | null;
  sequence: number;
  started: boolean;
};

type PersistedChatRunStore = {
  version: number;
  runs: PersistedChatRunState[];
};

const HEARTBEAT_MS = 12000;
const CHAT_RUN_STORE_VERSION = 1;
const RUN_TTL_MS = env.chatHistoryRetentionDays * 24 * 60 * 60 * 1000;
const runs = new Map<string, ChatRunState>();
let persistQueue = Promise.resolve();

function isRunStatus(value: unknown): value is ChatV2RunStatus {
  return value === "queued" || value === "running" || value === "completed" || value === "failed" || value === "stopped";
}

function extractErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const separatorIndex = error.message.indexOf(":");
  if (separatorIndex <= 0) {
    return undefined;
  }
  const code = error.message.slice(0, separatorIndex).trim();
  return code.length > 0 ? code : undefined;
}

function toPersistedRun(run: ChatRunState): PersistedChatRunState {
  return {
    runId: run.runId,
    input: {
      requestId: run.input.requestId,
      traceId: run.input.traceId,
      appId: run.input.appId,
      userId: run.input.userId,
      sessionId: run.input.sessionId,
      conversationId: run.input.conversationId,
      message: run.input.message,
      attachments: run.input.attachments
    },
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt,
    thinking: run.thinking,
    answer: run.answer,
    actions: run.actions,
    errorMessage: run.errorMessage,
    sequence: run.sequence,
    started: run.started
  };
}

function hydratePersistedRun(record: PersistedChatRunState, now: number): ChatRunState {
  const status = record.status === "queued" || record.status === "running" ? "stopped" : record.status;
  const updatedAt = record.status === "queued" || record.status === "running" ? now : record.updatedAt;
  const finishedAt =
    record.status === "queued" || record.status === "running" ? record.finishedAt ?? now : record.finishedAt;
  const errorMessage =
    record.status === "queued" || record.status === "running"
      ? record.errorMessage || "服务已重启，本轮生成已停止。"
      : record.errorMessage;

  return {
    runId: record.runId,
    input: {
      authorization: undefined,
      requestId: record.input.requestId,
      traceId: record.input.traceId,
      appId: record.input.appId,
      userId: record.input.userId,
      sessionId: record.input.sessionId,
      conversationId: record.input.conversationId,
      message: record.input.message,
      attachments: record.input.attachments
    },
    status,
    createdAt: record.createdAt,
    updatedAt,
    finishedAt,
    thinking: record.thinking,
    answer: record.answer,
    actions: record.actions,
    errorMessage,
    events: [],
    subscribers: new Map(),
    sequence: record.sequence,
    started: true,
    abortController: new AbortController()
  };
}

async function persistRunsToDisk(): Promise<void> {
  const targetFile = env.chatHistoryStoreFile;
  const snapshot: PersistedChatRunStore = {
    version: CHAT_RUN_STORE_VERSION,
    runs: [...runs.values()].map(toPersistedRun)
  };

  await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
  const tempFile = `${targetFile}.tmp`;
  await fs.promises.writeFile(tempFile, JSON.stringify(snapshot), "utf-8");
  await fs.promises.rename(tempFile, targetFile);
}

function schedulePersistRuns(): void {
  persistQueue = persistQueue
    .then(() => persistRunsToDisk())
    .catch((error) => {
      console.warn("[chat-v2] failed to persist chat history store", error);
    });
}

function loadPersistedRuns(): void {
  const targetFile = env.chatHistoryStoreFile;
  if (!fs.existsSync(targetFile)) {
    return;
  }

  try {
    const raw = fs.readFileSync(targetFile, "utf-8").trim();
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedChatRunStore>;
    const records = Array.isArray(parsed.runs) ? parsed.runs : [];
    const now = Date.now();
    let mutated = false;

    for (const record of records) {
      if (
        !record ||
        typeof record !== "object" ||
        typeof record.runId !== "string" ||
        !record.input ||
        typeof record.input !== "object" ||
        typeof record.input.conversationId !== "string" ||
        typeof record.input.message !== "string" ||
        !isRunStatus(record.status)
      ) {
        mutated = true;
        continue;
      }

      const hydrated = hydratePersistedRun(record as PersistedChatRunState, now);
      if (hydrated.status !== record.status) {
        mutated = true;
      }
      runs.set(hydrated.runId, hydrated);
    }

    pruneRuns();
    if (mutated) {
      schedulePersistRuns();
    }
  } catch (error) {
    console.warn("[chat-v2] failed to load chat history store", error);
  }
}

function pruneRuns(): void {
  const now = Date.now();
  let removed = false;
  for (const [runId, run] of runs) {
    if (run.status === "running" || run.status === "queued") {
      continue;
    }
    if (now - run.updatedAt <= RUN_TTL_MS) {
      continue;
    }
    runs.delete(runId);
    removed = true;
  }
  if (removed) {
    schedulePersistRuns();
  }
}

loadPersistedRuns();

function inferAttachmentKind(mimeType: string): ChatV2Attachment["kind"] {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("presentation") ||
    mimeType.includes("text/")
  ) {
    return "document";
  }
  return "other";
}

function writeEvent(reply: ServerResponse, event: ChatV2Event): boolean {
  try {
    reply.write(`id: ${event.seq}\n`);
    reply.write(`event: ${event.event}\n`);
    reply.write(`data: ${JSON.stringify({ seq: event.seq, ...event.data })}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function emitEvent<T extends StreamEventName>(run: ChatRunState, event: T, data: SseEventPayloadMap[T]) {
  const nextEvent: ChatV2Event = {
    seq: run.sequence + 1,
    event,
    data: data as Record<string, unknown>
  };
  run.sequence = nextEvent.seq;
  run.updatedAt = Date.now();
  run.events.push(nextEvent);
  for (const [subscriberId, reply] of run.subscribers) {
    const ok = writeEvent(reply, nextEvent);
    if (!ok) {
      run.subscribers.delete(subscriberId);
    }
  }
}

async function runPipeline(run: ChatRunState): Promise<void> {
  if (run.started) {
    return;
  }
  run.started = true;
  run.status = "running";
  run.updatedAt = Date.now();
  schedulePersistRuns();

  try {
    const result = await executeSelfExploreFlow({
      runId: run.runId,
      requestId: run.input.requestId,
      conversationId: run.input.conversationId,
      query: run.input.message,
      attachments: run.input.attachments,
      context: {
        authorization: run.input.authorization,
        requestId: run.input.requestId,
        traceId: run.input.traceId,
        appId: run.input.appId,
        userId: run.input.userId,
        sessionId: run.input.sessionId
      },
      signal: run.abortController.signal,
      emit: (event, data) => {
        emitEvent(run, event, data);
        if (event === "thinking.delta") {
          run.thinking += (data as SseEventPayloadMap["thinking.delta"]).delta;
        } else if (event === "message.delta") {
          run.answer += (data as SseEventPayloadMap["message.delta"]).delta;
        } else if (event === "interaction.required") {
          run.actions = (data as SseEventPayloadMap["interaction.required"]).actions;
        }
      }
    });

    run.status = "completed";
    run.finishedAt = Date.now();
    run.updatedAt = Date.now();
    run.thinking = result.thinking;
    run.answer = result.response;
    run.actions = result.actions;
    schedulePersistRuns();
    emitEvent(run, "message.completed", {
      runId: run.runId,
      message: result.response,
      thinking: result.thinking,
      actions: result.actions
    });
    emitEvent(run, "stream.completed", {
      runId: run.runId,
      status: run.status
    });
  } catch (error) {
    const aborted = error instanceof Error && error.message === "aborted";
    const explicitCode = extractErrorCode(error);
    run.status = aborted ? "stopped" : "failed";
    run.errorMessage = aborted ? "已停止本轮生成。" : error instanceof Error ? error.message : "生成失败。";
    run.finishedAt = Date.now();
    run.updatedAt = Date.now();
    schedulePersistRuns();
    emitEvent(run, aborted ? "warning.raised" : "stream.failed", {
      runId: run.runId,
      message: run.errorMessage,
      code: aborted ? ERROR_CODES.SSE_STREAM_ABORTED : explicitCode ?? ERROR_CODES.GRAPH_EXECUTION_FAILED
    });
    emitEvent(run, "stream.completed", {
      runId: run.runId,
      status: run.status
    });
  } finally {
    for (const [subscriberId, reply] of run.subscribers) {
      try {
        reply.end();
      } catch {
        // ignore
      }
      run.subscribers.delete(subscriberId);
    }
    pruneRuns();
  }
}

export function createChatRun(input: {
  authorization?: string;
  requestId: string;
  traceId: string;
  appId: string;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  message: string;
  attachments?: Array<Partial<ChatV2Attachment>>;
}): ChatRunState {
  pruneRuns();

  const runId = randomUUID();
  const conversationId = input.conversationId?.trim() || randomUUID();
  const attachments = (input.attachments ?? []).map((item, index) => ({
    id: item.id?.trim() || `${runId}-att-${index + 1}`,
    name: item.name?.trim() || `attachment-${index + 1}`,
    mimeType: item.mimeType?.trim() || "application/octet-stream",
    size: Number.isFinite(item.size) ? Number(item.size) : 0,
    kind: item.kind ?? inferAttachmentKind(item.mimeType?.trim() || "")
  }));

  const run: ChatRunState = {
    runId,
    input: {
      authorization: input.authorization,
      requestId: input.requestId,
      traceId: input.traceId,
      appId: input.appId,
      userId: input.userId?.trim() || "guest_anonymous",
      sessionId: input.sessionId?.trim() || `sess_${runId}`,
      conversationId,
      message: input.message.trim(),
      attachments
    },
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    finishedAt: null,
    thinking: "",
    answer: "",
    actions: [],
    errorMessage: null,
    events: [],
    subscribers: new Map(),
    sequence: 0,
    started: false,
    abortController: new AbortController()
  };

  runs.set(runId, run);
  schedulePersistRuns();
  queueMicrotask(() => {
    void runPipeline(run);
  });
  return run;
}

export function getChatRun(runId: string): ChatRunState | null {
  pruneRuns();
  return runs.get(runId) ?? null;
}

export function getChatRunSnapshot(runId: string) {
  const run = getChatRun(runId);
  if (!run) {
    return null;
  }
  return {
    runId: run.runId,
    conversationId: run.input.conversationId,
    status: run.status,
    message: run.answer,
    thinking: run.thinking,
    actions: run.actions,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt,
    lastSeq: run.sequence,
    attachmentCount: run.input.attachments.length
  };
}

export function getConversationHistoryPage(options: {
  conversationId: string;
  cursor?: string;
  limit: number;
}): {
  conversationId: string;
  items: ChatHistoryItem[];
  nextCursor: string | null;
  hasNext: boolean;
  total: number;
} {
  pruneRuns();

  const allItems = [...runs.values()]
    .filter((run) => run.input.conversationId === options.conversationId)
    .sort((left, right) => left.createdAt - right.createdAt)
    .flatMap<ChatHistoryItem>((run) => {
      const userTurn: ChatHistoryItem = {
        id: `${run.runId}:user`,
        runId: run.runId,
        conversationId: run.input.conversationId,
        role: "user",
        content: run.input.message,
        status: run.status,
        createdAt: run.createdAt,
        attachments: run.input.attachments
      };

      const assistantContent =
        run.answer || (run.status === "failed" || run.status === "stopped" ? run.errorMessage || "" : "");
      const assistantTurn: ChatHistoryItem = {
        id: `${run.runId}:assistant`,
        runId: run.runId,
        conversationId: run.input.conversationId,
        role: "assistant",
        content: assistantContent,
        status: run.status,
        createdAt: run.finishedAt ?? run.updatedAt,
        attachments: [],
        thinking: run.thinking,
        actions: run.actions
      };

      return assistantTurn.content ? [userTurn, assistantTurn] : [userTurn];
    });

  const start = Number.isFinite(Number(options.cursor)) ? Math.max(0, Number(options.cursor)) : 0;
  const end = Math.min(allItems.length, start + options.limit);
  const items = allItems.slice(start, end);

  return {
    conversationId: options.conversationId,
    items,
    nextCursor: end < allItems.length ? String(end) : null,
    hasNext: end < allItems.length,
    total: allItems.length
  };
}

export function getConversationSummaryPage(options: {
  pageNo: number;
  pageSize: number;
  keyword?: string;
}): {
  pageNo: number;
  pageSize: number;
  total: number;
  items: ConversationHistorySummary[];
} {
  pruneRuns();

  const grouped = new Map<string, ChatRunState[]>();
  for (const run of runs.values()) {
    const list = grouped.get(run.input.conversationId);
    if (list) {
      list.push(run);
      continue;
    }
    grouped.set(run.input.conversationId, [run]);
  }

  const summaries = [...grouped.entries()]
    .map<ConversationHistorySummary>(([conversationId, conversationRuns]) => {
      const orderedRuns = [...conversationRuns].sort((left, right) => left.createdAt - right.createdAt);
      const firstRun = orderedRuns[0];
      const latestRun = orderedRuns[orderedRuns.length - 1];
      const latestAssistantMessage =
        latestRun.answer ||
        (latestRun.status === "failed" || latestRun.status === "stopped" ? latestRun.errorMessage || "" : "");
      const latestPreview = latestAssistantMessage || latestRun.input.message;
      const titleSource = firstRun.input.message || latestPreview || "未命名对话";
      const compactTitle = titleSource.replace(/\s+/g, " ").trim();

      return {
        conversationId,
        latestRunId: latestRun.runId,
        title: compactTitle.length > 28 ? `${compactTitle.slice(0, 28)}…` : compactTitle,
        latestPreview,
        latestUserMessage: latestRun.input.message,
        latestAssistantMessage,
        status: latestRun.status,
        attachmentCount: orderedRuns.reduce((sum, run) => sum + run.input.attachments.length, 0),
        turnCount: orderedRuns.length,
        startedAt: firstRun.createdAt,
        updatedAt: latestRun.finishedAt ?? latestRun.updatedAt
      };
    })
    .filter((item) => {
      const keyword = options.keyword?.trim().toLowerCase();
      if (!keyword) {
        return true;
      }
      return [
        item.title,
        item.latestPreview,
        item.latestUserMessage,
        item.latestAssistantMessage,
        item.conversationId
      ].some((value) => value.toLowerCase().includes(keyword));
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);

  const safePageNo = Math.max(1, options.pageNo);
  const safePageSize = Math.max(1, options.pageSize);
  const start = (safePageNo - 1) * safePageSize;
  const items = summaries.slice(start, start + safePageSize);

  return {
    pageNo: safePageNo,
    pageSize: safePageSize,
    total: summaries.length,
    items
  };
}

export function deleteConversationHistory(conversationId: string): {
  deleted: boolean;
  deletedRuns: number;
  conversationId: string;
} {
  const targetConversationId = conversationId.trim();
  if (!targetConversationId) {
    return {
      deleted: false,
      deletedRuns: 0,
      conversationId: targetConversationId
    };
  }

  let deletedRuns = 0;
  for (const [runId, run] of runs) {
    if (run.input.conversationId !== targetConversationId) {
      continue;
    }

    for (const [, reply] of run.subscribers) {
      try {
        reply.end();
      } catch {
        // ignore
      }
    }
    run.subscribers.clear();
    run.abortController.abort();
    runs.delete(runId);
    deletedRuns += 1;
  }

  if (deletedRuns > 0) {
    schedulePersistRuns();
  }

  return {
    deleted: deletedRuns > 0,
    deletedRuns,
    conversationId: targetConversationId
  };
}

export function stopChatRun(runId: string): { found: boolean; stopped: boolean; status?: ChatV2RunStatus } {
  const run = getChatRun(runId);
  if (!run) {
    return { found: false, stopped: false };
  }
  if (run.status !== "queued" && run.status !== "running") {
    return { found: true, stopped: false, status: run.status };
  }
  run.abortController.abort();
  return { found: true, stopped: true, status: "stopped" };
}

export function attachChatRunStream(options: {
  runId: string;
  reply: ServerResponse;
  fromSeq?: number;
  headers?: Record<string, string>;
}): { found: boolean; close: () => void } {
  const run = getChatRun(options.runId);
  if (!run) {
    return { found: false, close: () => undefined };
  }

  const reply = options.reply;
  const subscriberId = randomUUID();

  reply.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    ...options.headers
  });

  const startingSeq = Number.isFinite(options.fromSeq) ? Number(options.fromSeq) : 0;
  for (const event of run.events) {
    if (event.seq <= startingSeq) {
      continue;
    }
    const ok = writeEvent(reply, event);
    if (!ok) {
      try {
        reply.end();
      } catch {
        // ignore
      }
      return { found: true, close: () => undefined };
    }
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "stopped") {
    try {
      reply.end();
    } catch {
      // ignore
    }
    return { found: true, close: () => undefined };
  }

  run.subscribers.set(subscriberId, reply);
  const heartbeat = setInterval(() => {
    try {
      reply.write(`event: heartbeat\ndata: ${JSON.stringify({ runId: run.runId, ts: Date.now() })}\n\n`);
    } catch {
      run.subscribers.delete(subscriberId);
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_MS);

  const close = () => {
    clearInterval(heartbeat);
    run.subscribers.delete(subscriberId);
    try {
      reply.end();
    } catch {
      // ignore
    }
  };

  return { found: true, close };
}

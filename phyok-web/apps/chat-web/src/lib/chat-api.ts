import type { AttachmentDraft, InteractionAction, RiskAlert } from "@/store/chat-slice";
import { buildClientHeaders, getAppId } from "@/lib/auth-session";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function buildApiPath(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

function buildApiUrl(path: string): URL {
  if (API_BASE) {
    return new URL(path, API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`);
  }
  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin);
  }
  return new URL(path, "http://127.0.0.1");
}

export type ChatStreamEvent =
  | { event: "message.started"; data: { seq: number; runId: string; conversationId: string; createdAt: number } }
  | { event: "tool.started" | "tool.completed"; data: { seq: number; runId: string; tool: string; label: string } }
  | { event: "thinking.delta"; data: { seq: number; runId: string; delta: string } }
  | { event: "message.delta"; data: { seq: number; runId: string; delta: string } }
  | {
      event: "citation.appended";
      data: {
        seq: number;
        runId: string;
        source: "memory_fragments" | "knowledge_base";
        title: string;
        content: string;
        score?: number;
      };
    }
  | {
      event: "interaction.required";
      data: { seq: number; runId: string; title: string; description: string; actions: InteractionAction[] };
    }
  | {
      event: "usage.reported";
      data: { seq: number; runId: string; inputChars: number; outputChars: number; attachmentCount: number };
    }
  | { event: "risk.alerted"; data: { seq: number; runId: string } & RiskAlert }
  | { event: "warning.raised" | "stream.failed"; data: { seq: number; runId: string; message: string; code?: string } }
  | {
      event: "message.completed";
      data: { seq: number; runId: string; message: string; thinking: string; actions: InteractionAction[] };
    }
  | { event: "stream.completed"; data: { seq: number; runId: string; status: string } }
  | { event: "heartbeat"; data: { runId: string; ts: number } };

export type RunStateResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    runId: string;
    conversationId: string;
    status: string;
    message: string;
    thinking: string;
    actions: InteractionAction[];
    errorMessage: string | null;
    createdAt: number;
    updatedAt: number;
    finishedAt: number | null;
    lastSeq: number;
    attachmentCount: number;
  };
};

export type HistoryItemResponse = {
  id: string;
  runId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  status: string;
  createdAt: number;
  attachments: AttachmentDraft[];
  thinking?: string;
  actions?: InteractionAction[];
};

export type HistoryResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    conversationId: string;
    items: HistoryItemResponse[];
    nextCursor: string | null;
    hasNext: boolean;
    total: number;
    limit: number;
  };
};

export type ConversationHistorySummary = {
  conversationId: string;
  latestRunId: string;
  title: string;
  latestPreview: string;
  latestUserMessage: string;
  latestAssistantMessage: string;
  status: string;
  attachmentCount: number;
  turnCount: number;
  startedAt: number;
  updatedAt: number;
};

export type ConversationSummaryPageResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    pageNo: number;
    pageSize: number;
    total: number;
    items: ConversationHistorySummary[];
  };
};

export type MediaUploadResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    assetId: string;
    taskId: string;
    fileName: string;
    mimeType: string;
    kind: AttachmentDraft["kind"];
    size: number;
    scene: string;
    conversationId: string | null;
    status: string;
    parseStatus: string;
    uploadedAt: number;
  };
};

export type SendCodeResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    accepted: boolean;
    ticket?: string;
    retryAfterSec?: number;
    expiresInSec?: number;
    debugCode?: string;
  };
};

export type VerifyCodeResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    sessionToken: string;
    refreshToken: string;
    expiresAt: string;
    newUser: boolean;
    principal: {
      tenantId: string;
      appId: string;
      userId: string;
      sessionId: string;
      roles: string[];
    };
  };
};

export type BillingAccountResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    plan: string;
    monthlyTokenLimit: number;
    consumedTokens: number;
    remainingTokens: number;
    quotaState: string;
    billingStatus: string;
    paymentChannel?: string;
    seedUser?: boolean;
    recommendedPlanId?: string;
  };
};

export type BillingPlanItem = {
  id: string;
  name: string;
  priceFen: number;
  quota: number;
  description: string;
  highlight?: string;
  recommended?: boolean;
};

export type BillingPlansResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    paymentChannel: string;
    items: BillingPlanItem[];
  };
};

export type CreateAlipayOrderResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    orderNo: string;
    planId: string;
    amountFen: number;
    quota?: number;
    status?: string;
    paymentChannel: string;
    paymentMode?: "PAGE" | "WAP";
    payUrl: string;
    qrCodeUrl: string;
    qrCodeContent?: string;
    expiresAt: string;
    tradeNo?: string;
    paidAt?: string;
  };
};

export type AuditEventResponse = {
  id: string;
  tenantId: string;
  appId: string;
  userId?: string | null;
  traceId: string;
  requestId: string;
  eventType: string;
  sourceService: string;
  entityType?: string | null;
  entityId?: string | null;
  payloadJson: string;
  createdAt: string;
};

export type AuditEventPageResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    pageNo: number;
    pageSize: number;
    total: number;
    items: AuditEventResponse[];
  };
};

export type ComplaintFeedbackCategory = "product" | "payment" | "privacy" | "experience" | "other";

export type ComplaintFeedbackResponse = {
  code: string;
  message: string;
  data: {
    id: string;
    userId?: string | null;
    userEmail?: string | null;
    contactEmail?: string | null;
    conversationId?: string | null;
    category: ComplaintFeedbackCategory;
    content: string;
    status: "OPEN" | "REPLIED";
    replyContent?: string | null;
    replyBy?: string | null;
    repliedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type DeleteAccountRequestResponse = {
  code: string;
  message: string;
  data?: {
    jobId?: string;
    id?: string;
    status?: string;
    reason?: string;
  } | null;
};

export type MemoryStarMapNode = {
  id: string;
  type: "root" | "memory";
  timelineRoot: "EARLY" | "CHILDHOOD" | "STUDENT" | "WORK" | "TODAY";
  label: string;
  contentText: string | null;
  score: number | null;
  sourceType: string;
  conversationId: string | null;
  tags: string[];
  createdAt: string | null;
};

export type MemoryStarMapLink = {
  source: string;
  target: string;
  type: "root" | "peer";
  score: number | null;
};

export type MemoryStarMapResponse = {
  code: string;
  message: string;
  requestId: string;
  data: {
    view: string;
    limit: number;
    totalMemories: number;
    nodes: MemoryStarMapNode[];
    links: MemoryStarMapLink[];
  };
};

type ApiFailureResponse = {
  code: string;
  message: string;
  requestId?: string;
  data?: Record<string, unknown>;
};

async function readErrorMessage(response: Response): Promise<string> {
  const raw = await response.text();
  if (!raw) {
    return "请求失败。";
  }

  try {
    const parsed = JSON.parse(raw) as ApiFailureResponse;
    return parsed.message || parsed.code || raw;
  } catch {
    return raw;
  }
}

function normalizeAttachmentKind(file: File): AttachmentDraft["kind"] {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("audio/")) {
    return "audio";
  }
  if (
    file.type.includes("pdf") ||
    file.type.includes("text/") ||
    file.type.includes("word") ||
    file.type.includes("sheet") ||
    file.type.includes("excel") ||
    file.type.includes("presentation")
  ) {
    return "document";
  }
  return "other";
}

export function filesToDrafts(files: FileList | File[]): AttachmentDraft[] {
  return Array.from(files).map((file, index) => ({
    id: `${file.name}-${file.lastModified}-${index}`,
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    kind: normalizeAttachmentKind(file)
  }));
}

export async function uploadMedia(file: File, options?: { conversationId?: string; scene?: string }): Promise<AttachmentDraft> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scene", options?.scene ?? "chat");
  if (options?.conversationId) {
    formData.append("conversationId", options.conversationId);
  }

  const response = await fetch(buildApiPath("/v2/media/upload"), {
    method: "POST",
    headers: buildClientHeaders(),
    body: formData
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as MediaUploadResponse;
  return {
    id: payload.data.assetId,
    name: payload.data.fileName,
    size: payload.data.size,
    mimeType: payload.data.mimeType,
    kind: payload.data.kind
  };
}

async function readSseStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error(await readErrorMessage(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      break;
    }
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const lines = block.split(/\n/);
      let eventName = "message";
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (dataLines.length > 0) {
        const data = JSON.parse(dataLines.join("\n"));
        onEvent({
          event: eventName,
          data
        } as ChatStreamEvent);
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

export async function streamNewRun(options: {
  conversationId: string;
  message: string;
  attachments: AttachmentDraft[];
  onEvent: (event: ChatStreamEvent) => void;
  signal?: AbortSignal;
}) {
  const response = await fetch(buildApiPath("/v2/chat/send"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...buildClientHeaders()
    },
    body: JSON.stringify({
      conversationId: options.conversationId,
      message: options.message,
      attachments: options.attachments
    }),
    signal: options.signal
  });

  await readSseStream(response, options.onEvent, options.signal);
}

export async function reconnectRun(options: {
  runId: string;
  fromSeq: number;
  onEvent: (event: ChatStreamEvent) => void;
  signal?: AbortSignal;
}) {
  const response = await fetch(buildApiPath(`/v2/chat/stream/${options.runId}?fromSeq=${options.fromSeq}`), {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      ...buildClientHeaders()
    },
    signal: options.signal
  });

  await readSseStream(response, options.onEvent, options.signal);
}

export async function fetchRunState(runId: string): Promise<RunStateResponse["data"]> {
  const response = await fetch(buildApiPath(`/v2/chat/state?runId=${encodeURIComponent(runId)}`), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildClientHeaders()
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const payload = (await response.json()) as RunStateResponse;
  return payload.data;
}

export async function stopRun(runId: string): Promise<void> {
  const response = await fetch(buildApiPath("/v2/chat/stop"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildClientHeaders()
    },
    body: JSON.stringify({ runId })
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function fetchConversationHistory(options: {
  conversationId: string;
  cursor?: string;
  limit?: number;
}): Promise<HistoryResponse["data"]> {
  const url = buildApiUrl("/v2/chat/history");
  url.searchParams.set("conversationId", options.conversationId);
  if (options.cursor) {
    url.searchParams.set("cursor", options.cursor);
  }
  url.searchParams.set("limit", String(options.limit ?? 50));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildClientHeaders()
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as HistoryResponse;
  return payload.data;
}

export async function fetchConversationSummaries(options?: {
  pageNo?: number;
  pageSize?: number;
  keyword?: string;
}): Promise<ConversationSummaryPageResponse["data"]> {
  const url = buildApiUrl("/v2/chat/history/conversations");
  url.searchParams.set("pageNo", String(options?.pageNo ?? 1));
  url.searchParams.set("pageSize", String(options?.pageSize ?? 9));
  if (options?.keyword?.trim()) {
    url.searchParams.set("keyword", options.keyword.trim());
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildClientHeaders()
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as ConversationSummaryPageResponse;
  return payload.data;
}

export async function deleteConversationHistory(conversationId: string): Promise<void> {
  const response = await fetch(buildApiPath(`/v2/chat/history/conversations/${encodeURIComponent(conversationId)}`), {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...buildClientHeaders()
    }
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function sendEmailCode(email: string, locale = "zh-CN"): Promise<SendCodeResponse["data"]> {
  const response = await fetch(buildApiPath("/v2/auth/email/send-code"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildClientHeaders()
    },
    body: JSON.stringify({ email, locale })
  });
  const payload = (await response.json()) as SendCodeResponse | ApiFailureResponse;
  if (!response.ok || payload.code !== "OK") {
    throw new Error("message" in payload ? payload.message : "发送验证码失败。");
  }
  return (payload as SendCodeResponse).data;
}

export async function verifyEmailCode(email: string, code: string): Promise<VerifyCodeResponse["data"]> {
  const response = await fetch(buildApiPath("/v2/auth/email/verify"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildClientHeaders({
        "X-App-Id": getAppId()
      })
    },
    body: JSON.stringify({ email, code })
  });
  const payload = (await response.json()) as VerifyCodeResponse | ApiFailureResponse;
  if (!response.ok || payload.code !== "OK") {
    throw new Error("message" in payload ? payload.message : "验证码校验失败。");
  }
  return (payload as VerifyCodeResponse).data;
}

export async function fetchBillingAccount(): Promise<BillingAccountResponse["data"]> {
  const response = await fetch(buildApiPath("/v2/billing/account"), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildClientHeaders()
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const payload = (await response.json()) as BillingAccountResponse;
  return payload.data;
}

export async function fetchBillingPlans(): Promise<BillingPlansResponse["data"]> {
  const response = await fetch(buildApiPath("/v2/billing/plans"), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildClientHeaders()
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const payload = (await response.json()) as BillingPlansResponse;
  return payload.data;
}

export async function createAlipayOrder(
  planId: string,
  scene: "desktop" | "mobile" = "desktop"
): Promise<CreateAlipayOrderResponse["data"]> {
  const response = await fetch(buildApiPath("/v2/payments/alipay/create"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildClientHeaders()
    },
    body: JSON.stringify({
      planId,
      scene
    })
  });
  const payload = (await response.json()) as CreateAlipayOrderResponse | ApiFailureResponse;
  if (!response.ok || payload.code !== "OK") {
    throw new Error("message" in payload ? payload.message : "创建支付宝订单失败。");
  }
  return (payload as CreateAlipayOrderResponse).data;
}

export async function fetchPaymentOrder(orderNo: string, options?: { refresh?: boolean }): Promise<CreateAlipayOrderResponse["data"]> {
  const url = buildApiUrl(`/v2/payments/orders/${encodeURIComponent(orderNo)}`);
  if (options?.refresh) {
    url.searchParams.set("refresh", "true");
  }
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildClientHeaders()
    },
    cache: "no-store"
  });
  const payload = (await response.json()) as CreateAlipayOrderResponse | ApiFailureResponse;
  if (!response.ok || payload.code !== "OK") {
    throw new Error("message" in payload ? payload.message : "查询支付宝订单失败。");
  }
  return (payload as CreateAlipayOrderResponse).data;
}

export async function submitComplaintFeedback(options: {
  userId?: string;
  userEmail?: string;
  contactEmail?: string;
  conversationId?: string;
  category: ComplaintFeedbackCategory;
  content: string;
}): Promise<ComplaintFeedbackResponse["data"]> {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(options)
  });
  const payload = (await response.json().catch(() => null)) as ComplaintFeedbackResponse | ApiFailureResponse | null;
  if (!response.ok || !payload || payload.code !== "OK" || !("data" in payload) || !payload.data) {
    throw new Error(payload?.message || "投诉反馈提交失败。");
  }
  return (payload as ComplaintFeedbackResponse).data;
}

export async function requestAccountDeletion(options: {
  userId: string;
  userEmail: string;
  appId?: string;
  reason: string;
}): Promise<DeleteAccountRequestResponse["data"]> {
  const response = await fetch("/api/account/delete-request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(options)
  });
  const payload = (await response.json().catch(() => null)) as DeleteAccountRequestResponse | ApiFailureResponse | null;
  if (!response.ok || !payload || payload.code !== "OK") {
    throw new Error(payload?.message || "注销申请提交失败。");
  }
  return "data" in payload ? payload.data ?? null : null;
}

export async function fetchAuditEvents(options?: {
  userId?: string;
  appId?: string;
  pageNo?: number;
  pageSize?: number;
}): Promise<AuditEventPageResponse["data"]> {
  const url = buildApiUrl("/v2/audits/events/search");
  url.searchParams.set("appId", options?.appId ?? getAppId());
  if (options?.userId) {
    url.searchParams.set("userId", options.userId);
  }
  url.searchParams.set("pageNo", String(options?.pageNo ?? 1));
  url.searchParams.set("pageSize", String(options?.pageSize ?? 5));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildClientHeaders()
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const payload = (await response.json()) as AuditEventPageResponse;
  return payload.data;
}

export async function fetchMemoryStarMap(options?: {
  timelineRoot?: "EARLY" | "CHILDHOOD" | "STUDENT" | "WORK" | "TODAY";
  limit?: number;
  userId?: string;
  appId?: string;
}): Promise<MemoryStarMapResponse["data"]> {
  const url = buildApiUrl("/v2/memories/star-map");
  if (options?.timelineRoot) {
    url.searchParams.set("timelineRoot", options.timelineRoot);
  }
  url.searchParams.set("limit", String(options?.limit ?? 180));
  if (options?.userId) {
    url.searchParams.set("userId", options.userId);
  }
  url.searchParams.set("appId", options?.appId ?? getAppId());

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildClientHeaders()
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const payload = (await response.json()) as MemoryStarMapResponse;
  return payload.data;
}

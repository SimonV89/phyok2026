import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createFailure,
  createSuccess,
  ERROR_CODES,
  extractExternalHeaders
} from "../../packages/contracts/api";
import { getUploadedAsset } from "../media-v2/asset-store";
import {
  attachChatRunStream,
  createChatRun,
  deleteConversationHistory,
  getConversationHistoryPage,
  getConversationSummaryPage,
  getChatRunSnapshot,
  stopChatRun,
  type ChatV2Attachment
} from "./runtime";

const attachmentSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().max(200).optional(),
  size: z.number().nonnegative().max(500 * 1024 * 1024).optional(),
  kind: z.enum(["image", "audio", "document", "other"]).optional()
});

const sendBodySchema = z.object({
  conversationId: z.string().trim().optional(),
  message: z.string().trim().min(1).max(12000),
  attachments: z.array(attachmentSchema).max(12).optional()
});

const runIdQuerySchema = z.object({
  runId: z.string().trim().min(1)
});

const stopBodySchema = z.object({
  runId: z.string().trim().min(1)
});

const historyQuerySchema = z.object({
  conversationId: z.string().trim().min(1),
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const conversationListQuerySchema = z.object({
  pageNo: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
  keyword: z.string().trim().max(200).optional()
});

const conversationParamsSchema = z.object({
  conversationId: z.string().trim().min(1)
});

const streamParamsSchema = z.object({
  runId: z.string().trim().min(1)
});

const fromSeqQuerySchema = z.object({
  fromSeq: z.coerce.number().int().nonnegative().optional()
});

function normalizeAttachments(attachments: z.infer<typeof attachmentSchema>[]): ChatV2Attachment[] {
  return attachments.map((item, index) => ({
    id: item.id?.trim() || `attachment-${index + 1}`,
    name: item.name.trim(),
    mimeType: item.mimeType?.trim() || "application/octet-stream",
    size: Number(item.size ?? 0),
    kind: item.kind ?? "other"
  }));
}

function validateAttachments(attachments: ChatV2Attachment[]): { ok: true } | { ok: false; message: string } {
  for (const attachment of attachments) {
    if (!attachment.id || attachment.id.startsWith("attachment-")) {
      return {
        ok: false,
        message: `附件 ${attachment.name} 缺少有效 assetId，请重新上传后再发送。`
      };
    }
    const asset = getUploadedAsset(attachment.id);
    if (!asset) {
      return {
        ok: false,
        message: `附件 ${attachment.name} 已失效或当前节点未找到，请重新上传。`
      };
    }
  }
  return { ok: true };
}

function getStringHeader(headers: Record<string, unknown>, name: string): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

export const chatV2Routes = async (app: FastifyInstance) => {
  app.post("/send", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const origin = getStringHeader(request.headers as Record<string, unknown>, "origin");
    const parsed = sendBodySchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "Invalid chat payload.", {
          issues: parsed.error.issues
        })
      );
      return;
    }

    const attachments = normalizeAttachments(parsed.data.attachments ?? []);
    const attachmentValidation = validateAttachments(attachments);
    if (!attachmentValidation.ok) {
      await reply
        .code(400)
        .send(createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, attachmentValidation.message));
      return;
    }

    const run = createChatRun({
      authorization: externalHeaders.authorization,
      requestId: externalHeaders.requestId,
      traceId: externalHeaders.traceId,
      appId: externalHeaders.appId,
      userId: getStringHeader(request.headers, "x-user-id"),
      sessionId: getStringHeader(request.headers, "x-session-id"),
      conversationId: parsed.data.conversationId,
      message: parsed.data.message,
      attachments
    });

    reply.hijack();
    const connection = attachChatRunStream({
      runId: run.runId,
      reply: reply.raw,
      fromSeq: 0,
      headers: {
        "X-Request-Id": externalHeaders.requestId,
        "X-App-Id": externalHeaders.appId,
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {})
      }
    });

    if (!connection.found) {
      reply.raw.writeHead(404, {
        "Content-Type": "application/json; charset=utf-8",
        "X-Request-Id": externalHeaders.requestId
      });
      reply.raw.end(
        JSON.stringify(
          createFailure(externalHeaders.requestId, ERROR_CODES.BFF_RUN_NOT_FOUND, "Run not found.")
        )
      );
      return;
    }

    const closeStream = () => {
      connection.close();
    };

    // For POST + SSE, request "close" fires after the request body is consumed,
    // which is too early and would tear down the response stream immediately.
    request.raw.once("aborted", closeStream);
    reply.raw.once("close", closeStream);
  });

  app.get("/stream/:runId", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const origin = getStringHeader(request.headers as Record<string, unknown>, "origin");
    const params = streamParamsSchema.safeParse(request.params);
    const query = fromSeqQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "Invalid runId or fromSeq.")
      );
      return;
    }

    reply.hijack();
    const connection = attachChatRunStream({
      runId: params.data.runId,
      reply: reply.raw,
      fromSeq: query.data.fromSeq,
      headers: {
        "X-Request-Id": externalHeaders.requestId,
        "X-App-Id": externalHeaders.appId,
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {})
      }
    });
    if (!connection.found) {
      reply.raw.writeHead(404, {
        "Content-Type": "application/json; charset=utf-8",
        "X-Request-Id": externalHeaders.requestId
      });
      reply.raw.end(
        JSON.stringify(
          createFailure(externalHeaders.requestId, ERROR_CODES.BFF_RUN_NOT_FOUND, "Run not found.")
        )
      );
      return;
    }

    const closeStream = () => {
      connection.close();
    };

    request.raw.once("aborted", closeStream);
    reply.raw.once("close", closeStream);
  });

  app.get("/state", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const parsed = runIdQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      await reply
        .code(400)
        .send(createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "runId is required."));
      return;
    }

    const state = getChatRunSnapshot(parsed.data.runId);
    if (!state) {
      await reply
        .code(404)
        .send(createFailure(externalHeaders.requestId, ERROR_CODES.BFF_RUN_NOT_FOUND, "Run not found."));
      return;
    }

    await reply.send(createSuccess(externalHeaders.requestId, state));
  });

  app.get("/history", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const parsed = historyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "Invalid history query.", {
          issues: parsed.error.issues
        })
      );
      return;
    }

    const history = getConversationHistoryPage({
      conversationId: parsed.data.conversationId,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit ?? 20
    });

    await reply.send(
      createSuccess(externalHeaders.requestId, {
        ...history,
        limit: parsed.data.limit ?? 20
      })
    );
  });

  app.get("/history/conversations", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const parsed = conversationListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "Invalid conversation list query.", {
          issues: parsed.error.issues
        })
      );
      return;
    }

    const page = getConversationSummaryPage({
      pageNo: parsed.data.pageNo ?? 1,
      pageSize: parsed.data.pageSize ?? 9,
      keyword: parsed.data.keyword
    });

    await reply.send(createSuccess(externalHeaders.requestId, page));
  });

  app.delete("/history/conversations/:conversationId", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const parsed = conversationParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "conversationId is required.", {
          issues: parsed.error.issues
        })
      );
      return;
    }

    const result = deleteConversationHistory(parsed.data.conversationId);
    if (!result.deleted) {
      await reply
        .code(404)
        .send(createFailure(externalHeaders.requestId, ERROR_CODES.BFF_RUN_NOT_FOUND, "Conversation not found."));
      return;
    }

    await reply.send(createSuccess(externalHeaders.requestId, result));
  });

  app.post("/stop", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    const parsed = stopBodySchema.safeParse(request.body);
    if (!parsed.success) {
      await reply
        .code(400)
        .send(createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "runId is required."));
      return;
    }

    const result = stopChatRun(parsed.data.runId);
    if (!result.found) {
      await reply
        .code(404)
        .send(createFailure(externalHeaders.requestId, ERROR_CODES.BFF_RUN_NOT_FOUND, "Run not found."));
      return;
    }

    await reply.send(createSuccess(externalHeaders.requestId, result));
  });
};

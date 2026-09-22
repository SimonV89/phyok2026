import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

import {
  createFailure,
  createSuccess,
  ERROR_CODES,
  extractExternalHeaders
} from "../../packages/contracts/api";

type UploadAssetKind = "image" | "audio" | "document" | "other";

function inferAssetKind(mimeType: string): UploadAssetKind {
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
    mimeType.startsWith("text/")
  ) {
    return "document";
  }
  return "other";
}

export const mediaV2Routes = async (app: FastifyInstance) => {
  app.post("/upload", async (request, reply) => {
    const externalHeaders = extractExternalHeaders(request.headers);
    if (!request.isMultipart()) {
      await reply.code(415).send(
        createFailure(
          externalHeaders.requestId,
          ERROR_CODES.BFF_UNSUPPORTED_MEDIA_TYPE,
          "media upload requires multipart/form-data."
        )
      );
      return;
    }

    let fileName = "";
    let mimeType = "application/octet-stream";
    let size = 0;
    let scene = "chat";
    let conversationId = "";
    let fieldCount = 0;

    for await (const part of request.parts()) {
      if (part.type === "file") {
        fileName = part.filename || fileName || "upload.bin";
        mimeType = part.mimetype || mimeType;
        const buffer = await part.toBuffer();
        size += buffer.byteLength;
      } else {
        fieldCount += 1;
        const value = String(part.value || "").trim();
        if (part.fieldname === "scene" && value) {
          scene = value;
        } else if (part.fieldname === "conversationId" && value) {
          conversationId = value;
        }
      }
    }

    if (!fileName || size <= 0) {
      await reply.code(400).send(
        createFailure(externalHeaders.requestId, ERROR_CODES.BFF_BAD_REQUEST, "file is required.")
      );
      return;
    }

    const assetId = `asset_${randomUUID()}`;
    const taskId = `task_${randomUUID()}`;

    await reply.send(
      createSuccess(externalHeaders.requestId, {
        assetId,
        taskId,
        fileName,
        mimeType,
        kind: inferAssetKind(mimeType),
        size,
        scene,
        conversationId: conversationId || null,
        fieldCount,
        status: "uploaded",
        parseStatus: "queued",
        uploadedAt: Date.now()
      })
    );
  });
};

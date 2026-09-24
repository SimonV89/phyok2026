import mammoth from "mammoth";
import { pdf } from "pdf-parse";

import {
  getUploadedAsset,
  updateUploadedAsset,
  type StoredAsset
} from "./asset-store";

const DOCUMENT_TEXT_LIMIT = 12000;
const DOCUMENT_SUMMARY_LIMIT = 1800;
const documentPreparationJobs = new Map<string, Promise<StoredAsset | undefined>>();

function normalizeText(input: string): string {
  return input.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
}

function clampText(input: string, limit: number): string {
  if (input.length <= limit) {
    return input;
  }
  return `${input.slice(0, limit)}…`;
}

function isPlainTextDocument(asset: StoredAsset): boolean {
  return (
    asset.mimeType.startsWith("text/") ||
    asset.mimeType.includes("json") ||
    asset.mimeType.includes("xml") ||
    asset.mimeType.includes("javascript") ||
    asset.mimeType.includes("csv")
  );
}

function isPdf(asset: StoredAsset): boolean {
  return asset.mimeType.includes("pdf") || asset.fileName.toLowerCase().endsWith(".pdf");
}

function isDocx(asset: StoredAsset): boolean {
  const fileName = asset.fileName.toLowerCase();
  return (
    asset.mimeType.includes("wordprocessingml") ||
    asset.mimeType.includes("msword") ||
    fileName.endsWith(".docx") ||
    fileName.endsWith(".doc")
  );
}

function buildDocumentSummary(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) {
    return "";
  }
  return clampText(normalized, DOCUMENT_SUMMARY_LIMIT);
}

async function extractDocumentText(asset: StoredAsset): Promise<string> {
  if (isPlainTextDocument(asset)) {
    return asset.buffer.toString("utf-8");
  }

  if (isPdf(asset)) {
    const result = await pdf(asset.buffer);
    return result.text || "";
  }

  if (isDocx(asset)) {
    const result = await mammoth.extractRawText({ buffer: asset.buffer });
    return result.value || "";
  }

  throw new Error(`暂不支持解析该文档类型：${asset.mimeType || asset.fileName}`);
}

export async function prepareUploadedAsset(assetId: string): Promise<StoredAsset | undefined> {
  const asset = getUploadedAsset(assetId);
  if (!asset) {
    return undefined;
  }

  if (asset.kind !== "document") {
    return asset;
  }

  if (asset.parseStatus === "parsed" || asset.parseStatus === "failed") {
    return getUploadedAsset(assetId);
  }

  const existingJob = documentPreparationJobs.get(assetId);
  if (existingJob) {
    return existingJob;
  }

  updateUploadedAsset(assetId, {
    parseStatus: "parsing",
    parseError: undefined
  });

  const job = (async () => {
    try {
      const rawText = await extractDocumentText(asset);
      const normalizedText = normalizeText(rawText);
      if (!normalizedText) {
        updateUploadedAsset(assetId, {
          parseStatus: "failed",
          parseError: "文档内容为空或暂时无法提取可读文本。"
        });
        return getUploadedAsset(assetId);
      }

      updateUploadedAsset(assetId, {
        parseStatus: "parsed",
        documentText: clampText(normalizedText, DOCUMENT_TEXT_LIMIT),
        documentSummary: buildDocumentSummary(normalizedText),
        textPreview: clampText(normalizedText, Math.min(DOCUMENT_SUMMARY_LIMIT, 2400)),
        parseError: undefined
      });
    } catch (error) {
    updateUploadedAsset(assetId, {
        parseStatus: "failed",
        parseError: error instanceof Error ? error.message : "文档解析失败。"
      });
    } finally {
      documentPreparationJobs.delete(assetId);
    }

    return getUploadedAsset(assetId);
  })();

  documentPreparationJobs.set(assetId, job);
  return job;
}

export function scheduleUploadedAssetPreparation(assetId: string): void {
  void prepareUploadedAsset(assetId);
}

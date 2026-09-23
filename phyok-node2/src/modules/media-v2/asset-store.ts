import type { UploadAssetKind } from "./types";

export type AssetParseStatus = "uploaded" | "parsing" | "parsed" | "failed";

export type StoredAsset = {
  assetId: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: UploadAssetKind;
  buffer: Buffer;
  uploadedAt: number;
  parseStatus: AssetParseStatus;
  parseError?: string;
  textPreview?: string;
  documentText?: string;
  documentSummary?: string;
  transcript?: string;
  imageSummary?: string;
};

const ASSET_TTL_MS = 2 * 60 * 60 * 1000;
const uploadedAssets = new Map<string, StoredAsset>();

function pruneUploadedAssets(): void {
  const now = Date.now();
  for (const [assetId, asset] of uploadedAssets) {
    if (now - asset.uploadedAt > ASSET_TTL_MS) {
      uploadedAssets.delete(assetId);
    }
  }
}

function buildTextPreview(buffer: Buffer, mimeType: string): string | undefined {
  if (!mimeType.startsWith("text/") && !mimeType.includes("json") && !mimeType.includes("xml")) {
    return undefined;
  }
  const preview = buffer.toString("utf-8").replace(/\s+/g, " ").trim();
  if (!preview) {
    return undefined;
  }
  return preview.slice(0, 2400);
}

export function saveUploadedAsset(input: {
  assetId: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: UploadAssetKind;
  buffer: Buffer;
}): StoredAsset {
  pruneUploadedAssets();
  const asset: StoredAsset = {
    assetId: input.assetId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.size,
    kind: input.kind,
    buffer: input.buffer,
    uploadedAt: Date.now(),
    parseStatus: input.kind === "document" ? "uploaded" : "parsed",
    textPreview: buildTextPreview(input.buffer, input.mimeType)
  };
  uploadedAssets.set(asset.assetId, asset);
  return asset;
}

export function getUploadedAsset(assetId: string): StoredAsset | undefined {
  pruneUploadedAssets();
  return uploadedAssets.get(assetId);
}

export function updateUploadedAsset(assetId: string, patch: Partial<StoredAsset>): void {
  const asset = uploadedAssets.get(assetId);
  if (!asset) {
    return;
  }
  uploadedAssets.set(assetId, {
    ...asset,
    ...patch
  });
}

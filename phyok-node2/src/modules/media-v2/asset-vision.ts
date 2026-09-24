import { describeImageWithSiliconFlow } from "../../packages/ai/siliconflow";
import { getUploadedAsset, updateUploadedAsset } from "./asset-store";

const imageSummaryJobs = new Map<string, Promise<void>>();

export async function prepareUploadedImageSummary(assetId: string): Promise<void> {
  const asset = getUploadedAsset(assetId);
  if (!asset || asset.kind !== "image" || asset.imageSummary) {
    return;
  }

  const existingJob = imageSummaryJobs.get(assetId);
  if (existingJob) {
    return existingJob;
  }

  const job = (async () => {
    try {
      const summary = await describeImageWithSiliconFlow({
        buffer: asset.buffer,
        mimeType: asset.mimeType,
        prompt: "请用简洁中文提取图片中的主体、场景、关系、情绪和可用于对话的关键信息，控制在 120 字以内。",
        timeoutMs: 12000
      });
      if (summary) {
        updateUploadedAsset(assetId, { imageSummary: summary });
      }
    } catch {
      // Ignore background warmup failures. The final multimodal answer still uses the raw image.
    } finally {
      imageSummaryJobs.delete(assetId);
    }
  })();

  imageSummaryJobs.set(assetId, job);
  return job;
}

export function scheduleUploadedImageSummary(assetId: string): void {
  void prepareUploadedImageSummary(assetId);
}

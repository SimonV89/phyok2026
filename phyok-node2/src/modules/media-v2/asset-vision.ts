import { env } from "../../config/env";
import { describeImageWithSiliconFlow } from "../../packages/ai/siliconflow";
import { getUploadedAsset, updateUploadedAsset } from "./asset-store";
import { signImageReadUrl } from "./image-object-store";

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
      if (!asset.objectKey) {
        throw new Error("图片尚未保存到对象存储。");
      }
      const summary = await describeImageWithSiliconFlow({
        imageUrl: signImageReadUrl(asset.objectKey),
        prompt: "请用中文客观描述画面，优先识别可见文字、人物与物体、动作、场景和相互关系；区分确定信息与不确定推测，不要臆测情绪或经历。保留与后续对话有关的具体细节，控制在 400 字以内。",
        timeoutMs: env.siliconFlowVisionTimeoutMs
      });
      if (!summary) {
        throw new Error("视觉理解模型没有返回图片内容。");
      }
      updateUploadedAsset(assetId, { imageSummary: summary });
    } catch {
      throw new Error("图片理解失败，请稍后重试。");
    }
  })();

  imageSummaryJobs.set(assetId, job);
  void job.then(
    () => imageSummaryJobs.delete(assetId),
    () => imageSummaryJobs.delete(assetId)
  );
  return job;
}

export function scheduleUploadedImageSummary(assetId: string): void {
  void prepareUploadedImageSummary(assetId).catch(() => {
    // 前台发送时会重试，仍失败则明确提示用户。
  });
}

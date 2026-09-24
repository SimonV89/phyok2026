import COS from "cos-nodejs-sdk-v5";

import { env } from "../../config/env";

let client: COS | undefined;

function getClient(): COS {
  if (!env.tencentCosSecretId || !env.tencentCosSecretKey || !env.tencentCosBucket || !env.tencentCosRegion) {
    throw new Error("图片存储未配置完整，请联系管理员。");
  }
  client ??= new COS({
    SecretId: env.tencentCosSecretId,
    SecretKey: env.tencentCosSecretKey
  });
  return client;
}

export async function uploadImageObject(assetId: string, body: Buffer, mimeType: string): Promise<string> {
  const extension = ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  } as Record<string, string>)[mimeType];
  if (!extension) {
    throw new Error("仅支持 JPG、PNG、WebP 或 GIF 图片。");
  }
  const key = [env.tencentCosPathPrefix, "chat-images", `${assetId}.${extension}`].filter(Boolean).join("/");
  await getClient().putObject({
    Bucket: env.tencentCosBucket,
    Region: env.tencentCosRegion,
    Key: key,
    Body: body,
    ContentLength: body.byteLength,
    ContentType: mimeType,
    ACL: "private"
  });
  return key;
}

export function signImageReadUrl(key: string): string {
  const url = getClient().getObjectUrl({
    Bucket: env.tencentCosBucket,
    Region: env.tencentCosRegion,
    Key: key,
    Sign: true,
    Method: "GET",
    Expires: 20 * 60,
    Protocol: "https:"
  });
  if (!url.startsWith("https://") || !new URL(url).searchParams.has("q-signature")) {
    throw new Error("无法生成图片的安全访问地址。");
  }
  return url;
}

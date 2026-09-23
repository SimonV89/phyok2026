import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

function loadEnvFiles() {
  const cwd = process.cwd();
  const runtimeMode = (process.env.NODE_ENV || "development").trim().toLowerCase();
  const modeAliases = new Set<string>([runtimeMode]);

  if (runtimeMode === "development" || runtimeMode === "dev" || runtimeMode === "local") {
    modeAliases.add("development");
    modeAliases.add("dev");
    modeAliases.add("local");
  }
  if (runtimeMode === "production" || runtimeMode === "prod") {
    modeAliases.add("production");
    modeAliases.add("prod");
  }

  const baseCandidates = [
    path.resolve(cwd, "../env2"),
    path.resolve(cwd, "env2"),
    path.resolve(cwd, ".env")
  ];
  const modeCandidates = [...modeAliases].flatMap((mode) => [
    path.resolve(cwd, `../env2.${mode}`),
    path.resolve(cwd, `env2.${mode}`),
    path.resolve(cwd, `.env.${mode}`)
  ]);

  for (const file of baseCandidates) {
    if (!fs.existsSync(file)) {
      continue;
    }
    dotenv.config({ path: file, override: false });
  }

  for (const file of modeCandidates) {
    if (!fs.existsSync(file)) {
      continue;
    }
    dotenv.config({ path: file, override: true });
  }
}

loadEnvFiles();

function readInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function readBoolean(raw: string | undefined, fallback = false): boolean {
  if (raw == null || raw === "") {
    return fallback;
  }
  return raw === "true" || raw === "1";
}

function trimTrailingSlash(raw: string | undefined, fallback: string): string {
  const value = (raw || fallback).trim();
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeModelName(
  raw: string | undefined,
  fallback: string,
  aliases?: Record<string, string>
): string {
  const value = (raw || fallback).trim();
  if (!value) {
    return fallback;
  }
  return aliases?.[value] ?? value;
}

const CHAT_MODEL_ALIASES: Record<string, string> = {
  "deepseek-ai/DeepSeek-V4": "deepseek-ai/DeepSeek-V4-Pro",
  "Pro/deepseek-ai/DeepSeek-V4": "deepseek-ai/DeepSeek-V4-Pro"
};

const VISION_MODEL_ALIASES: Record<string, string> = {
  "Qwen/Qwen3.5-397B-A17B": "Qwen/Qwen3-VL-8B-Instruct"
};

const ASR_MODEL_ALIASES: Record<string, string> = {
  "TeleAI/TeleSpeechASR": "Qwen/Qwen3-ASR-1.7B"
};

export const env = {
  port: readInt(process.env.PORT, 3002),
  clientBaseUrl: process.env.CLIENT_BASE_URL ?? "http://127.0.0.1:3001",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://127.0.0.1:3002",
  chatHistoryStoreFile:
    process.env.CHAT_HISTORY_STORE_FILE?.trim() || path.resolve(process.cwd(), "data/chat-v2-history.json"),
  chatHistoryRetentionDays: readInt(process.env.CHAT_HISTORY_RETENTION_DAYS, 90),
  domainClientMode: process.env.DOMAIN_CLIENT_MODE === "mock" ? "mock" : "http",
  localDebugAllowDegraded: readBoolean(process.env.LOCAL_DEBUG_ALLOW_DEGRADED),
  devSeedLoginEnabled: readBoolean(process.env.ENABLE_DEV_SEED_LOGIN),
  devSeedEmailPattern: process.env.AUTH_SEED_EMAIL_PATTERN?.trim() || "",
  devSeedEmailCode: process.env.AUTH_SEED_EMAIL_CODE?.trim() || "",
  devDefaultAuthCode: process.env.AUTH_LOCAL_DEBUG_CODE?.trim() || "",
  localDebugIdentityEmail: process.env.LOCAL_DEBUG_IDENTITY_EMAIL?.trim().toLowerCase() || "local-debug@phyok.dev",
  javaDomainBaseUrl: process.env.JAVA_DOMAIN_BASE_URL ?? "http://127.0.0.1:8080",
  javaAuthBaseUrl: process.env.JAVA_AUTH_BASE_URL ?? "http://127.0.0.1:18081",
  javaBillingBaseUrl: process.env.JAVA_BILLING_BASE_URL ?? "http://127.0.0.1:18085",
  javaPaymentBaseUrl: process.env.JAVA_PAYMENT_BASE_URL ?? "http://127.0.0.1:18086",
  javaAuditBaseUrl: process.env.JAVA_AUDIT_BASE_URL ?? "http://127.0.0.1:18087",
  memoryTransport: process.env.MEMORY_TRANSPORT === "grpc" ? "grpc" : "http",
  siliconFlowApiKey: process.env.SILICONFLOW_API_KEY ?? "",
  siliconFlowBaseUrl: trimTrailingSlash(process.env.SILICONFLOW_BASE_URL, "https://api.siliconflow.cn/v1"),
  siliconFlowChatModel: normalizeModelName(
    process.env.SILICONFLOW_CHAT_MODEL,
    "deepseek-ai/DeepSeek-V4-Pro",
    CHAT_MODEL_ALIASES
  ),
  siliconFlowIngestModel: normalizeModelName(
    process.env.SILICONFLOW_INGEST_MODEL ?? process.env.SILICONFLOW_CHAT_MODEL,
    "deepseek-ai/DeepSeek-V4-Pro",
    CHAT_MODEL_ALIASES
  ),
  siliconFlowConcludeModel: normalizeModelName(
    process.env.SILICONFLOW_CONCLUDE_MODEL ?? process.env.SILICONFLOW_CHAT_MODEL,
    "deepseek-ai/DeepSeek-V4-Pro",
    CHAT_MODEL_ALIASES
  ),
  siliconFlowSkillsModel: normalizeModelName(
    process.env.SILICONFLOW_SKILLS_MODEL ?? process.env.SILICONFLOW_CHAT_MODEL,
    "deepseek-ai/DeepSeek-V4-Pro",
    CHAT_MODEL_ALIASES
  ),
  siliconFlowAsrModel: normalizeModelName(
    process.env.SILICONFLOW_ASR_MODEL,
    "Qwen/Qwen3-ASR-1.7B",
    ASR_MODEL_ALIASES
  ),
  siliconFlowEmbeddingModel: process.env.SILICONFLOW_EMBEDDING_MODEL ?? "BAAI/bge-m3",
  siliconFlowVisionFastModel: normalizeModelName(
    process.env.SILICONFLOW_VISION_FAST_MODEL ?? process.env.SILICONFLOW_VISION_FALLBACK_MODEL,
    "Qwen/Qwen3-VL-8B-Instruct",
    VISION_MODEL_ALIASES
  ),
  siliconFlowVisionFallbackModel: normalizeModelName(
    process.env.SILICONFLOW_VISION_FALLBACK_MODEL ?? process.env.SILICONFLOW_VISION_FAST_MODEL,
    "Qwen/Qwen3-VL-32B-Instruct",
    VISION_MODEL_ALIASES
  ),
  siliconFlowVisionTimeoutMs: readInt(process.env.SILICONFLOW_VISION_TIMEOUT_MS, 45000)
};

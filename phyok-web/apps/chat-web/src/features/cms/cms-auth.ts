import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const CMS_SESSION_COOKIE = "phyok-cms-session";
const CMS_SESSION_TTL_SECONDS = 60 * 60 * 12;
let cachedRootEnv2Config: { username: string; password: string; secret: string } | null | undefined;

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvFile(raw: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim());
    if (key) {
      result.set(key, value);
    }
  }
  return result;
}

function readRootEnv2Config(): { username: string; password: string; secret: string } | null {
  if (cachedRootEnv2Config !== undefined) {
    return cachedRootEnv2Config;
  }

  const candidates: string[] = [];
  let currentDir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    candidates.push(path.join(currentDir, "env2"));
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    try {
      const parsed = parseEnvFile(readFileSync(candidate, "utf8"));
      const username = parsed.get("CMS_ADMIN_USERNAME")?.trim() || "";
      const password = parsed.get("CMS_ADMIN_PASSWORD")?.trim() || "";
      const secret = (parsed.get("CMS_AUTH_SECRET")?.trim() || password).trim();
      cachedRootEnv2Config = username && password && secret ? { username, password, secret } : null;
      return cachedRootEnv2Config;
    } catch {
      cachedRootEnv2Config = null;
      return cachedRootEnv2Config;
    }
  }

  cachedRootEnv2Config = null;
  return cachedRootEnv2Config;
}

function readCmsConfig() {
  const fallback = readRootEnv2Config();
  const username = process.env.CMS_ADMIN_USERNAME?.trim() || fallback?.username || "";
  const password = process.env.CMS_ADMIN_PASSWORD?.trim() || fallback?.password || "";
  const secret = process.env.CMS_AUTH_SECRET?.trim() || fallback?.secret || password;
  return {
    username,
    password,
    secret,
    configured: username.length > 0 && password.length > 0 && secret.length > 0
  };
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export type CmsSession = {
  username: string;
  expiresAt: number;
};

export function isCmsAuthConfigured(): boolean {
  return readCmsConfig().configured;
}

export function getCmsSessionCookieName(): string {
  return CMS_SESSION_COOKIE;
}

export function verifyCmsCredentials(username: string, password: string): boolean {
  const config = readCmsConfig();
  if (!config.configured) {
    return false;
  }
  return safeEqual(username.trim(), config.username) && safeEqual(password.trim(), config.password);
}

export function createCmsSessionToken(username: string): { token: string; expiresAt: number } {
  const config = readCmsConfig();
  const expiresAt = Date.now() + CMS_SESSION_TTL_SECONDS * 1000;
  const payload = `${username.trim()}\t${expiresAt}`;
  const signature = sign(payload, config.secret);
  return {
    token: toBase64Url(`${payload}\t${signature}`),
    expiresAt
  };
}

export function readCmsSessionFromToken(rawToken: string | undefined): CmsSession | null {
  if (!rawToken) {
    return null;
  }
  const config = readCmsConfig();
  if (!config.configured) {
    return null;
  }
  const decoded = fromBase64Url(rawToken);
  if (!decoded) {
    return null;
  }
  const [username, expiresAtRaw, signature] = decoded.split("\t");
  if (!username || !expiresAtRaw || !signature) {
    return null;
  }
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }
  if (!safeEqual(username, config.username)) {
    return null;
  }
  const expectedSignature = sign(`${username}\t${expiresAt}`, config.secret);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }
  return {
    username,
    expiresAt
  };
}

export function createCmsCookieOptions(expiresAt: number) {
  return {
    name: CMS_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/cms",
    expires: new Date(expiresAt)
  };
}

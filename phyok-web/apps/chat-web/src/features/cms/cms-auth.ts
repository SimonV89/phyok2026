import { createHmac, timingSafeEqual } from "node:crypto";

const CMS_SESSION_COOKIE = "phyok-cms-session";
const CMS_SESSION_TTL_SECONDS = 60 * 60 * 12;

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

function readCmsConfig() {
  const username = process.env.CMS_ADMIN_USERNAME?.trim() || "";
  const password = process.env.CMS_ADMIN_PASSWORD?.trim() || "";
  const secret = process.env.CMS_AUTH_SECRET?.trim() || password;
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

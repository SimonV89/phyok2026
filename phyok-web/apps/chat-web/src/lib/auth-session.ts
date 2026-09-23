"use client";

export type AuthSession = {
  email: string;
  sessionToken: string;
  refreshToken?: string;
  expiresAt: string;
  userId?: string;
  sessionId?: string;
};

const AUTH_SESSION_KEY = "phyok-auth-session";
const DEVICE_ID_KEY = "phyok-device-id";
const APP_ID = "phyok-chat-web";
const CLIENT_VERSION = "chat-web-0.1.0";

export function getAppId(): string {
  return APP_ID;
}

export function getClientVersion(): string {
  return CLIENT_VERSION;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-device";
  }
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const next =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `device-${Date.now()}`;
  window.localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.sessionToken || !parsed.expiresAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}

export function buildClientHeaders(extra?: Record<string, string>): HeadersInit {
  const session = getAuthSession();
  return {
    "X-App-Id": getAppId(),
    "X-Client-Version": getClientVersion(),
    "X-Device-Id": getDeviceId(),
    ...(session?.sessionToken ? { Authorization: `Bearer ${session.sessionToken}` } : {}),
    ...(session?.userId ? { "X-User-Id": session.userId } : {}),
    ...(session?.sessionId ? { "X-Session-Id": session.sessionId } : {}),
    ...(session?.email ? { "X-User-Email": session.email } : {}),
    ...(extra ?? {})
  };
}

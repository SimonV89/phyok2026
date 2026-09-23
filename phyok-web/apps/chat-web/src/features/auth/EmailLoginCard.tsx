"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { saveAuthSession, type AuthSession } from "@/lib/auth-session";
import { sendEmailCode, verifyEmailCode } from "@/lib/chat-api";

type EmailLoginCardProps = {
  mode?: "page" | "modal";
  onSuccess?: (session: AuthSession) => void;
  onCancel?: () => void;
};

const LOGIN_TIMER_STORAGE_KEY = "phyok.email-login.timer";
const DEFAULT_CODE_EXPIRES_SEC = 600;
const DEFAULT_RESEND_COOLDOWN_SEC = 60;

type StoredLoginTimer = {
  email: string;
  resendAvailableAt: number | null;
  codeExpiresAt: number | null;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function readStoredLoginTimer(): StoredLoginTimer | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOGIN_TIMER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredLoginTimer>;
    if (!parsed.email || typeof parsed.email !== "string") {
      return null;
    }
    return {
      email: parsed.email,
      resendAvailableAt: typeof parsed.resendAvailableAt === "number" ? parsed.resendAvailableAt : null,
      codeExpiresAt: typeof parsed.codeExpiresAt === "number" ? parsed.codeExpiresAt : null
    };
  } catch {
    return null;
  }
}

function writeStoredLoginTimer(value: StoredLoginTimer | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!value || (!value.resendAvailableAt && !value.codeExpiresAt)) {
    window.localStorage.removeItem(LOGIN_TIMER_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(LOGIN_TIMER_STORAGE_KEY, JSON.stringify(value));
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds} 秒`;
  }
  return `${minutes} 分 ${seconds.toString().padStart(2, "0")} 秒`;
}

export function EmailLoginCard({ mode = "page", onSuccess, onCancel }: EmailLoginCardProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [hint, setHint] = useState("输入邮箱后发送验证码，即可完成登录。");
  const [timerEmail, setTimerEmail] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const submitDisabled = useMemo(() => !email.trim() || !code.trim() || verifying, [email, code, verifying]);
  const isModal = mode === "modal";
  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const isActiveTimerEmail = normalizedEmail.length > 0 && normalizedEmail === timerEmail;
  const resendRemainingSec = useMemo(() => {
    if (!isActiveTimerEmail || !resendAvailableAt) {
      return 0;
    }
    return Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  }, [isActiveTimerEmail, resendAvailableAt, now]);
  const codeExpiresRemainingSec = useMemo(() => {
    if (!isActiveTimerEmail || !codeExpiresAt) {
      return 0;
    }
    return Math.max(0, Math.ceil((codeExpiresAt - now) / 1000));
  }, [isActiveTimerEmail, codeExpiresAt, now]);

  useEffect(() => {
    const stored = readStoredLoginTimer();
    if (!stored) {
      return;
    }
    setTimerEmail(stored.email);
    setResendAvailableAt(stored.resendAvailableAt);
    setCodeExpiresAt(stored.codeExpiresAt);
  }, []);

  useEffect(() => {
    if (!resendAvailableAt && !codeExpiresAt) {
      return;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt, codeExpiresAt]);

  useEffect(() => {
    if (resendAvailableAt && resendAvailableAt <= now) {
      setResendAvailableAt(null);
    }
    if (codeExpiresAt && codeExpiresAt <= now) {
      setCodeExpiresAt(null);
    }
  }, [codeExpiresAt, now, resendAvailableAt]);

  useEffect(() => {
    if (!timerEmail) {
      writeStoredLoginTimer(null);
      return;
    }
    writeStoredLoginTimer({
      email: timerEmail,
      resendAvailableAt,
      codeExpiresAt
    });
  }, [codeExpiresAt, resendAvailableAt, timerEmail]);

  const handleSendCode = async () => {
    const nextEmail = normalizeEmail(email);
    if (!nextEmail) {
      setHint("请先输入邮箱地址。");
      return;
    }
    if (resendRemainingSec > 0) {
      setHint(`请稍候，${formatCountdown(resendRemainingSec)}后再重新发送。`);
      return;
    }

    try {
      setSending(true);
      const result = await sendEmailCode(nextEmail);
      const nextResendSec = result.retryAfterSec ?? DEFAULT_RESEND_COOLDOWN_SEC;
      setTimerEmail(nextEmail);
      setNow(Date.now());
      setResendAvailableAt(Date.now() + nextResendSec * 1000);
      if (result.accepted) {
        setCodeExpiresAt(Date.now() + (result.expiresInSec ?? DEFAULT_CODE_EXPIRES_SEC) * 1000);
        setHint("验证码已发送，请留意邮箱。");
      } else {
        setHint(`发送过于频繁，请 ${formatCountdown(nextResendSec)}后再试。`);
      }
    } catch (error) {
      setHint(error instanceof Error ? error.message : "验证码发送失败。");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (submitDisabled) {
      return;
    }

    try {
      setVerifying(true);
      const result = await verifyEmailCode(normalizedEmail, code.trim());
      const session: AuthSession = {
        email: normalizedEmail,
        sessionToken: result.sessionToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
        userId: result.principal.userId,
        sessionId: result.principal.sessionId
      };
      saveAuthSession(session);
      setHint(result.newUser ? "欢迎来到心理学空间，你已经完成首次登录。" : "登录成功，正在进入你的个人空间。");
      onSuccess?.(session);
    } catch (error) {
      setHint(error instanceof Error ? error.message : "登录失败。");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <section className={`login-card ${isModal ? "login-card-modal" : ""}`}>
      <div className="hero-kicker">账号登录</div>
      <h1>邮箱验证码登录</h1>
      <p>输入常用邮箱，收取验证码后即可继续对话、查看额度与完成支付。</p>
      <div className="login-form">
        <label className="login-label" htmlFor={isModal ? "auth-dialog-email" : "email"}>
          邮箱
        </label>
        <input
          id={isModal ? "auth-dialog-email" : "email"}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }
              event.preventDefault();
              if (code.trim()) {
                void handleVerify();
                return;
              }
              void handleSendCode();
            }}
          placeholder="you@example.com"
        />

        <label className="login-label" htmlFor={isModal ? "auth-dialog-code" : "code"}>
          验证码
        </label>
        <div className="login-inline">
          <input
            id={isModal ? "auth-dialog-code" : "code"}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }
              event.preventDefault();
              void handleVerify();
            }}
            placeholder="6 位验证码"
          />
          <button
            type="button"
            className="toolbar-login"
            onClick={() => void handleSendCode()}
            disabled={sending || resendRemainingSec > 0}
          >
            {sending ? "发送中" : resendRemainingSec > 0 ? `${resendRemainingSec}s 后重发` : "发送验证码"}
          </button>
        </div>

        <div className="login-hint">{hint}</div>
        {codeExpiresRemainingSec > 0 ? (
          <div className="login-countdown">验证码将在 {formatCountdown(codeExpiresRemainingSec)} 后失效</div>
        ) : null}

        <div className="login-actions">
          <button type="button" className="send-button" onClick={() => void handleVerify()} disabled={submitDisabled}>
            {verifying ? "登录中" : "完成登录"}
          </button>
          {isModal ? (
            <button type="button" className="toolbar-login" onClick={onCancel}>
              稍后再说
            </button>
          ) : (
            <Link href="/" className="toolbar-login">
              返回聊天
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

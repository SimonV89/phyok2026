"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { saveAuthSession } from "@/lib/auth-session";
import { sendEmailCode, verifyEmailCode } from "@/lib/chat-api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [hint, setHint] = useState("输入邮箱后先发送验证码，再完成登录。");

  const submitDisabled = useMemo(() => !email.trim() || !code.trim() || verifying, [email, code, verifying]);

  const handleSendCode = async () => {
    if (!email.trim()) {
      setHint("请先输入邮箱地址。");
      return;
    }
    try {
      setSending(true);
      const result = await sendEmailCode(email.trim());
      setHint(
        result.accepted
          ? `验证码已发送，约 ${result.expiresInSec ?? 600} 秒内有效。`
          : `发送频率较快，请 ${result.retryAfterSec ?? 60} 秒后重试。`
      );
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
      const result = await verifyEmailCode(email.trim(), code.trim());
      saveAuthSession({
        email: email.trim(),
        sessionToken: result.sessionToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
        userId: result.principal.userId,
        sessionId: result.principal.sessionId
      });
      router.push("/");
      router.refresh();
    } catch (error) {
      setHint(error instanceof Error ? error.message : "登录失败。");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="hero-kicker">Email Login</div>
        <h1>邮箱验证码登录</h1>
        <p>登录会通过 `phyok-node2` BFF 转发到 `phyok-java auth-service`，验证码邮件由腾讯云 SES 模板发送。</p>

        <div className="login-form">
          <label className="login-label" htmlFor="email">
            邮箱
          </label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />

          <label className="login-label" htmlFor="code">
            验证码
          </label>
          <div className="login-inline">
            <input id="code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="6 位验证码" />
            <button type="button" className="toolbar-login" onClick={() => void handleSendCode()} disabled={sending}>
              {sending ? "发送中" : "发送验证码"}
            </button>
          </div>

          <div className="login-hint">{hint}</div>

          <div className="login-actions">
            <button type="button" className="send-button" onClick={() => void handleVerify()} disabled={submitDisabled}>
              {verifying ? "登录中" : "完成登录"}
            </button>
            <Link href="/" className="toolbar-login">
              返回聊天
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

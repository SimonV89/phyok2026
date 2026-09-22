"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchAuditEvents,
  fetchBillingAccount,
  fetchConversationHistory,
  fetchRunState,
  filesToDrafts,
  reconnectRun,
  stopRun,
  streamNewRun,
  uploadMedia,
  type ChatStreamEvent
} from "@/lib/chat-api";
import { getAuthSession, type AuthSession } from "@/lib/auth-session";
import {
  type AttachmentDraft,
  addAttachments,
  appendAssistantDelta,
  appendThinkingDelta,
  appendUserMessage,
  clearComposer,
  completeRun,
  failRun,
  hydrateRunState,
  replaceConversationMessages,
  removeAttachment,
  setAssistantActions,
  setComposerText,
  startAssistantRun,
  stopRunLocally,
  updateLastSeq
} from "@/store/chat-slice";
import { useAppDispatch, useAppSelector } from "@/store/index";

const ACTIVE_RUN_STORAGE_KEY = "phyok-chat-active-run";
const LAST_CONVERSATION_STORAGE_KEY = "phyok-chat-last-conversation";
const CLOUD_LABELS = [
  "轻放一段最近的情绪波纹",
  "从原生家庭里辨认旧回声",
  "把关系中的不安说得更具体",
  "沿着身体感受靠近线索",
  "试着为反复自责找根因",
  "用一个心理学流派照亮当下",
  "把模糊困扰整理成可探索的问题"
] as const;

type AtmosphereCloud = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  vx: number;
  vy: number;
  spin: number;
  phase: number;
  bobAmplitude: number;
  bobSpeed: number;
};

function createConversationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `conv-${Date.now()}`;
}

function isNearBottom(element: HTMLDivElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

function mapBackendStatus(status: string) {
  if (status === "completed") {
    return "completed" as const;
  }
  if (status === "failed") {
    return "failed" as const;
  }
  if (status === "stopped") {
    return "stopped" as const;
  }
  return "reconnecting" as const;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createClouds(bounds: { width: number; height: number }, reduceMotion: boolean): AtmosphereCloud[] {
  const lanes = ["top", "right", "bottom", "left"] as const;

  return CLOUD_LABELS.map((label, index) => {
    const width = Math.min(bounds.width * 0.42, randomBetween(138, 196));
    const height = randomBetween(34, 42);
    const lane = lanes[index % lanes.length];

    let x = 0;
    let y = 0;

    if (lane === "top") {
      x = randomBetween(14, Math.max(18, bounds.width - width - 14));
      y = randomBetween(0, 24);
    } else if (lane === "bottom") {
      x = randomBetween(14, Math.max(18, bounds.width - width - 14));
      y = randomBetween(Math.max(46, bounds.height - height - 30), Math.max(48, bounds.height - height - 8));
    } else if (lane === "left") {
      x = randomBetween(0, 18);
      y = randomBetween(56, Math.max(60, bounds.height - height - 56));
    } else {
      x = randomBetween(Math.max(24, bounds.width - width - 18), Math.max(26, bounds.width - width));
      y = randomBetween(56, Math.max(60, bounds.height - height - 56));
    }

    return {
      id: `cloud-${index}-${Math.round(Math.random() * 10_000)}`,
      label,
      x,
      y,
      width,
      height,
      angle: randomBetween(-10, 10),
      vx: reduceMotion ? 0 : randomBetween(-0.22, 0.22),
      vy: reduceMotion ? 0 : randomBetween(-0.16, 0.16),
      spin: reduceMotion ? 0 : randomBetween(-0.03, 0.03),
      phase: randomBetween(0, Math.PI * 2),
      bobAmplitude: reduceMotion ? 0 : randomBetween(1.4, 4.8),
      bobSpeed: reduceMotion ? 0 : randomBetween(0.008, 0.02)
    };
  });
}

function animateClouds(clouds: AtmosphereCloud[], bounds: { width: number; height: number }, dt: number): AtmosphereCloud[] {
  const next = clouds.map((cloud) => {
    const updated = {
      ...cloud,
      x: cloud.x + cloud.vx * dt,
      y: cloud.y + cloud.vy * dt,
      angle: cloud.angle + cloud.spin * dt,
      phase: cloud.phase + cloud.bobSpeed * dt
    };

    if (updated.x <= 0 || updated.x + updated.width >= bounds.width) {
      updated.vx *= -0.92;
      updated.x = Math.max(0, Math.min(updated.x, bounds.width - updated.width));
    }
    if (updated.y <= 0 || updated.y + updated.height >= bounds.height) {
      updated.vy *= -0.92;
      updated.y = Math.max(0, Math.min(updated.y, bounds.height - updated.height));
    }
    return updated;
  });

  for (let index = 0; index < next.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < next.length; otherIndex += 1) {
      const left = next[index];
      const right = next[otherIndex];
      const centerX = left.x + left.width / 2;
      const centerY = left.y + left.height / 2;
      const otherCenterX = right.x + right.width / 2;
      const otherCenterY = right.y + right.height / 2;
      const dx = otherCenterX - centerX;
      const dy = otherCenterY - centerY;
      const minDistance = (left.width + right.width) * 0.36;
      const distance = Math.hypot(dx, dy) || 0.001;

      if (distance < minDistance) {
        const overlap = (minDistance - distance) / 2;
        const normalX = dx / distance;
        const normalY = dy / distance;

        left.x -= normalX * overlap;
        left.y -= normalY * overlap;
        right.x += normalX * overlap;
        right.y += normalY * overlap;

        left.vx = (left.vx - normalX * 0.16) * 0.92;
        left.vy = (left.vy - normalY * 0.14) * 0.92;
        right.vx = (right.vx + normalX * 0.16) * 0.92;
        right.vy = (right.vy + normalY * 0.14) * 0.92;
      }
    }
  }

  return next;
}

export function ChatShell() {
  const dispatch = useAppDispatch();
  const chat = useAppSelector((state) => state.chat);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const atmosphereRef = useRef<HTMLDivElement | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [followLatest, setFollowLatest] = useState(true);
  const [recovering, setRecovering] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [billingSummary, setBillingSummary] = useState<{
    plan: string;
    remainingTokens: number;
    quotaState: string;
  } | null>(null);
  const [auditEvents, setAuditEvents] = useState<
    Array<{
      id: string;
      eventType: string;
      createdAt: string;
      sourceService: string;
    }>
  >([]);
  const [clouds, setClouds] = useState<AtmosphereCloud[]>([]);

  const composerDisabled = useMemo(() => {
    return chat.stream.status === "streaming" || chat.stream.status === "reconnecting" || uploading;
  }, [chat.stream.status, uploading]);

  const persistActiveRun = useCallback((runId: string, conversationId: string) => {
    localStorage.setItem(
      ACTIVE_RUN_STORAGE_KEY,
      JSON.stringify({
        runId,
        conversationId
      })
    );
  }, []);

  const clearActiveRun = useCallback(() => {
    localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY);
  }, []);

  const persistConversationId = useCallback((conversationId: string) => {
    localStorage.setItem(LAST_CONVERSATION_STORAGE_KEY, conversationId);
  }, []);

  const removePendingFiles = useCallback((attachmentIds: string[]) => {
    for (const attachmentId of attachmentIds) {
      pendingFilesRef.current.delete(attachmentId);
    }
  }, []);

  const handleEvent = useCallback(
    (event: ChatStreamEvent) => {
      if ("seq" in event.data && typeof event.data.seq === "number") {
        dispatch(updateLastSeq(event.data.seq));
      }

      switch (event.event) {
        case "message.started":
          dispatch(
            startAssistantRun({
              runId: event.data.runId,
              conversationId: event.data.conversationId,
              assistantMessageId: `assistant-${event.data.runId}`,
              status: "streaming"
            })
          );
          persistActiveRun(event.data.runId, event.data.conversationId);
          break;
        case "thinking.delta":
          dispatch(appendThinkingDelta(event.data.delta));
          break;
        case "message.delta":
          dispatch(appendAssistantDelta(event.data.delta));
          break;
        case "interaction.required":
          dispatch(setAssistantActions(event.data.actions));
          break;
        case "warning.raised":
          dispatch(failRun(event.data.message));
          clearActiveRun();
          break;
        case "stream.failed":
          dispatch(failRun(event.data.message));
          clearActiveRun();
          break;
        case "stream.completed":
          if (event.data.status === "stopped") {
            dispatch(stopRunLocally());
          } else {
            dispatch(completeRun());
          }
          clearActiveRun();
          break;
        default:
          break;
      }
    },
    [clearActiveRun, dispatch, persistActiveRun]
  );

  const attachFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) {
        return;
      }
      const files = Array.from(fileList);
      const drafts = filesToDrafts(files);
      drafts.forEach((draft, index) => {
        pendingFilesRef.current.set(draft.id, files[index]);
      });
      dispatch(addAttachments(drafts));
    },
    [dispatch]
  );

  const removeAttachmentDraft = useCallback(
    (attachmentId: string) => {
      pendingFilesRef.current.delete(attachmentId);
      dispatch(removeAttachment(attachmentId));
    },
    [dispatch]
  );

  const stopStreaming = useCallback(async () => {
    const runId = chat.stream.runId;
    if (!runId) {
      return;
    }
    try {
      streamAbortRef.current?.abort();
      await stopRun(runId);
      dispatch(stopRunLocally());
    } catch (error) {
      dispatch(failRun(error instanceof Error ? error.message : "停止失败。"));
    } finally {
      clearActiveRun();
    }
  }, [chat.stream.runId, clearActiveRun, dispatch]);

  const startStream = useCallback(
    async (messageText: string, conversationId: string, attachments: AttachmentDraft[]) => {
      const controller = new AbortController();
      streamAbortRef.current = controller;
      try {
        await streamNewRun({
          conversationId,
          message: messageText,
          attachments,
          onEvent: handleEvent,
          signal: controller.signal
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        dispatch(failRun(error instanceof Error ? error.message : "连接已中断。"));
      }
    },
    [dispatch, handleEvent]
  );

  const handleSend = useCallback(
    async (forcedText?: string) => {
      const text = (forcedText ?? chat.composerText).trim();
      if (!text && chat.attachments.length === 0) {
        return;
      }

      const conversationId = chat.conversationId ?? createConversationId();
      persistConversationId(conversationId);

      let uploadedAttachments = chat.attachments;
      const pendingAttachmentIds = chat.attachments.map((item) => item.id);

      if (chat.attachments.length > 0) {
        try {
          setUploading(true);
          uploadedAttachments = await Promise.all(
            chat.attachments.map(async (draft) => {
              const file = pendingFilesRef.current.get(draft.id);
              if (!file) {
                return draft;
              }
              return uploadMedia(file, {
                conversationId,
                scene: "chat"
              });
            })
          );
        } catch (error) {
          dispatch(failRun(error instanceof Error ? error.message : "附件上传失败。"));
          return;
        } finally {
          setUploading(false);
        }
      }

      dispatch(
        appendUserMessage({
          conversationId,
          text: text || "请结合我上传的内容继续。",
          attachments: uploadedAttachments
        })
      );
      removePendingFiles(pendingAttachmentIds);
      dispatch(clearComposer());
      await startStream(text || "请结合我上传的内容继续。", conversationId, uploadedAttachments);
    },
    [chat.attachments, chat.composerText, chat.conversationId, dispatch, persistConversationId, removePendingFiles, startStream]
  );

  useEffect(() => {
    const raw = localStorage.getItem(ACTIVE_RUN_STORAGE_KEY);
    if (!raw) {
      setRecovering(false);
      return;
    }

    const recover = async () => {
      try {
        const payload = JSON.parse(raw) as { runId?: string; conversationId?: string };
        if (!payload.runId || !payload.conversationId) {
          clearActiveRun();
          return;
        }
        const state = await fetchRunState(payload.runId);
        dispatch(
          hydrateRunState({
            runId: state.runId,
            conversationId: state.conversationId,
            status: mapBackendStatus(state.status),
            text: state.message,
            thinking: state.thinking,
            actions: state.actions,
            lastSeq: state.lastSeq
          })
        );
        persistConversationId(state.conversationId);

        if (state.status === "running" || state.status === "queued") {
          const controller = new AbortController();
          streamAbortRef.current = controller;
          await reconnectRun({
            runId: state.runId,
            fromSeq: state.lastSeq,
            onEvent: handleEvent,
            signal: controller.signal
          });
        } else {
          clearActiveRun();
        }
      } catch {
        clearActiveRun();
      } finally {
        setRecovering(false);
      }
    };

    void recover();

    return () => {
      streamAbortRef.current?.abort();
    };
  }, [clearActiveRun, dispatch, handleEvent, persistConversationId]);

  useEffect(() => {
    if (recovering || chat.messages.length > 0) {
      return;
    }

    const conversationId = chat.conversationId ?? localStorage.getItem(LAST_CONVERSATION_STORAGE_KEY);
    if (!conversationId) {
      return;
    }

    const loadHistory = async () => {
      try {
        const history = await fetchConversationHistory({
          conversationId,
          limit: 50
        });
        dispatch(
          replaceConversationMessages({
            conversationId: history.conversationId,
            messages: history.items.map((item) => ({
              id: item.id,
              role: item.role,
              text: item.content,
              createdAt: item.createdAt,
              attachments: item.attachments,
              status: "completed"
            }))
          })
        );
        persistConversationId(history.conversationId);
      } catch {
        // ignore initial history load failure for now
      }
    };

    void loadHistory();
  }, [chat.conversationId, chat.messages.length, dispatch, persistConversationId, recovering]);

  useEffect(() => {
    setAuthSession(getAuthSession());
  }, []);

  useEffect(() => {
    if (!authSession?.sessionToken) {
      setBillingSummary(null);
      setAuditEvents([]);
      return;
    }

    const loadRuntimeViews = async () => {
      try {
        const [account, auditPage] = await Promise.all([
          fetchBillingAccount(),
          fetchAuditEvents({
            userId: authSession.userId,
            pageNo: 1,
            pageSize: 5
          })
        ]);
        setBillingSummary({
          plan: account.plan,
          remainingTokens: account.remainingTokens,
          quotaState: account.quotaState
        });
        setAuditEvents(
          auditPage.items.map((item) => ({
            id: item.id,
            eventType: item.eventType,
            createdAt: item.createdAt,
            sourceService: item.sourceService
          }))
        );
      } catch {
        setBillingSummary(null);
        setAuditEvents([]);
      }
    };

    void loadRuntimeViews();
  }, [authSession]);

  useEffect(() => {
    const host = atmosphereRef.current;
    if (!host) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frameId = 0;
    let lastFrame = performance.now();

    const rebuild = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width <= 0 || height <= 0) {
        return;
      }
      setClouds(createClouds({ width, height }, reduceMotion));
    };

    rebuild();

    if (!reduceMotion) {
      const tick = (now: number) => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        const dt = Math.min(26, now - lastFrame);
        lastFrame = now;
        setClouds((prev) => (prev.length === 0 ? prev : animateClouds(prev, { width, height }, dt)));
        frameId = window.requestAnimationFrame(tick);
      };
      frameId = window.requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(() => {
      rebuild();
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !followLatest) {
      return;
    }
    anchorRef.current?.scrollIntoView({ behavior: chat.stream.status === "streaming" ? "smooth" : "auto" });
  }, [chat.messages, chat.stream.status, chat.stream.thinking, followLatest]);

  return (
    <div className="chat-app-shell">
      <header className="toolbar">
        <div className="brand">
          <Image src="/phyok-logo.png" alt="Phyok" width={36} height={36} className="brand-logo" priority />
          <div>
            <div className="brand-title">心理学空间</div>
            <div className="brand-subtitle">Self Explore Agent Pro</div>
          </div>
        </div>
        <Link href="/login" className="toolbar-login">
          {authSession ? `已登录 · ${authSession.email}` : "邮箱登录"}
        </Link>
      </header>

      <main className="chat-layout">
        <section className="hero-panel">
          <div className="hero-kicker">Phyok Agent Workspace</div>
          <h1>一个聊天框，承接你的输入、线索与继续探索。</h1>
          <p>
            首屏先聚焦核心体验：文本、多模态入口、流式回应、thinking 展示、可点击反问动作，以及断线后可恢复的
            SSE 运行态。
          </p>
          {billingSummary ? (
            <p className="hero-billing">
              当前套餐 `{billingSummary.plan}`，剩余令牌 {billingSummary.remainingTokens.toLocaleString("zh-CN")}，
              状态 {billingSummary.quotaState}。
            </p>
          ) : null}
          {authSession ? (
            <div className="hero-runtime-card">
              <div className="hero-runtime-title">运行证据</div>
              <div className="hero-runtime-subtitle">最近 5 条审计事件会在这里显示，便于确认聊天链路已真实落到 Java 审计服务。</div>
              {auditEvents.length === 0 ? (
                <div className="hero-runtime-empty">已登录，但还没有拉到最近审计事件。</div>
              ) : (
                <div className="hero-runtime-list">
                  {auditEvents.map((item) => (
                    <div key={item.id} className="hero-runtime-item">
                      <strong>{item.eventType}</strong>
                      <span>{item.sourceService}</span>
                      <span>{new Date(item.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="hero-runtime-card">
              <div className="hero-runtime-title">体验建议</div>
              <div className="hero-runtime-subtitle">先完成邮箱登录，再发起对话，这样可以完整体验登录、计费预检、审计回放与日志链路。</div>
            </div>
          )}
          <div className="hero-chips">
            <button type="button" onClick={() => void handleSend("我最近在亲密关系里总有一种说不上来的不安。")}>
              关系不安
            </button>
            <button type="button" onClick={() => void handleSend("我想从原生家庭开始探索，看看我现在的反应模式。")}>
              原生家庭
            </button>
            <button type="button" onClick={() => void handleSend("请用一个心理学流派来解释我反复自我否定的原因。")}>
              流派探索
            </button>
          </div>
        </section>

        <section className="chat-stage">
          <div
            className="message-scroll"
            ref={scrollRef}
            onScroll={(event) => {
              setFollowLatest(isNearBottom(event.currentTarget));
            }}
          >
            {recovering ? (
              <div className="empty-state">
                <div className="empty-title">正在恢复上一次会话…</div>
              </div>
            ) : chat.messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">从一个具体场景开始，会更容易进入探索。</div>
                <div className="empty-subtitle">
                  你可以直接讲最近一次触发你的关系、情绪、身体感受，或者附上一张图片、一份文档、一段语音。
                </div>
              </div>
            ) : null}

            {chat.messages.map((message) => (
              <article key={message.id} className={`message-card ${message.role}`}>
                <div className="message-meta">
                  <span>{message.role === "user" ? "你" : "Agent"}</span>
                  <span>{new Date(message.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {message.thinking ? (
                  <details className="thinking-panel" open={message.status === "streaming"}>
                    <summary>Thinking</summary>
                    <pre>{message.thinking}</pre>
                  </details>
                ) : null}
                <div className="message-content">{message.text || "正在组织回应…"}</div>
                {message.actions && message.actions.length > 0 ? (
                  <div className="message-actions">
                    {message.actions.map((action) => (
                      <button key={action.id} type="button" onClick={() => void handleSend(action.prompt)}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}

            <div ref={anchorRef} />
          </div>

          <div className="composer-shell">
            <div className="composer-toolbar">
              <div className="composer-status">
                <span className={`status-dot ${chat.stream.status}`} />
                <span>
                  {chat.stream.status === "streaming"
                    ? "正在流式输出"
                    : uploading
                      ? "正在上传附件"
                    : chat.stream.status === "reconnecting"
                      ? "正在恢复连接"
                      : chat.stream.status === "failed"
                        ? chat.stream.errorMessage ?? "连接失败"
                        : "已就绪"}
                </span>
              </div>
              {chat.stream.status === "streaming" || chat.stream.status === "reconnecting" ? (
                <button type="button" className="stop-button" onClick={() => void stopStreaming()}>
                  停止
                </button>
              ) : null}
            </div>

            {chat.attachments.length > 0 ? (
              <div className="attachment-list">
                {chat.attachments.map((item) => (
                  <div key={item.id} className="attachment-chip">
                    <span>{item.kind}</span>
                    <strong>{item.name}</strong>
                    <button type="button" onClick={() => removeAttachmentDraft(item.id)}>
                      移除
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="composer-atmosphere" ref={atmosphereRef}>
              {clouds.map((cloud) => (
                <div
                  key={cloud.id}
                  className="composer-cloud"
                  style={{
                    width: `${cloud.width}px`,
                    height: `${cloud.height}px`,
                    transform: `translate3d(${cloud.x}px, ${cloud.y + Math.sin(cloud.phase) * cloud.bobAmplitude}px, 0) rotate(${cloud.angle}deg)`
                  }}
                >
                  <span>{cloud.label}</span>
                </div>
              ))}

              <div className="composer-card">
              <textarea
                value={chat.composerText}
                onChange={(event) => dispatch(setComposerText(event.target.value))}
                placeholder="把最近一个具体场景讲出来，或者带上图片、语音、文档。"
                rows={1}
                disabled={composerDisabled}
              />

              <div className="composer-actions">
                <div className="composer-left">
                  <button type="button" onClick={() => docInputRef.current?.click()}>
                    文档
                  </button>
                  <button type="button" onClick={() => imageInputRef.current?.click()}>
                    图片
                  </button>
                  <button type="button" onClick={() => audioInputRef.current?.click()}>
                    语音
                  </button>
                </div>
                <button
                  type="button"
                  className="send-button"
                  onClick={() => void handleSend()}
                  disabled={composerDisabled || (!chat.composerText.trim() && chat.attachments.length === 0)}
                >
                  发送
                </button>
              </div>
            </div>
            </div>

            <div className="composer-footnote">
              当前版本已接入邮箱登录、计费预检与审计打点；CMS 与更完整的运维后台仍会继续补齐。
            </div>
          </div>
        </section>
      </main>

      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.ppt,.pptx"
        multiple
        hidden
        onChange={(event) => attachFiles(event.target.files)}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => attachFiles(event.target.files)}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={(event) => attachFiles(event.target.files)}
      />
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  createAlipayOrder,
  deleteConversationHistory,
  fetchAuditEvents,
  fetchBillingAccount,
  fetchBillingPlans,
  fetchConversationHistory,
  fetchConversationSummaries,
  fetchRunState,
  filesToDrafts,
  reconnectRun,
  stopRun,
  streamNewRun,
  uploadMedia,
  type BillingPlanItem,
  type ConversationHistorySummary,
  type ChatStreamEvent
} from "@/lib/chat-api";
import { clearAuthSession, getAuthSession, type AuthSession } from "@/lib/auth-session";
import {
  type AttachmentDraft,
  addAttachments,
  appendAssistantDelta,
  appendCitation,
  appendThinkingDelta,
  appendWarning,
  appendUserMessage,
  clearComposer,
  completeRun,
  failRun,
  finalizeAssistantMessage,
  hydrateRunState,
  replaceConversationMessages,
  removeAttachment,
  startFreshConversation,
  setAssistantActions,
  setComposerText,
  setRiskAlert,
  setUsageSummary,
  startAssistantRun,
  stopRunLocally,
  upsertToolStep,
  updateLastSeq
} from "@/store/chat-slice";
import { useAppDispatch, useAppSelector } from "@/store/index";
import { MemoryStarMapPanel } from "@/features/chat/MemoryStarMapPanel";
import { EmailLoginCard } from "@/features/auth/EmailLoginCard";

const ACTIVE_RUN_STORAGE_KEY = "phyok-chat-active-run";
const LAST_CONVERSATION_STORAGE_KEY = "phyok-chat-last-conversation";
const MOBILE_DRAWER_SEEN_KEY = "phyok-chat-mobile-drawer-seen";
const HISTORY_PAGE_SIZE = 9;
const RECORDING_MAX_MS = 60_000;
const RECORDING_WAVE_BAR_COUNT = 24;
const SUGGESTION_ROW_STRIDE = 42;
const SUGGESTION_ROW_BASE = 12;
const SUGGESTION_LANE_MIN_HEIGHT = 74;
const PSYCHOLOGY_SCHOOLS = [
  "精神分析流派",
  "客体关系流派",
  "自体心理学流派",
  "人本主义流派",
  "积极心理学流派",
  "正念心理学流派",
  "森田心理学流派",
  "其它心理学流派"
] as const;
const EXPLORE_INTENTS = [
  "背后潜意识",
  "原生家庭溯源",
  "困扰根因"
] as const;
const MEMORY_INTENTS = [
  "沉淀记忆星图",
  "修复记忆碎片"
] as const;
const MEMORY_INTENT_PROMPTS: Record<(typeof MEMORY_INTENTS)[number], string> = {
  沉淀记忆星图:
    "我想开启一个全新的记忆沉淀上下文，请围绕“沉淀记忆星图”带我梳理最近反复出现的情绪、关系片段与身体感受，并帮我提炼值得长期保留的记忆线索。",
  修复记忆碎片:
    "我想开启一个全新的修复上下文，请围绕“修复记忆碎片”帮助我温和回看一段断裂、模糊或反复困扰我的经历，整理关键情绪、触发点与可继续追问的方向。"
};
const MODULES = [
  {
    id: "explore",
    title: "自我探索Agent Pro",
    subtitle: "主对话区"
  },
  {
    id: "memory-map",
    title: "记忆星图",
    subtitle: "记忆关系图谱"
  },
  {
    id: "history",
    title: "历史对话",
    subtitle: "会话沉淀"
  },
  {
    id: "profile",
    title: "我的",
    subtitle: "账户与偏好"
  }
] as const;

type ModuleId = (typeof MODULES)[number]["id"];
type SuggestionLane = "memory" | "school" | "explore";
type SuggestionSeed = {
  id: string;
  label: string;
  lane: SuggestionLane;
  guideTitle: string;
  guideBody: string;
  kickoffPrompt: string;
};
type SuggestionBandPosition = "top" | "bottom";
type SuggestionChip = {
  id: string;
  label: string;
  lane: SuggestionLane;
  row: number;
  distanceFromCore: number;
  x: number;
  width: number;
  vx: number;
  bobPhase: number;
  bobSpeed: number;
  bobAmplitude: number;
  guideTitle: string;
  guideBody: string;
  kickoffPrompt: string;
};

const MEMORY_SUGGESTION_SEEDS: readonly SuggestionSeed[] = [
  {
    id: "memory-emotion",
    label: "补一段最近反复出现的情绪",
    lane: "memory",
    guideTitle: "先把反复出现的情绪说具体一点",
    guideBody: "这一步不会直接给结论，而是先帮你把最近反复出现的情绪落到触发场景、身体反应和当下关系里，找到最值得继续追问的入口。",
    kickoffPrompt:
      "我想从“最近反复出现的情绪”开始。请先不要直接分析结论，而是用温和、具体的方式引导我继续追问：先用 1 到 2 句承接我的处境，再给我 2 到 3 个循序渐进、低压力的问题，帮助我把最近反复出现的情绪、触发场景和身体感受说得更清楚。最后只保留 1 个最值得我先回答的问题。"
  },
  {
    id: "memory-relationship",
    label: "写下一段忘不掉的关系片段",
    lane: "memory",
    guideTitle: "先把那段关系片段慢慢打开",
    guideBody: "我会先让 Floyd 帮你回到那段难忘片段里的关键细节，不急着下定义，而是先分清楚发生了什么、你当时怎么感受、为什么它还留在心里。",
    kickoffPrompt:
      "我想从“一段忘不掉的关系片段”开始。请先不要直接解释这段关系意味着什么，而是先用细腻、低压的方式引导我继续说：围绕当时发生了什么、我最在意的一个瞬间、以及现在回想时最强烈的感受，给我 2 到 3 个递进问题。最后只留下 1 个最适合我先回答的问题。"
  },
  {
    id: "memory-family",
    label: "从原生家庭里认出旧回声",
    lane: "memory",
    guideTitle: "先认出今天和过去是怎么连起来的",
    guideBody: "这一步会先帮你辨认当下困扰和旧经验之间是否真的存在回声，而不是立刻把一切都归因给原生家庭。",
    kickoffPrompt:
      "我想从“原生家庭里的旧回声”开始。请先不要直接做原生家庭结论，而是先温和地引导我辨认：今天哪一种情绪或关系反应最像旧经验、它像什么、以及我为什么会在此刻被触发。请给我 2 到 3 个递进问题，最后保留 1 个最值得先回答的问题。"
  },
  {
    id: "memory-body",
    label: "把一个身体感受沉淀成记忆碎片",
    lane: "memory",
    guideTitle: "先让身体感受有一个可描述的轮廓",
    guideBody: "我会先帮你把那种说不清的身体反应描述出来，再慢慢连接到可能相关的情境和情绪，让它变成可以继续探索的记忆线索。",
    kickoffPrompt:
      "我想从“一个身体感受”开始。请先不要直接解释原因，而是先引导我把这份身体感受描述得更清楚：它在哪里、像什么、在什么情境最明显、以及它通常伴随着什么情绪。请用 2 到 3 个温和具体的问题带我继续说，最后只留下 1 个最值得先回答的问题。"
  }
] as const;

const EXPLORE_SUGGESTION_SEEDS: readonly SuggestionSeed[] = [
  {
    id: "explore-anxiety",
    label: "帮我探索这份不安真正指向什么",
    lane: "explore",
    guideTitle: "先看清这份不安究竟在提醒什么",
    guideBody: "Floyd 会先陪你把这份不安拆开，而不是直接告诉你答案，先辨认它更像担心、羞耻、害怕失去，还是别的什么。",
    kickoffPrompt:
      "我想从“这份不安真正指向什么”开始。请不要直接给我完整分析，而是先用 1 到 2 句承接我的处境，然后通过 2 到 3 个递进问题，引导我分辨这份不安最强的时候、它在担心什么、以及它最害怕失去什么。最后保留 1 个最值得我先回应的问题。"
  },
  {
    id: "explore-school",
    label: "用一个心理学流派解释我现在的状态",
    lane: "explore",
    guideTitle: "先为这份状态找到更合适的观察视角",
    guideBody: "这一步会先帮你把眼前状态描述清楚，再决定哪种心理学视角最适合切入，不会一上来就堆术语。",
    kickoffPrompt:
      "我想从“用一个心理学流派理解我现在的状态”开始。请先不要直接给我一大段理论解释，而是先通过 2 到 3 个递进问题，帮我描述清楚我此刻最突出的情绪、关系处境和卡住点，再根据我的回答判断最适合继续深入的心理学视角。最后只留下 1 个最值得我先回答的问题。"
  },
  {
    id: "explore-root",
    label: "顺着这段记忆，继续寻找困扰根因",
    lane: "explore",
    guideTitle: "先沿着这段记忆找到真正卡住的地方",
    guideBody: "我会先陪你确认是哪一个细节最刺痛、最反复，再一步步接近困扰的真正根部，而不是仓促地下结论。",
    kickoffPrompt:
      "我想从“一段记忆里的困扰根因”开始。请先不要直接定义我的根因，而是先用温和的追问带我继续说清楚：这段记忆里最刺痛的细节是什么、它为什么到现在还会反复出现、以及它最像我现在什么处境。请给我 2 到 3 个递进问题，最后保留 1 个最值得先回答的问题。"
  },
  {
    id: "explore-chaos",
    label: "把现在的混乱整理成可继续探索的问题",
    lane: "explore",
    guideTitle: "先把混乱整理成一个能继续走下去的问题",
    guideBody: "这一步会先帮你把散乱的感受、关系和念头收束成一个更清晰的核心问题，让接下来的探索更有方向。",
    kickoffPrompt:
      "我想把现在的混乱整理成一个可继续探索的问题。请先不要直接给答案，而是先通过 2 到 3 个问题，帮我分辨我现在最困扰的是情绪、关系、选择，还是自我评价；再帮我收束成一个最值得继续深入的问题。最后只留下 1 个最适合我先回答的问题。"
  }
] as const;

function buildSchoolSuggestionSeed(school: (typeof PSYCHOLOGY_SCHOOLS)[number]): SuggestionSeed {
  return {
    id: `school-${school}`,
    label: school,
    lane: "school",
    guideTitle: `先用“${school}”为你找到一个进入点`,
    guideBody: `这一步会先用“${school}”的视角帮你找到合适的提问入口，不会直接把整套理论压到你身上，而是先帮你辨认最值得继续说下去的体验。`,
    kickoffPrompt: `我想以“${school}”作为主要视角开启一轮新的探索。请先不要直接做完整分析，而是先用 1 到 2 句说明这个视角会怎样帮助我理解当前状态，然后通过 2 到 3 个递进问题，引导我把此刻最突出的情绪、关系处境或内在冲突说得更具体。请让问题低压力、可回答，并在结尾只保留 1 个最值得我先回应的问题。`
  };
}

const SCHOOL_SUGGESTION_SEEDS = PSYCHOLOGY_SCHOOLS.map(buildSchoolSuggestionSeed);

function createConversationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `conv-${Date.now()}`;
}

function buildExploreIntentPrompt(intent: (typeof EXPLORE_INTENTS)[number]): string {
  switch (intent) {
    case "背后潜意识":
      return "我想开启一个全新的探索上下文，请围绕“背后潜意识”帮助我理解当前情绪、选择或关系反应背后尚未被看见的心理动因。";
    case "原生家庭溯源":
      return "我想开启一个全新的探索上下文，请围绕“原生家庭溯源”帮助我回到成长经历里，辨认今天的情绪模式、关系防御和旧回声是怎样形成的。";
    case "困扰根因":
      return "我想开启一个全新的探索上下文，请围绕“困扰根因”帮助我把眼前的混乱、卡住与反复出现的问题层层拆开，找到最值得继续追问的核心原因。";
    default:
      return `我想开启一个全新的探索上下文，请围绕“${intent}”帮助我继续深入理解自己。`;
  }
}

function buildSchoolIntentPrompt(school: (typeof PSYCHOLOGY_SCHOOLS)[number]): string {
  return `我想开启一个全新的探索上下文，请以“${school}”作为主要视角，结合我当下的情绪、关系和困扰，帮助我理解现在的心理状态，并给出一个最值得继续深入的探索方向。`;
}

type ComposerToolIconKind = "document" | "image" | "record" | "recording" | "processing";

function AccountEntryIcon() {
  return (
    <span className="toolbar-login-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12.25a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
        <path d="M5.75 18.25a6.25 6.25 0 0 1 12.5 0" />
      </svg>
    </span>
  );
}

function NewContextIcon() {
  return (
    <span className="toolbar-login-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </span>
  );
}

function SendActionIcon() {
  return (
    <span className="send-button-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 4 11 13" />
        <path d="m20 4-6 16-3.5-7.5L3 9l17-5Z" />
      </svg>
    </span>
  );
}

function DrawerToggleIcon() {
  return (
    <span className="toolbar-drawer-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <path d="M10 5v14" />
        <path d="M7 9h0.01" />
        <path d="M7 12h0.01" />
        <path d="M7 15h0.01" />
        <path d="M13 9h4" />
        <path d="M13 12h4" />
        <path d="M13 15h3" />
      </svg>
    </span>
  );
}

function ComposerToolIcon({ kind }: { kind: ComposerToolIconKind }) {
  if (kind === "document") {
    return (
      <span className="composer-tool-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3.75h5.5L18.25 8.5V18A2.25 2.25 0 0 1 16 20.25H8A2.25 2.25 0 0 1 5.75 18V6A2.25 2.25 0 0 1 8 3.75Z" />
          <path d="M13.5 3.75V8.5h4.75" />
          <path d="M8.75 12h6.5" />
          <path d="M8.75 15.5h6.5" />
        </svg>
      </span>
    );
  }

  if (kind === "image") {
    return (
      <span className="composer-tool-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4.5" y="5.25" width="15" height="13.5" rx="2.75" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M6.25 16.75 10.25 12.75 13.1 15.6 15.2 13.5 17.75 16.05" />
        </svg>
      </span>
    );
  }

  if (kind === "processing") {
    return (
      <span className="composer-tool-icon is-processing" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 5.5a6.5 6.5 0 0 1 6.02 4.05" />
          <path d="M18.1 14.35A6.5 6.5 0 0 1 7.8 18.4" />
          <path d="M5.9 9.65A6.5 6.5 0 0 1 12 5.5" />
        </svg>
      </span>
    );
  }

  if (kind === "recording") {
    return (
      <span className="composer-tool-icon is-live" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="8" width="8" height="8" rx="2.2" />
          <path d="M12 4.75v1.5" />
          <path d="M12 17.75v1.5" />
        </svg>
        <span className="composer-tool-live-dot" />
      </span>
    );
  }

  return (
    <span className="composer-tool-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.5 8.25A2.25 2.25 0 0 1 12.75 6h0A2.25 2.25 0 0 1 15 8.25v4.5A2.25 2.25 0 0 1 12.75 15h0a2.25 2.25 0 0 1-2.25-2.25v-4.5Z" />
        <path d="M8.25 11.75a4.5 4.5 0 0 0 9 0" />
        <path d="M12.75 15v3.25" />
        <path d="M10 18.25h5.5" />
      </svg>
    </span>
  );
}

function isNearBottom(element: HTMLDivElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

const JUMP_BOTTOM_REVEAL_DISTANCE = 160;
const JUMP_BOTTOM_HIDE_DISTANCE = 56;

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function formatDuration(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatHistoryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function shortenHistoryText(value: string, maxLength = 96): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "暂未生成可预览内容。";
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function formatHistoryStatus(status: string): string {
  if (status === "completed") {
    return "已完成";
  }
  if (status === "running" || status === "queued") {
    return "生成中";
  }
  if (status === "failed") {
    return "失败";
  }
  return "已中断";
}

function formatSuggestionLaneLabel(lane: SuggestionLane): string {
  if (lane === "memory") {
    return "记忆沉淀";
  }
  if (lane === "school") {
    return "流派视角";
  }
  return "自我探索";
}

function formatSuggestionLaneHint(lane: SuggestionLane): string {
  if (lane === "memory") {
    return "先帮你把经历说具体，再决定沉淀什么";
  }
  if (lane === "school") {
    return "先选观察视角，再由 Floyd 带你继续追问";
  }
  return "先用递进问题收束，再进入更深一层";
}

function getSuggestionLaneMotion(lane: SuggestionLane) {
  if (lane === "memory") {
    return {
      speedMin: 0.0034,
      speedMax: 0.0072,
      bobSpeedMin: 0.00032,
      bobSpeedMax: 0.0007,
      bobAmplitudeMin: 0.65,
      bobAmplitudeMax: 1.55,
      damping: 0.92,
      floorSpeed: 0.0028
    };
  }

  if (lane === "school") {
    return {
      speedMin: 0.0026,
      speedMax: 0.0054,
      bobSpeedMin: 0.00024,
      bobSpeedMax: 0.00052,
      bobAmplitudeMin: 0.45,
      bobAmplitudeMax: 1.1,
      damping: 0.9,
      floorSpeed: 0.0022
    };
  }

  return {
    speedMin: 0.0039,
    speedMax: 0.0086,
    bobSpeedMin: 0.0004,
    bobSpeedMax: 0.00086,
    bobAmplitudeMin: 0.75,
    bobAmplitudeMax: 1.8,
    damping: 0.93,
    floorSpeed: 0.0032
  };
}

function pickRecordingMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  return candidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
}

function buildRecordingFileName(mimeType: string): string {
  if (mimeType.includes("mp4")) {
    return `voice-note-${Date.now()}.m4a`;
  }
  if (mimeType.includes("ogg")) {
    return `voice-note-${Date.now()}.ogg`;
  }
  return `voice-note-${Date.now()}.webm`;
}

function extractThinkingSummary(thinking: string, fallback: string): string {
  const normalized = thinking
    .split("\n")
    .map((line) => line.replace(/^\[[^\]]+\]\s*/g, "").trim())
    .find(Boolean);
  return normalized || fallback;
}

function summarizeUsage(inputChars: number, outputChars: number, attachmentCount: number): string {
  return `输入 ${inputChars} · 输出 ${outputChars} · 附件 ${attachmentCount}`;
}

function createLaneChips(items: readonly SuggestionSeed[], width: number, bandPosition: SuggestionBandPosition): SuggestionChip[] {
  if (width <= 0) {
    return [];
  }

  const gap = 14;
  const maxChipWidth = Math.max(152, Math.min(260, width - 16));
  const rows: SuggestionChip[][] = [];
  let currentRow: SuggestionChip[] = [];
  let currentWidth = 0;

  items.forEach((item) => {
    const estimatedWidth = clamp(item.label.length * 13 + 42, 138, maxChipWidth);
    const needsWrap = currentRow.length > 0 && currentWidth + gap + estimatedWidth > width - 16;
    if (needsWrap) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }

    const row = rows.length;
    const motion = getSuggestionLaneMotion(item.lane);
    const chip: SuggestionChip = {
      ...item,
      row,
      distanceFromCore: 0,
      x: 0,
      width: estimatedWidth,
      vx: randomBetween(motion.speedMin, motion.speedMax) * (row % 2 === 0 ? 1 : -1),
      bobPhase: randomBetween(0, Math.PI * 2),
      bobSpeed: randomBetween(motion.bobSpeedMin, motion.bobSpeedMax),
      bobAmplitude: randomBetween(motion.bobAmplitudeMin, motion.bobAmplitudeMax)
    };
    currentRow.push(chip);
    currentWidth += estimatedWidth + (currentRow.length > 1 ? gap : 0);
  });

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  const totalRows = rows.length;
  const maxIndex = Math.max(1, totalRows - 1);
  return rows.flatMap((rowChips, rowIndex) => {
    const totalWidth = rowChips.reduce((sum, chip) => sum + chip.width, 0) + gap * Math.max(0, rowChips.length - 1);
    let cursor = Math.max(8, (width - totalWidth) / 2 + (rowIndex % 2 === 0 ? -14 : 14));
    const distanceFromCore =
      bandPosition === "top" ? (maxIndex - rowIndex) / maxIndex : rowIndex / maxIndex;

    return rowChips.map((chip, index) => {
      const motionScale = 1 + distanceFromCore * 0.16;
      const positioned: SuggestionChip = {
        ...chip,
        distanceFromCore,
        vx: chip.vx * motionScale,
        bobSpeed: chip.bobSpeed * (1 + distanceFromCore * 0.14),
        bobAmplitude: chip.bobAmplitude * (1 + distanceFromCore * 0.18),
        x: cursor
      };
      cursor += chip.width + gap;

      if (index === rowChips.length - 1 && positioned.x + positioned.width > width - 8) {
        positioned.x = Math.max(8, width - positioned.width - 8);
      }
      return positioned;
    });
  });
}

function animateLaneChips(chips: SuggestionChip[], width: number, dt: number): SuggestionChip[] {
  const minGap = 12;
  const next = chips.map((chip) => ({
    ...chip,
    x: chip.x + chip.vx * dt,
    bobPhase: chip.bobPhase + chip.bobSpeed * dt
  }));

  for (const chip of next) {
    const motion = getSuggestionLaneMotion(chip.lane);
    if (chip.x <= 8) {
      chip.x = 8;
      chip.vx = Math.abs(chip.vx) * motion.damping;
    }
    if (chip.x + chip.width >= width - 8) {
      chip.x = Math.max(8, width - chip.width - 8);
      chip.vx = -Math.abs(chip.vx) * motion.damping;
    }
  }

  for (let index = 0; index < next.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < next.length; otherIndex += 1) {
      const left = next[index];
      const right = next[otherIndex];
      if (left.row !== right.row) {
        continue;
      }
      const leftRight = left.x + left.width;
      const overlap = leftRight + minGap - right.x;

      if (overlap > 0) {
        left.x -= overlap / 2;
        right.x += overlap / 2;

        const leftVx = left.vx;
        left.vx = -Math.abs(right.vx || left.vx) * getSuggestionLaneMotion(left.lane).damping;
        right.vx = Math.abs(leftVx || right.vx) * getSuggestionLaneMotion(right.lane).damping;
      }
    }
  }

  return next.map((chip) => ({
    ...chip,
    x: clamp(chip.x, 8, Math.max(8, width - chip.width - 8)),
    vx:
      chip.vx >= 0
        ? Math.max(getSuggestionLaneMotion(chip.lane).floorSpeed, chip.vx)
        : Math.min(-getSuggestionLaneMotion(chip.lane).floorSpeed, chip.vx)
  }));
}

function getSuggestionLaneHeight(chips: SuggestionChip[]): number {
  if (chips.length === 0) {
    return SUGGESTION_LANE_MIN_HEIGHT;
  }
  const rows = Math.max(...chips.map((chip) => chip.row)) + 1;
  return Math.max(SUGGESTION_LANE_MIN_HEIGHT, rows * SUGGESTION_ROW_STRIDE + SUGGESTION_ROW_BASE);
}

function getSuggestionChipVisuals(chip: SuggestionChip) {
  const outer = chip.distanceFromCore;
  return {
    opacity: 0.82 + (1 - outer) * 0.18,
    scale: 0.948 + (1 - outer) * 0.052,
    zIndex: Math.round((1 - outer) * 20) + 1
  };
}


export function ChatShell() {
  const dispatch = useAppDispatch();
  const chat = useAppSelector((state) => state.chat);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingFrameRef = useRef<number | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const memoryLaneRef = useRef<HTMLDivElement | null>(null);
  const exploreLaneRef = useRef<HTMLDivElement | null>(null);
  const animationPausedRef = useRef(false);
  const manualScrollIntentRef = useRef(false);
  const userDetachedScrollRef = useRef(false);
  const autoScrollReleaseTimerRef = useRef<number | null>(null);
  const autoScrollingRef = useRef(false);
  const drawerAutoCloseTimerRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingAutoStopTimerRef = useRef<number | null>(null);
  const [followLatest, setFollowLatest] = useState(true);
  const [recovering, setRecovering] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [billingSummary, setBillingSummary] = useState<{
    plan: string;
    remainingTokens: number;
    quotaState: string;
    seedUser: boolean;
    paymentChannel: string;
    recommendedPlanId?: string;
  } | null>(null);
  const [billingPlans, setBillingPlans] = useState<BillingPlanItem[]>([]);
  const [billingPlansLoading, setBillingPlansLoading] = useState(false);
  const [billingPlansError, setBillingPlansError] = useState<string | null>(null);
  const [historyPageNo, setHistoryPageNo] = useState(1);
  const [historySummaries, setHistorySummaries] = useState<ConversationHistorySummary[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyOpeningId, setHistoryOpeningId] = useState<string | null>(null);
  const [historyDeletingId, setHistoryDeletingId] = useState<string | null>(null);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [memoryMapRefreshKey, setMemoryMapRefreshKey] = useState(0);
  const [auditEvents, setAuditEvents] = useState<
    Array<{
      id: string;
      eventType: string;
      createdAt: string;
      sourceService: string;
    }>
  >([]);
  const [activeModule, setActiveModule] = useState<ModuleId>("explore");
  const [animationPaused, setAnimationPaused] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [toolbarHeight, setToolbarHeight] = useState(88);
  const [explorePanelOpen, setExplorePanelOpen] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<(typeof PSYCHOLOGY_SCHOOLS)[number]>("精神分析流派");
  const [memoryChips, setMemoryChips] = useState<SuggestionChip[]>([]);
  const [exploreChips, setExploreChips] = useState<SuggestionChip[]>([]);
  const [pendingSuggestionChip, setPendingSuggestionChip] = useState<SuggestionChip | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "processing">("idle");
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingLevels, setRecordingLevels] = useState<number[]>(() =>
    Array.from({ length: RECORDING_WAVE_BAR_COUNT }, () => 0.16)
  );
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showJumpBottom, setShowJumpBottom] = useState(false);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const [unreadUpdateCount, setUnreadUpdateCount] = useState(0);
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);
  const [lastPaymentOrder, setLastPaymentOrder] = useState<{
    orderNo: string;
    planId: string;
    payUrl: string;
    qrCodeUrl: string;
    expiresAt: string;
  } | null>(null);

  const hasConversation = chat.messages.length > 0;
  const showTimeline = hasConversation || recovering;
  const activeModuleItem = useMemo(
    () => MODULES.find((item) => item.id === activeModule) ?? MODULES[0],
    [activeModule]
  );
  const latestAssistantSnapshot = useMemo(() => {
    const assistant = [...chat.messages].reverse().find((item) => item.role === "assistant");
    return {
      id: assistant?.id ?? null,
      count: chat.messages.length,
      textLength: assistant?.text.length ?? 0,
      thinkingLength: assistant?.thinking?.length ?? 0
    };
  }, [chat.messages]);
  const historyTotalPages = useMemo(
    () => Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE)),
    [historyTotal]
  );

  const composerDisabled = useMemo(() => {
    return (
      chat.stream.status === "streaming" ||
      chat.stream.status === "reconnecting" ||
      uploading ||
      recordingState !== "idle"
    );
  }, [chat.stream.status, recordingState, uploading]);
  const composerFootnote = useMemo(() => {
    if (recordingState === "recording") {
      return `正在录音 ${formatDuration(recordingElapsedMs)}，单条最长 1 分钟；再次点击可结束并加入当前消息。`;
    }
    if (recordingState === "processing") {
      return "正在整理录音内容，即将作为语音附件加入当前输入。";
    }
    if (recordingError) {
      return recordingError;
    }
    return null;
  }, [recordingElapsedMs, recordingError, recordingState]);
  const openAuthDialog = useCallback(() => {
    setAuthDialogOpen(true);
    setPaymentFeedback(null);
  }, []);
  const closeAuthDialog = useCallback(() => {
    setAuthDialogOpen(false);
  }, []);
  const handleAuthSuccess = useCallback((session: AuthSession) => {
    setAuthSession(session);
    setAuthDialogOpen(false);
    setActiveModule("profile");
  }, []);
  const handleLogout = useCallback(() => {
    clearAuthSession();
    setAuthSession(null);
    setBillingSummary(null);
    setAuditEvents([]);
    setLastPaymentOrder(null);
    setPaymentFeedback("已退出当前账号。");
    setActiveModule("profile");
  }, []);
  const handleCreateAlipayOrder = useCallback(
    async (planId: string) => {
      if (!authSession?.sessionToken) {
        setPaymentFeedback("登录后才可以创建支付宝订单。");
        setActiveModule("profile");
        setAuthDialogOpen(true);
        return;
      }

      try {
        setPayingPlanId(planId);
        setPaymentFeedback(null);
        const order = await createAlipayOrder(planId);
        setLastPaymentOrder(order);
        setPaymentFeedback("支付宝订单已创建，可继续支付或查看二维码。");
        if (typeof window !== "undefined") {
          window.open(order.payUrl, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        setPaymentFeedback(error instanceof Error ? error.message : "创建支付宝订单失败。");
      } finally {
        setPayingPlanId(null);
      }
    },
    [authSession]
  );

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
  const handleStartFreshContext = useCallback(async () => {
    const activeRunId = chat.stream.runId;
    if (activeRunId) {
      try {
        streamAbortRef.current?.abort();
        await stopRun(activeRunId);
      } catch {
        // ignore stop failure when switching to a fresh context
      } finally {
        clearActiveRun();
      }
    } else {
      clearActiveRun();
    }

    removePendingFiles(chat.attachments.map((item) => item.id));
    pendingFilesRef.current.clear();
    const conversationId = createConversationId();
    persistConversationId(conversationId);
    setFollowLatest(true);
    setHasUnreadBelow(false);
    setShowJumpBottom(false);
    setUnreadUpdateCount(0);
    setPendingSuggestionChip(null);
    setMobileDrawerOpen(false);
    setActiveModule("explore");
    dispatch(
      startFreshConversation({
        conversationId,
        composerText: ""
      })
    );
    dispatch(clearComposer());
  }, [chat.attachments, chat.stream.runId, clearActiveRun, dispatch, persistConversationId, removePendingFiles]);

  const pauseAtmosphere = useCallback(() => {
    animationPausedRef.current = true;
    setAnimationPaused(true);
  }, []);

  const resumeAtmosphere = useCallback(() => {
    animationPausedRef.current = false;
    setAnimationPaused(false);
  }, []);

  const adjustComposerHeight = useCallback(() => {
    const element = composerInputRef.current;
    if (!element) {
      return;
    }
    element.style.height = "0px";
    const nextHeight = Math.min(220, Math.max(72, element.scrollHeight));
    element.style.height = `${nextHeight}px`;
  }, []);

  const syncBottomAffordance = useCallback((element: HTMLDivElement) => {
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    const shouldShowJumpBottom = userDetachedScrollRef.current
      ? distance > JUMP_BOTTOM_REVEAL_DISTANCE
      : distance > 240;
    const shouldHideUnread = distance < JUMP_BOTTOM_HIDE_DISTANCE;

    setShowJumpBottom(shouldShowJumpBottom);
    if (shouldHideUnread) {
      setHasUnreadBelow(false);
      setUnreadUpdateCount(0);
    }
  }, []);

  const pauseFollowLatest = useCallback(() => {
    manualScrollIntentRef.current = true;
    userDetachedScrollRef.current = true;
    autoScrollingRef.current = false;
    setFollowLatest(false);
    if (autoScrollReleaseTimerRef.current) {
      window.clearTimeout(autoScrollReleaseTimerRef.current);
      autoScrollReleaseTimerRef.current = null;
    }
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    autoScrollingRef.current = true;
    userDetachedScrollRef.current = false;
    setFollowLatest(true);
    setHasUnreadBelow(false);
    setShowJumpBottom(false);
    setUnreadUpdateCount(0);
    container.scrollTo({
      top: container.scrollHeight,
      behavior
    });

    if (autoScrollReleaseTimerRef.current) {
      window.clearTimeout(autoScrollReleaseTimerRef.current);
    }
    autoScrollReleaseTimerRef.current = window.setTimeout(() => {
      autoScrollingRef.current = false;
      autoScrollReleaseTimerRef.current = null;
    }, behavior === "smooth" ? 220 : 0);
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
        case "tool.started":
          dispatch(
            upsertToolStep({
              tool: event.data.tool,
              label: event.data.label,
              status: "running"
            })
          );
          break;
        case "tool.completed":
          dispatch(
            upsertToolStep({
              tool: event.data.tool,
              label: event.data.label,
              status: "completed"
            })
          );
          break;
        case "citation.appended":
          dispatch(
            appendCitation({
              source: event.data.source,
              title: event.data.title,
              content: event.data.content,
              score: event.data.score
            })
          );
          break;
        case "interaction.required":
          dispatch(setAssistantActions(event.data.actions));
          break;
        case "usage.reported":
          dispatch(
            setUsageSummary({
              inputChars: event.data.inputChars,
              outputChars: event.data.outputChars,
              attachmentCount: event.data.attachmentCount
            })
          );
          break;
        case "message.completed":
          dispatch(
            finalizeAssistantMessage({
              text: event.data.message,
              thinking: event.data.thinking,
              actions: event.data.actions
            })
          );
          break;
        case "risk.alerted":
          dispatch(
            setRiskAlert({
              type: event.data.type,
              severity: event.data.severity,
              title: event.data.title,
              message: event.data.message
            })
          );
          break;
        case "warning.raised":
          dispatch(appendWarning({ message: event.data.message }));
          dispatch(appendThinkingDelta(`\n[提醒] ${event.data.message}\n`));
          break;
        case "stream.failed":
          dispatch(failRun(event.data.message));
          if (event.data.code === "BFF_UNAUTHORIZED") {
            setPaymentFeedback("请先登录后再开始对话。");
            openAuthDialog();
          }
          clearActiveRun();
          break;
        case "stream.completed":
          if (event.data.status === "stopped") {
            dispatch(stopRunLocally());
          } else {
            dispatch(completeRun());
          }
          setMemoryMapRefreshKey((value) => value + 1);
          clearActiveRun();
          break;
        default:
          break;
      }
    },
    [clearActiveRun, dispatch, openAuthDialog, persistActiveRun]
  );

  const attachFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) {
        return;
      }
      setRecordingError(null);
      let files = Array.from(fileList);
      const incomingImages = files.filter((file) => file.type.startsWith("image/"));
      if (incomingImages.length > 0) {
        if (chat.attachments.some((item) => item.kind === "image")) {
          setRecordingError("当前消息一次只能保留 1 张图片，请先移除已有图片。");
          return;
        }
        if (incomingImages.length > 1) {
          setRecordingError("图片每次只能上传 1 张。");
          files = [incomingImages[0]];
        }
        if (files[0] && files[0].size > 3 * 1024 * 1024) {
          setRecordingError("图片不能超过 3MB，请压缩后再上传。");
          return;
        }
      }

      const drafts = filesToDrafts(files);
      drafts.forEach((draft, index) => {
        pendingFilesRef.current.set(draft.id, files[index]);
      });
      dispatch(addAttachments(drafts));
    },
    [chat.attachments, dispatch]
  );

  const resetRecordingLevels = useCallback(() => {
    setRecordingLevels(Array.from({ length: RECORDING_WAVE_BAR_COUNT }, () => 0.16));
  }, []);

  const cleanupRecordingVisualizer = useCallback(() => {
    if (recordingFrameRef.current) {
      window.cancelAnimationFrame(recordingFrameRef.current);
      recordingFrameRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    resetRecordingLevels();
  }, [resetRecordingLevels]);

  const stopRecordingStream = useCallback(() => {
    cleanupRecordingVisualizer();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }, [cleanupRecordingVisualizer]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }
    if (recordingAutoStopTimerRef.current) {
      window.clearTimeout(recordingAutoStopTimerRef.current);
      recordingAutoStopTimerRef.current = null;
    }
    setRecordingState("processing");
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("当前浏览器不支持直接录音，请使用支持麦克风采集的浏览器。");
      return;
    }

    try {
      setRecordingError(null);
      setRecordingElapsedMs(0);
      recordingChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const audioWindow = window as Window &
        typeof globalThis & {
          webkitAudioContext?: typeof AudioContext;
        };
      const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
      const audioContext = AudioContextClass ? new AudioContextClass() : null;
      const analyser = audioContext ? audioContext.createAnalyser() : null;
      if (audioContext && audioContext.state === "suspended") {
        await audioContext.resume();
      }
      if (audioContext && analyser) {
        const sourceNode = audioContext.createMediaStreamSource(stream);
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.84;
        sourceNode.connect(analyser);
      }
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      const sampleWave = () => {
        const currentAnalyser = analyserRef.current;
        if (!currentAnalyser) {
          const t = Date.now() / 220;
          const nextLevels = Array.from({ length: RECORDING_WAVE_BAR_COUNT }, (_, index) => {
            const pulse = (Math.sin(t + index * 0.42) + 1) / 2;
            return clamp(0.18 + pulse * 0.62, 0.16, 0.96);
          });
          setRecordingLevels(nextLevels);
          recordingFrameRef.current = window.requestAnimationFrame(sampleWave);
          return;
        }
        const frequencyData = new Uint8Array(currentAnalyser.frequencyBinCount);
        currentAnalyser.getByteFrequencyData(frequencyData);
        const bucketSize = Math.max(1, Math.floor(frequencyData.length / RECORDING_WAVE_BAR_COUNT));
        const nextLevels = Array.from({ length: RECORDING_WAVE_BAR_COUNT }, (_, index) => {
          const slice = frequencyData.slice(index * bucketSize, (index + 1) * bucketSize);
          const avg = slice.length > 0 ? slice.reduce((sum, value) => sum + value, 0) / slice.length : 0;
          return clamp(avg / 255, 0.12, 1);
        });
        setRecordingLevels(nextLevels);
        recordingFrameRef.current = window.requestAnimationFrame(sampleWave);
      };
      recordingFrameRef.current = window.requestAnimationFrame(sampleWave);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener(
        "stop",
        () => {
          try {
            const resolvedMimeType = recorder.mimeType || mimeType || "audio/webm";
            const blob = new Blob(recordingChunksRef.current, { type: resolvedMimeType });
            recordingChunksRef.current = [];
            mediaRecorderRef.current = null;
            stopRecordingStream();
            if (recordingAutoStopTimerRef.current) {
              window.clearTimeout(recordingAutoStopTimerRef.current);
              recordingAutoStopTimerRef.current = null;
            }

            if (blob.size === 0) {
              setRecordingError("录音没有捕获到有效声音，请重试。");
              setRecordingState("idle");
              return;
            }

            const file = new File([blob], buildRecordingFileName(resolvedMimeType), {
              type: resolvedMimeType,
              lastModified: Date.now()
            });
            const drafts = filesToDrafts([file]);
            drafts.forEach((draft) => {
              pendingFilesRef.current.set(draft.id, file);
            });
            dispatch(addAttachments(drafts));
            setRecordingState("idle");
          } catch (error) {
            setRecordingError(error instanceof Error ? error.message : "录音处理失败，请重试。");
            setRecordingState("idle");
          }
        },
        { once: true }
      );

      recorder.start(250);
      setRecordingState("recording");
      recordingAutoStopTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, RECORDING_MAX_MS);
    } catch (error) {
      stopRecordingStream();
      mediaRecorderRef.current = null;
      setRecordingState("idle");
      setRecordingError(error instanceof Error ? `无法启动录音：${error.message}` : "无法启动录音。");
    }
  }, [dispatch, stopRecording, stopRecordingStream]);

  const toggleRecording = useCallback(() => {
    if (recordingState === "processing") {
      return;
    }
    if (recordingState === "recording") {
      stopRecording();
      return;
    }
    void startRecording();
  }, [recordingState, startRecording, stopRecording]);

  const removeAttachmentDraft = useCallback(
    (attachmentId: string) => {
      pendingFilesRef.current.delete(attachmentId);
      dispatch(removeAttachment(attachmentId));
    },
    [dispatch]
  );

  const openSuggestionGuide = useCallback(
    (chip: SuggestionChip) => {
      pauseAtmosphere();
      setPendingSuggestionChip(chip);
    },
    [pauseAtmosphere]
  );

  const closeSuggestionGuide = useCallback(() => {
    setPendingSuggestionChip(null);
    resumeAtmosphere();
  }, [resumeAtmosphere]);

  const handleModuleSelect = useCallback(
    (moduleId: ModuleId) => {
      setActiveModule(moduleId);
      if (isPortraitMobile) {
        setMobileDrawerOpen(false);
      }
    },
    [isPortraitMobile]
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
        const message = error instanceof Error ? error.message : "连接已中断。";
        dispatch(failRun(message));
        if (message.includes("BFF_UNAUTHORIZED")) {
          setPaymentFeedback("请先登录后再开始对话。");
          openAuthDialog();
        }
      }
    },
    [dispatch, handleEvent, openAuthDialog]
  );

  const handleSend = useCallback(
    async (forcedText?: string) => {
      const text = (forcedText ?? chat.composerText).trim();
      if (!text && chat.attachments.length === 0) {
        return;
      }
      if (!authSession?.sessionToken) {
        setPaymentFeedback("请先登录后再开始对话。");
        openAuthDialog();
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
    [authSession?.sessionToken, chat.attachments, chat.composerText, chat.conversationId, dispatch, openAuthDialog, persistConversationId, removePendingFiles, startStream]
  );

  const launchIntentConversation = useCallback(
    async (prompt: string) => {
      const nextPrompt = prompt.trim();
      if (!nextPrompt) {
        return;
      }

      const activeRunId = chat.stream.runId;
      if (activeRunId) {
        try {
          streamAbortRef.current?.abort();
          await stopRun(activeRunId);
        } catch {
          // ignore stop failure when switching to a fresh intent context
        } finally {
          clearActiveRun();
        }
      } else {
        clearActiveRun();
      }

      pendingFilesRef.current.clear();
      const conversationId = createConversationId();
      persistConversationId(conversationId);
      setFollowLatest(true);
      setHasUnreadBelow(false);
      setShowJumpBottom(false);
      setUnreadUpdateCount(0);
      dispatch(
        startFreshConversation({
          conversationId,
          composerText: nextPrompt
        })
      );
      dispatch(
        appendUserMessage({
          conversationId,
          text: nextPrompt,
          attachments: []
        })
      );
      dispatch(clearComposer());
      await startStream(nextPrompt, conversationId, []);
    },
    [chat.stream.runId, clearActiveRun, dispatch, persistConversationId, startStream]
  );

  const handleContinueSuggestion = useCallback(async () => {
    if (!pendingSuggestionChip) {
      return;
    }

    if (pendingSuggestionChip.lane === "school") {
      setSelectedSchool(pendingSuggestionChip.label as (typeof PSYCHOLOGY_SCHOOLS)[number]);
    }

    const prompt = pendingSuggestionChip.kickoffPrompt;
    closeSuggestionGuide();
    await launchIntentConversation(prompt);
  }, [closeSuggestionGuide, launchIntentConversation, pendingSuggestionChip]);

  const openHistoryConversation = useCallback(
    async (conversationId: string) => {
      const nextConversationId = conversationId.trim();
      if (!nextConversationId) {
        return;
      }

      const activeRunId = chat.stream.runId;
      if (activeRunId) {
        try {
          streamAbortRef.current?.abort();
          await stopRun(activeRunId);
        } catch {
          // ignore stop failure when switching to a stored conversation
        } finally {
          clearActiveRun();
        }
      } else {
        clearActiveRun();
      }

      try {
        setHistoryOpeningId(nextConversationId);
        const history = await fetchConversationHistory({
          conversationId: nextConversationId,
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
              status: "completed",
              thinking: item.thinking,
              actions: item.actions
            }))
          })
        );
        persistConversationId(history.conversationId);
        setFollowLatest(true);
        setHasUnreadBelow(false);
        setShowJumpBottom(false);
        setUnreadUpdateCount(0);
        handleModuleSelect("explore");
      } catch (error) {
        setHistoryError(error instanceof Error ? error.message : "历史对话加载失败。");
      } finally {
        setHistoryOpeningId(null);
      }
    },
    [chat.stream.runId, clearActiveRun, dispatch, handleModuleSelect, persistConversationId]
  );

  const copyMessage = useCallback(async (messageId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current));
      }, 1600);
    } catch {
      setCopiedMessageId(null);
    }
  }, []);

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
        setRecovering(false);

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
    if (recordingState !== "recording") {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (recordingState === "idle") {
        setRecordingElapsedMs(0);
      }
      return;
    }

    const startedAt = Date.now();
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingElapsedMs(Date.now() - startedAt);
    }, 200);

    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [recordingState]);

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
              status: "completed",
              thinking: item.thinking,
              actions: item.actions
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
    if (activeModule !== "history" && activeModule !== "memory-map") {
      return;
    }

    let cancelled = false;
    const loadConversationSummaries = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        const page = await fetchConversationSummaries({
          pageNo: historyPageNo,
          pageSize: HISTORY_PAGE_SIZE,
          keyword: historyKeyword
        });
        if (cancelled) {
          return;
        }
        if (page.items.length === 0 && page.total > 0 && historyPageNo > 1) {
          setHistoryPageNo((current) => Math.max(1, current - 1));
          return;
        }
        setHistorySummaries(page.items);
        setHistoryTotal(page.total);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setHistorySummaries([]);
        setHistoryTotal(0);
        setHistoryError(error instanceof Error ? error.message : "历史对话加载失败。");
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void loadConversationSummaries();
    return () => {
      cancelled = true;
    };
  }, [activeModule, historyKeyword, historyPageNo, historyRefreshKey]);

  const handleDeleteHistoryConversation = useCallback(
    async (conversationId: string) => {
      const nextConversationId = conversationId.trim();
      if (!nextConversationId) {
        return;
      }

      const matched = historySummaries.find((item) => item.conversationId === nextConversationId);
      const title = matched?.title ?? "该历史会话";
      if (!window.confirm(`确认删除“${title}”吗？删除后将无法在历史列表中恢复。`)) {
        return;
      }

      try {
        setHistoryDeletingId(nextConversationId);
        setHistoryError(null);
        await deleteConversationHistory(nextConversationId);
        if (historySummaries.length === 1 && historyPageNo > 1) {
          setHistoryPageNo((page) => Math.max(1, page - 1));
        } else {
          setHistoryRefreshKey((value) => value + 1);
        }
      } catch (error) {
        setHistoryError(error instanceof Error ? error.message : "历史对话删除失败。");
      } finally {
        setHistoryDeletingId(null);
      }
    },
    [historyPageNo, historySummaries]
  );

  useEffect(() => {
    if (!pendingSuggestionChip) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSuggestionGuide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeSuggestionGuide, pendingSuggestionChip]);

  useEffect(() => {
    setAuthSession(getAuthSession());
  }, []);

  useEffect(() => {
    if (!authDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAuthDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [authDialogOpen, closeAuthDialog]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 768px) and (orientation: portrait)");

    const syncDrawerMode = () => {
      const matches = mediaQuery.matches;
      setIsPortraitMobile(matches);

      if (!matches) {
        if (drawerAutoCloseTimerRef.current) {
          window.clearTimeout(drawerAutoCloseTimerRef.current);
          drawerAutoCloseTimerRef.current = null;
        }
        setMobileDrawerOpen(false);
        return;
      }

      const seen = window.localStorage.getItem(MOBILE_DRAWER_SEEN_KEY);
      if (!seen) {
        setMobileDrawerOpen(true);
        window.localStorage.setItem(MOBILE_DRAWER_SEEN_KEY, "1");
        drawerAutoCloseTimerRef.current = window.setTimeout(() => {
          setMobileDrawerOpen(false);
          drawerAutoCloseTimerRef.current = null;
        }, 3000);
      }
    };

    syncDrawerMode();
    mediaQuery.addEventListener("change", syncDrawerMode);

    return () => {
      if (drawerAutoCloseTimerRef.current) {
        window.clearTimeout(drawerAutoCloseTimerRef.current);
        drawerAutoCloseTimerRef.current = null;
      }
      mediaQuery.removeEventListener("change", syncDrawerMode);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (recordingAutoStopTimerRef.current) {
        window.clearTimeout(recordingAutoStopTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      stopRecordingStream();
    };
  }, [stopRecordingStream]);

  useEffect(() => {
    adjustComposerHeight();
  }, [adjustComposerHeight, chat.composerText]);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) {
      return;
    }

    const syncHeight = () => {
      setToolbarHeight(toolbar.getBoundingClientRect().height);
    };

    syncHeight();

    const observer = new ResizeObserver(() => {
      syncHeight();
    });
    observer.observe(toolbar);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (hasConversation) {
      return;
    }

    const memoryHost = memoryLaneRef.current;
    const exploreHost = exploreLaneRef.current;
    if (!memoryHost || !exploreHost) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frameId = 0;
    let lastFrame = performance.now();

    const rebuild = () => {
      const memoryWidth = memoryHost.clientWidth;
      const exploreWidth = exploreHost.clientWidth;
      if (memoryWidth > 0) {
        setMemoryChips(createLaneChips([...MEMORY_SUGGESTION_SEEDS, ...SCHOOL_SUGGESTION_SEEDS], memoryWidth, "top"));
      }
      if (exploreWidth > 0) {
        setExploreChips(createLaneChips(EXPLORE_SUGGESTION_SEEDS, exploreWidth, "bottom"));
      }
    };

    rebuild();

    const observer = new ResizeObserver(() => {
      rebuild();
    });
    observer.observe(memoryHost);
    observer.observe(exploreHost);

    if (!reduceMotion) {
      const tick = (now: number) => {
        const dt = Math.min(24, now - lastFrame);
        lastFrame = now;

        if (!animationPausedRef.current) {
          const memoryWidth = memoryHost.clientWidth;
          const exploreWidth = exploreHost.clientWidth;
          setMemoryChips((prev) => (prev.length === 0 ? prev : animateLaneChips(prev, memoryWidth, dt)));
          setExploreChips((prev) => (prev.length === 0 ? prev : animateLaneChips(prev, exploreWidth, dt)));
        }

        frameId = window.requestAnimationFrame(tick);
      };

      frameId = window.requestAnimationFrame(tick);
    }

    return () => {
      observer.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [hasConversation]);

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
          quotaState: account.quotaState,
          seedUser: Boolean(account.seedUser),
          paymentChannel: account.paymentChannel ?? "alipay",
          recommendedPlanId: account.recommendedPlanId
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
    if (activeModule !== "profile" && !authDialogOpen) {
      return;
    }

    let cancelled = false;
    const loadBillingPlans = async () => {
      try {
        setBillingPlansLoading(true);
        setBillingPlansError(null);
        const response = await fetchBillingPlans();
        if (cancelled) {
          return;
        }
        setBillingPlans(response.items);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBillingPlans([]);
        setBillingPlansError(error instanceof Error ? error.message : "套餐信息加载失败。");
      } finally {
        if (!cancelled) {
          setBillingPlansLoading(false);
        }
      }
    };

    void loadBillingPlans();
    return () => {
      cancelled = true;
    };
  }, [activeModule, authDialogOpen]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !followLatest) {
      return;
    }
    scrollToLatest(chat.stream.status === "streaming" ? "smooth" : "auto");
  }, [chat.messages, chat.stream.status, chat.stream.thinking, followLatest, scrollToLatest]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || followLatest || recovering) {
      return;
    }
    setHasUnreadBelow(true);
    setUnreadUpdateCount((count) => Math.min(count + 1, 99));
    syncBottomAffordance(container);
  }, [followLatest, latestAssistantSnapshot, recovering, syncBottomAffordance]);

  useEffect(() => {
    return () => {
      if (autoScrollReleaseTimerRef.current) {
        window.clearTimeout(autoScrollReleaseTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="chat-app-shell">
      <header className="toolbar" ref={toolbarRef}>
        <div className="toolbar-primary">
          <div className="brand">
            <Image src="/phyok-logo.png" alt="Phyok" width={36} height={36} className="brand-logo" priority />
            <div className="brand-copy">
              <div className="brand-title">心理学空间</div>
              <div className="brand-subtitle">自我探索Agent Pro</div>
            </div>
          </div>
          <div className="toolbar-slogan">在稳定的心理学坐标里，学习自己，也向更深处继续探索。</div>
        </div>
        <div className="toolbar-actions">
          {isPortraitMobile ? (
            <div className="toolbar-mobile-actions">
              <button
                type="button"
                className="toolbar-drawer-toggle"
                aria-label={mobileDrawerOpen ? "收起模块抽屉" : "展开模块抽屉"}
                title={mobileDrawerOpen ? "收起模块抽屉" : "展开模块抽屉"}
                onClick={() => setMobileDrawerOpen((value) => !value)}
              >
                <DrawerToggleIcon />
                <span className="toolbar-drawer-copy">
                  <strong>{mobileDrawerOpen ? "模块已展开" : "模块抽屉"}</strong>
                  <small>{mobileDrawerOpen ? "轻触收起" : "轻触展开"}</small>
                </span>
              </button>
              <div className="toolbar-mobile-shortcuts">
                <button
                  type="button"
                  className="toolbar-quick-action icon-only"
                  aria-label="新建上下文"
                  title="新建上下文"
                  onClick={() => void handleStartFreshContext()}
                >
                  <NewContextIcon />
                </button>
                <button
                  type="button"
                  className="toolbar-quick-action icon-only"
                  aria-label={authSession ? `当前账号 ${authSession.email}` : "邮箱登录"}
                  title={authSession ? authSession.email : "邮箱登录"}
                  onClick={openAuthDialog}
                >
                  <AccountEntryIcon />
                </button>
              </div>
            </div>
          ) : null}
          {!isPortraitMobile ? (
            <>
              <button
                type="button"
                className="toolbar-quick-action icon-only"
                aria-label="新建上下文"
                title="新建上下文"
                onClick={() => void handleStartFreshContext()}
              >
                <NewContextIcon />
              </button>
              <button
                type="button"
                className={`toolbar-login ${authSession ? "" : "icon-only"}`.trim()}
                aria-label={authSession ? `已登录，当前账号 ${authSession.email}` : "邮箱登录"}
                title={authSession ? authSession.email : "邮箱登录"}
                onClick={openAuthDialog}
              >
                {authSession ? authSession.email : <AccountEntryIcon />}
              </button>
            </>
          ) : null}
        </div>
      </header>

      <main className="chat-layout">
        {isPortraitMobile && mobileDrawerOpen ? (
          <button
            type="button"
            className="mobile-drawer-backdrop"
            aria-label="关闭模块抽屉"
            onClick={() => setMobileDrawerOpen(false)}
            style={{
              top: `${toolbarHeight + 12}px`
            }}
          />
        ) : null}

        <aside
          className={`workspace-sidebar ${isPortraitMobile ? "drawer-mode" : ""} ${mobileDrawerOpen ? "open" : ""}`}
          style={
            isPortraitMobile
              ? {
                  top: `${toolbarHeight + 12}px`,
                  height: `calc(100dvh - ${toolbarHeight + 24}px)`
                }
              : undefined
          }
        >
          <div className="sidebar-section-label">模块导航</div>
          <div className="module-nav">
            <div className={`module-nav-expandable ${explorePanelOpen ? "open" : ""}`}>
              <button
                type="button"
                className={`module-nav-item module-nav-item-expandable ${activeModule === "explore" ? "active" : ""}`}
                onClick={() => {
                  setExplorePanelOpen((value) => !value);
                  handleModuleSelect("explore");
                }}
              >
                <span className="module-nav-title">自我探索Agent Pro</span>
                <span className="module-nav-subtitle">记忆与探索意图</span>
                <span className="module-nav-caret">{explorePanelOpen ? "收起" : "展开"}</span>
              </button>
              {explorePanelOpen ? (
                <div className="module-intent-panel">
                  <div className="module-intent-group">
                    <div className="module-intent-title">记忆</div>
                    <div className="module-intent-grid">
                      {MEMORY_INTENTS.map((intent) => (
                        <button
                          key={intent}
                          type="button"
                          className="module-intent-chip"
                          onClick={() => {
                            handleModuleSelect("explore");
                            void launchIntentConversation(MEMORY_INTENT_PROMPTS[intent]);
                          }}
                        >
                          {intent}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="module-intent-group">
                    <div className="module-intent-title">探索</div>
                    <div className="module-intent-grid">
                      <label className="module-intent-select">
                        <span>探索心理学</span>
                        <select
                          value={selectedSchool}
                          onChange={(event) => {
                            const nextSchool = event.target.value as (typeof PSYCHOLOGY_SCHOOLS)[number];
                            setSelectedSchool(nextSchool);
                            handleModuleSelect("explore");
                            void launchIntentConversation(buildSchoolIntentPrompt(nextSchool));
                          }}
                        >
                          {PSYCHOLOGY_SCHOOLS.map((school) => (
                            <option key={school} value={school}>
                              {school}
                            </option>
                          ))}
                        </select>
                      </label>
                      {EXPLORE_INTENTS.map((intent) => (
                        <button
                          key={intent}
                          type="button"
                          className="module-intent-chip"
                          onClick={() => {
                            handleModuleSelect("explore");
                            void launchIntentConversation(buildExploreIntentPrompt(intent));
                          }}
                        >
                          {intent}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {MODULES.slice(1).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`module-nav-item ${activeModule === item.id ? "active" : ""}`}
                onClick={() => handleModuleSelect(item.id)}
              >
                <span className="module-nav-title">{item.title}</span>
                <span className="module-nav-subtitle">{item.subtitle}</span>
              </button>
            ))}
          </div>

          {hasConversation ? (
            <div className="sidebar-card sidebar-card-focus">
              <div className="sidebar-card-kicker">{activeModuleItem.subtitle}</div>
              <div className="sidebar-card-title">{activeModuleItem.title}</div>
            </div>
          ) : null}

          {hasConversation ? (
            <div className="sidebar-card">
              <div className="sidebar-card-kicker">当前账号</div>
              <div className="sidebar-account-row">
                <span>{authSession ? authSession.email : "未登录"}</span>
                <button type="button" className="sidebar-link-button" onClick={openAuthDialog}>
                  {authSession ? "更换账号" : "去登录"}
                </button>
              </div>
              {billingSummary ? (
                <div className="sidebar-metric">
                  <strong>{billingSummary.remainingTokens.toLocaleString("zh-CN")}</strong>
                  <span>
                    {billingSummary.plan} · {billingSummary.quotaState}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="sidebar-bottom-meta">
            {isPortraitMobile ? (
              <div className="sidebar-mobile-footer">
                <button
                  type="button"
                  className={`toolbar-login sidebar-footer-login ${authSession ? "" : "icon-only"}`.trim()}
                  aria-label={authSession ? `已登录，当前账号 ${authSession.email}` : "邮箱登录"}
                  title={authSession ? authSession.email : "邮箱登录"}
                  onClick={openAuthDialog}
                >
                  {authSession ? authSession.email : <AccountEntryIcon />}
                </button>
              </div>
            ) : null}
            <div className="sidebar-filing">
              <span className="sidebar-filing-line">ICP备案：吉ICP备17004852号-2</span>
              <span className="sidebar-filing-line">© SimonWZB 2026</span>
            </div>
          </div>
        </aside>

        <section className="chat-stage">
          {activeModule === "history" ? (
            <div className="history-stage">
              <div className="history-stage-header">
                <div>
                  <div className="history-stage-kicker">历史对话</div>
                  <h2>按会话浏览你的探索上下文</h2>
                </div>
                <div className="history-stage-meta">
                  <span>共 {historyTotal} 个会话</span>
                  <span>
                    第 {Math.min(historyPageNo, historyTotalPages)} / {historyTotalPages} 页
                  </span>
                </div>
              </div>

              <div className="history-toolbar">
                <label className="history-search">
                  <span>搜索历史</span>
                  <input
                    type="search"
                    value={historyKeyword}
                    placeholder="搜索主题、摘要或会话内容"
                    onChange={(event) => {
                      setHistoryKeyword(event.target.value);
                      setHistoryPageNo(1);
                    }}
                  />
                </label>
              </div>

              {historyError ? <div className="history-stage-banner error">{historyError}</div> : null}

              {historyLoading ? (
                <div className="history-grid">
                  {Array.from({ length: HISTORY_PAGE_SIZE }, (_, index) => (
                    <div key={`history-skeleton-${index}`} className="history-card skeleton" aria-hidden="true">
                      <div className="history-skeleton-line short" />
                      <div className="history-skeleton-line medium" />
                      <div className="history-skeleton-line long" />
                    </div>
                  ))}
                </div>
              ) : historySummaries.length === 0 ? (
                <div className="history-empty-state">
                  <div className="history-empty-title">还没有可管理的历史对话</div>
                  <p>从左侧意图或输入框开启一轮探索后，这里会自动沉淀成可继续浏览的会话卡片。</p>
                </div>
              ) : (
                <div className="history-grid">
                  {historySummaries.map((item) => (
                    <article key={item.conversationId} className="history-card">
                      <div className="history-card-meta">
                        <span>{formatHistoryTime(item.updatedAt)}</span>
                        <span>{formatHistoryStatus(item.status)}</span>
                      </div>
                      <div className="history-card-title">{item.title}</div>
                      <div className="history-card-preview">{shortenHistoryText(item.latestPreview)}</div>
                      <div className="history-card-stats">
                        <span>{item.turnCount} 轮</span>
                        <span>{item.attachmentCount} 个附件</span>
                      </div>
                      <div className="history-card-actions">
                        <button
                          type="button"
                          className="history-open-button"
                          onClick={() => void openHistoryConversation(item.conversationId)}
                          disabled={historyOpeningId === item.conversationId || historyDeletingId === item.conversationId}
                        >
                          {historyOpeningId === item.conversationId ? "正在打开..." : "打开会话"}
                        </button>
                        <button
                          type="button"
                          className="history-delete-button"
                          onClick={() => void handleDeleteHistoryConversation(item.conversationId)}
                          disabled={historyDeletingId === item.conversationId || historyOpeningId === item.conversationId}
                        >
                          {historyDeletingId === item.conversationId ? "删除中..." : "删除"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="history-pagination">
                <button
                  type="button"
                  className="history-page-button"
                  onClick={() => setHistoryPageNo((page) => Math.max(1, page - 1))}
                  disabled={historyPageNo <= 1 || historyLoading}
                >
                  上一页
                </button>
                <div className="history-pagination-status">
                  第 {Math.min(historyPageNo, historyTotalPages)} 页，共 {historyTotalPages} 页
                </div>
                <button
                  type="button"
                  className="history-page-button"
                  onClick={() => setHistoryPageNo((page) => Math.min(historyTotalPages, page + 1))}
                  disabled={historyPageNo >= historyTotalPages || historyLoading}
                >
                  下一页
                </button>
              </div>
            </div>
          ) : activeModule === "memory-map" ? (
            <MemoryStarMapPanel
              currentConversationId={chat.conversationId}
              currentUserId={authSession?.userId ?? null}
              refreshKey={memoryMapRefreshKey}
              onOpenConversation={(conversationId) => openHistoryConversation(conversationId)}
            />
          ) : activeModule === "profile" ? (
            <div className="profile-stage">
              <div className="profile-stage-header">
                <div>
                  <div className="history-stage-kicker">我的</div>
                  <h2>管理你的账号、可用额度与支付</h2>
                </div>
                {authSession ? (
                  <button type="button" className="toolbar-login" onClick={handleLogout}>
                    退出当前账号
                  </button>
                ) : (
                  <button
                    type="button"
                    className="toolbar-login icon-only"
                    aria-label="邮箱登录"
                    title="邮箱登录"
                    onClick={openAuthDialog}
                  >
                    <AccountEntryIcon />
                  </button>
                )}
              </div>

              <div className="profile-grid">
                <article className="profile-card">
                  <div className="sidebar-card-kicker">账户信息</div>
                  {authSession ? (
                    <>
                      <h3>{authSession.email}</h3>
                      <p>你已登录，可以继续对话、查看额度并完成支付。</p>
                    </>
                  ) : (
                    <>
                      <h3>还未登录</h3>
                      <p>登录后即可查看额度，并通过支付宝完成购买。</p>
                      <button type="button" className="send-button profile-primary-button" onClick={openAuthDialog}>
                        立即登录
                      </button>
                    </>
                  )}
                </article>

                <article className="profile-card">
                  <div className="sidebar-card-kicker">可用额度</div>
                  {billingSummary ? (
                    <>
                      <h3>{billingSummary.remainingTokens.toLocaleString("zh-CN")}</h3>
                      <p>
                        {billingSummary.plan} · {billingSummary.quotaState} · {billingSummary.paymentChannel}
                      </p>
                      <div className="profile-account-meta">
                        <span>适合你的方案 · {billingSummary.recommendedPlanId ?? "standard"}</span>
                        <span>支付方式 · {billingSummary.paymentChannel}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>登录后查看</h3>
                      <p>登录后可查看当前额度，并通过支付宝完成购买。</p>
                    </>
                  )}
                </article>
              </div>

              {paymentFeedback ? <div className="profile-stage-banner">{paymentFeedback}</div> : null}

              {lastPaymentOrder ? (
                <div className="profile-order-card">
                  <div>
                    <div className="sidebar-card-kicker">最近支付宝订单</div>
                    <strong>{lastPaymentOrder.orderNo}</strong>
                  </div>
                  <div className="profile-order-actions">
                    <a href={lastPaymentOrder.payUrl} target="_blank" rel="noreferrer" className="toolbar-login">
                      前往支付
                    </a>
                    <a href={lastPaymentOrder.qrCodeUrl} target="_blank" rel="noreferrer" className="toolbar-login">
                      查看二维码
                    </a>
                  </div>
                </div>
              ) : null}

              <div className="profile-plan-section">
                <div className="profile-plan-header">
                  <div>
                    <div className="sidebar-card-kicker">可选方案</div>
                    <h3>选择更适合你的使用方式</h3>
                  </div>
                </div>
                {billingPlansError ? <div className="history-stage-banner error">{billingPlansError}</div> : null}
                <div className="profile-plan-grid">
                  {billingPlansLoading
                    ? Array.from({ length: 3 }, (_, index) => (
                        <article key={`plan-skeleton-${index}`} className="profile-plan-card skeleton" aria-hidden="true" />
                      ))
                    : billingPlans.map((plan) => (
                        <article
                          key={plan.id}
                          className={`profile-plan-card ${plan.recommended ? "recommended" : ""} ${
                            billingSummary?.recommendedPlanId === plan.id ? "active" : ""
                          }`}
                        >
                          <div className="profile-plan-topline">
                            <strong>{plan.name}</strong>
                            <span>{(plan.priceFen / 100).toFixed(2)} 元</span>
                          </div>
                          <div className="profile-plan-quota">{plan.quota} 次使用额度</div>
                          <p>{plan.description}</p>
                          {plan.highlight ? <div className="profile-plan-highlight">{plan.highlight}</div> : null}
                          <button
                            type="button"
                            className="send-button profile-primary-button"
                            disabled={payingPlanId === plan.id}
                            onClick={() => void handleCreateAlipayOrder(plan.id)}
                          >
                            {payingPlanId === plan.id ? "创建中..." : "支付宝购买"}
                          </button>
                        </article>
                      ))}
                </div>
              </div>
            </div>
          ) : (
          <div className={`chat-stage-inner ${hasConversation ? "has-conversation" : "is-idle"}`}>
            <div
              className={`message-scroll ${showTimeline ? "visible" : "hidden"}`}
              ref={scrollRef}
              onWheel={() => {
                pauseFollowLatest();
              }}
              onTouchMove={() => {
                pauseFollowLatest();
              }}
              onScroll={(event) => {
                const container = event.currentTarget;
                const nearBottom = isNearBottom(container);

                if (autoScrollingRef.current && !manualScrollIntentRef.current) {
                  return;
                }

                if (manualScrollIntentRef.current || userDetachedScrollRef.current) {
                  setFollowLatest(false);
                } else {
                  setFollowLatest(nearBottom);
                }
                manualScrollIntentRef.current = false;
                if (nearBottom && !userDetachedScrollRef.current) {
                  autoScrollingRef.current = false;
                  setUnreadUpdateCount(0);
                }
                syncBottomAffordance(container);
              }}
            >
              {recovering ? (
                <div className="empty-state">
                  <div className="empty-title">正在恢复上一次会话…</div>
                </div>
              ) : null}

              {chat.messages.map((message) => {
                const messageTime = new Date(message.createdAt).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit"
                });
                const isAssistant = message.role === "assistant";
                const isStreamingAssistant =
                  isAssistant && message.status === "streaming" && message.id === latestAssistantSnapshot.id;
                const thinkingSummary = extractThinkingSummary(
                  message.thinking ?? "",
                  message.status === "streaming" ? "正在整理本轮推理与总结" : "暂无 thinking 摘要"
                );
                const ragCitations = (message.citations ?? []).filter(
                  (citation) => citation.source === "memory_fragments" || citation.source === "knowledge_base"
                );
                const usageSummaryText = message.usage
                  ? summarizeUsage(
                      message.usage.inputChars,
                      message.usage.outputChars,
                      message.usage.attachmentCount
                    )
                  : "等待生成统计";
                const renderedText = message.text || "正在组织回应…";

                return (
                  <article key={message.id} className={`message-card ${message.role} ${isStreamingAssistant ? "streaming" : ""}`}>
                    <div className="message-meta">
                      <span>{isAssistant ? "Agent" : "你"}</span>
                      <span>{messageTime}</span>
                    </div>

                    {isAssistant && message.riskAlert ? (
                      <div className={`message-risk-alert ${message.riskAlert.severity}`}>
                        <strong>{message.riskAlert.title}</strong>
                        <p>{message.riskAlert.message}</p>
                      </div>
                    ) : null}

                    {isAssistant &&
                    (message.thinking || message.toolSteps?.length || ragCitations.length > 0 || message.usage || message.warnings?.length) ? (
                      <div className="message-summary-list">
                        <details className="message-summary-card" open={message.status === "streaming"}>
                          <summary>
                            <span className="message-summary-title">过程摘要</span>
                            <span className="message-summary-value">{thinkingSummary}</span>
                          </summary>
                          <div className="message-summary-body">
                            {message.toolSteps && message.toolSteps.length > 0 ? (
                              <div className="message-tools">
                                {message.toolSteps.map((tool) => (
                                  <div
                                    key={tool.tool}
                                    className={`message-tool-chip ${tool.status === "completed" ? "done" : "running"}`}
                                  >
                                    <span className="message-tool-dot" />
                                    <span>{tool.label}</span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {message.warnings && message.warnings.length > 0 ? (
                              <div className="message-warning-list">
                                {message.warnings.map((warning, index) => (
                                  <div key={`${warning.message}-${index}`} className="message-warning-chip">
                                    {warning.message}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {message.thinking ? (
                              <div className="thinking-panel">
                                <pre>{message.thinking}</pre>
                              </div>
                            ) : null}
                          </div>
                        </details>

                        {ragCitations.length > 0 ? (
                          <details className="message-summary-card">
                            <summary>
                              <span className="message-summary-title">论据</span>
                              <span className="message-summary-value">{`命中 ${ragCitations.length} 条 RAG 依据`}</span>
                            </summary>
                            <div className="message-summary-body">
                              <div className="message-citations">
                                {ragCitations.slice(0, 4).map((citation, index) => (
                                  <div key={`${citation.source}-${citation.title}-${index}`} className="message-citation-card">
                                    <div className="message-citation-meta">
                                      <span>{citation.source === "memory_fragments" ? "记忆依据" : "知识依据"}</span>
                                      {typeof citation.score === "number" ? <span>{citation.score.toFixed(2)}</span> : null}
                                    </div>
                                    <strong>{citation.title}</strong>
                                    <p>{citation.content}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </details>
                        ) : null}

                        <details className="message-summary-card">
                          <summary>
                            <span className="message-summary-title">运行统计</span>
                            <span className="message-summary-value">{usageSummaryText}</span>
                          </summary>
                          <div className="message-summary-body">
                            {message.usage ? (
                              <div className="message-usage">
                                <span>输入 {message.usage.inputChars}</span>
                                <span>输出 {message.usage.outputChars}</span>
                                <span>附件 {message.usage.attachmentCount}</span>
                              </div>
                            ) : (
                              <div className="message-summary-empty">等待本轮输出完成后生成统计。</div>
                            )}
                          </div>
                        </details>
                      </div>
                    ) : null}

                    {isAssistant ? (
                      <div className="message-output">
                        {isStreamingAssistant ? <div className="message-stream-progress" aria-hidden="true" /> : null}
                        <div className="message-output-toolbar">
                          <div className="message-output-status">
                            <span className="message-output-label">最终回答</span>
                            {isStreamingAssistant ? (
                              <span className="message-live-chip">
                                <span className="message-live-dot" />
                                <span>生成中</span>
                              </span>
                            ) : null}
                          </div>
                          <button type="button" className="message-copy-button" onClick={() => void copyMessage(message.id, renderedText)}>
                            {copiedMessageId === message.id ? "已复制" : "复制"}
                          </button>
                        </div>
                        <div className="message-content message-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{renderedText}</ReactMarkdown>
                          {message.status === "streaming" ? <span className="message-cursor" aria-hidden="true" /> : null}
                        </div>
                      </div>
                    ) : (
                      <div className="message-content">{renderedText}</div>
                    )}

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
                );
              })}

              <div ref={anchorRef} />

              {showJumpBottom || hasUnreadBelow ? (
                <div className="message-scroll-affordances">
                  {hasUnreadBelow ? (
                    <button type="button" className="new-content-toast" onClick={() => scrollToLatest("smooth")}>
                      {chat.stream.status === "streaming"
                        ? `新内容到达${unreadUpdateCount > 0 ? ` · ${unreadUpdateCount}` : ""}`
                        : `有新消息到达${unreadUpdateCount > 0 ? ` · ${unreadUpdateCount}` : ""}`}
                    </button>
                  ) : null}
                  {showJumpBottom ? (
                    <button type="button" className="scroll-to-bottom-button" onClick={() => scrollToLatest("smooth")}>
                      回到底部{unreadUpdateCount > 0 ? ` (${unreadUpdateCount})` : ""}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className={`composer-shell ${hasConversation ? "docked" : "centered"}`}>
              {hasConversation || uploading || chat.stream.status !== "idle" ? (
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
              ) : null}

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

              <div className={`composer-atmosphere ${animationPaused ? "paused" : ""}`}>
                {!hasConversation ? (
                  <div className="composer-orbits" aria-hidden="true">
                    <div className="orbit orbit-a" />
                    <div className="orbit orbit-b" />
                    <div className="orbit orbit-c" />
                    <div className="orbit orbit-d" />
                  </div>
                ) : null}

                {!hasConversation ? (
                  <div className="composer-suggestion-shell">
                    <div className="composer-suggestion-band top" onMouseLeave={resumeAtmosphere}>
                      <div
                        className="composer-suggestion-row floating"
                        ref={memoryLaneRef}
                        style={{ height: `${getSuggestionLaneHeight(memoryChips)}px` }}
                      >
                        {memoryChips.map((chip) => (
                          (() => {
                            const visuals = getSuggestionChipVisuals(chip);
                            return (
                          <button
                            key={chip.id}
                            type="button"
                            className={`composer-suggestion-chip ${chip.lane}`}
                            style={{
                              width: `${chip.width}px`,
                              opacity: visuals.opacity,
                              zIndex: visuals.zIndex,
                              transform: `translate3d(${chip.x}px, ${chip.row * SUGGESTION_ROW_STRIDE + Math.sin(chip.bobPhase) * chip.bobAmplitude}px, 0) scale(${visuals.scale})`
                            }}
                            onMouseEnter={pauseAtmosphere}
                            onFocus={pauseAtmosphere}
                            onBlur={resumeAtmosphere}
                            onClick={() => openSuggestionGuide(chip)}
                          >
                            <span>{chip.label}</span>
                          </button>
                            );
                          })()
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="composer-card">
                  <textarea
                    ref={composerInputRef}
                    value={chat.composerText}
                    onChange={(event) => {
                      dispatch(setComposerText(event.target.value));
                      adjustComposerHeight();
                    }}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) {
                        return;
                      }
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="说说此刻的感受，或带上一张图片、一段语音、一份文档。"
                    rows={1}
                    disabled={composerDisabled}
                  />

                  <div className="composer-actions">
                    <div className="composer-left">
                      <button
                        type="button"
                        className="composer-tool-button"
                        aria-label="上传文档"
                        title="上传文档"
                        onClick={() => docInputRef.current?.click()}
                      >
                        <ComposerToolIcon kind="document" />
                      </button>
                      <button
                        type="button"
                        className="composer-tool-button"
                        aria-label="上传图片"
                        title="上传图片"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <ComposerToolIcon kind="image" />
                      </button>
                      <button
                        type="button"
                        className={`composer-tool-button ${recordingState === "recording" ? "recording" : ""} ${
                          recordingState === "processing" ? "processing" : ""
                        }`}
                        aria-label={
                          recordingState === "recording"
                            ? `结束录音，当前已录 ${formatDuration(recordingElapsedMs)}`
                            : recordingState === "processing"
                              ? "录音处理中"
                              : "开始录音"
                        }
                        title={
                          recordingState === "recording"
                            ? `结束录音，当前已录 ${formatDuration(recordingElapsedMs)}`
                            : recordingState === "processing"
                              ? "录音处理中"
                              : "开始录音"
                        }
                        onClick={toggleRecording}
                        disabled={uploading || chat.stream.status === "streaming" || chat.stream.status === "reconnecting"}
                      >
                        <ComposerToolIcon
                          kind={
                            recordingState === "recording"
                              ? "recording"
                              : recordingState === "processing"
                                ? "processing"
                                : "record"
                          }
                        />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="send-button icon-only"
                      aria-label="发送"
                      title="发送"
                      onClick={() => void handleSend()}
                      disabled={composerDisabled || (!chat.composerText.trim() && chat.attachments.length === 0)}
                    >
                      <SendActionIcon />
                    </button>
                  </div>

                  {recordingState === "recording" ? (
                    <div className="recording-wave-panel" aria-hidden="true">
                      <div className="recording-wave-bars">
                        {recordingLevels.map((level, index) => (
                          <span
                            key={`recording-wave-${index}`}
                            className="recording-wave-bar"
                            style={{ transform: `scaleY(${level})` }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {!hasConversation ? (
                  <div className="composer-suggestion-shell">
                    <div className="composer-suggestion-band bottom" onMouseLeave={resumeAtmosphere}>
                      <div
                        className="composer-suggestion-row floating"
                        ref={exploreLaneRef}
                        style={{ height: `${getSuggestionLaneHeight(exploreChips)}px` }}
                      >
                        {exploreChips.map((chip) => (
                          (() => {
                            const visuals = getSuggestionChipVisuals(chip);
                            return (
                          <button
                            key={chip.id}
                            type="button"
                            className={`composer-suggestion-chip ${chip.lane}`}
                            style={{
                              width: `${chip.width}px`,
                              opacity: visuals.opacity,
                              zIndex: visuals.zIndex,
                              transform: `translate3d(${chip.x}px, ${chip.row * SUGGESTION_ROW_STRIDE + Math.sin(chip.bobPhase) * chip.bobAmplitude}px, 0) scale(${visuals.scale})`
                            }}
                            onMouseEnter={pauseAtmosphere}
                            onFocus={pauseAtmosphere}
                            onBlur={resumeAtmosphere}
                            onClick={() => openSuggestionGuide(chip)}
                          >
                            <span>{chip.label}</span>
                          </button>
                            );
                          })()
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {composerFootnote ? (
                <div className={`composer-footnote ${recordingError ? "error" : ""}`}>{composerFootnote}</div>
              ) : null}
            </div>
          </div>
          )}
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
      {authDialogOpen ? (
        <div className="suggestion-guide-modal-backdrop" onClick={closeAuthDialog}>
          <div className="auth-dialog-modal" role="dialog" aria-modal="true" aria-label="邮箱验证码登录" onClick={(event) => event.stopPropagation()}>
            <EmailLoginCard mode="modal" onSuccess={handleAuthSuccess} onCancel={closeAuthDialog} />
          </div>
        </div>
      ) : null}
      {pendingSuggestionChip ? (
        <div className="suggestion-guide-modal-backdrop" onClick={closeSuggestionGuide}>
          <div
            className="suggestion-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suggestion-guide-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="suggestion-guide-close" onClick={closeSuggestionGuide} aria-label="关闭引导弹窗">
              关闭
            </button>
            <div className="suggestion-guide-kicker">继续进入这个主题前</div>
            <h3 id="suggestion-guide-title">{pendingSuggestionChip.guideTitle}</h3>
            <p>{pendingSuggestionChip.guideBody}</p>
            <div className="suggestion-guide-preview">
              <span>当前主题</span>
              <strong>{pendingSuggestionChip.label}</strong>
            </div>
            <div className="suggestion-guide-meta">
              <div className="suggestion-guide-meta-chip">{formatSuggestionLaneLabel(pendingSuggestionChip.lane)}</div>
              <div className="suggestion-guide-meta-text">{formatSuggestionLaneHint(pendingSuggestionChip.lane)}</div>
            </div>
            <div className="suggestion-guide-actions">
              <button type="button" className="suggestion-guide-secondary" onClick={closeSuggestionGuide}>
                先放一放
              </button>
              <button type="button" className="suggestion-guide-primary" onClick={() => void handleContinueSuggestion()}>
                继续下一步
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => attachFiles(event.target.files)}
      />
    </div>
  );
}

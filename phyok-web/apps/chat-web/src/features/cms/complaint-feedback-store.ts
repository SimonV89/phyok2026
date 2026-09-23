"use server";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type ComplaintFeedbackStatus = "OPEN" | "REPLIED";
export type ComplaintFeedbackCategory = "product" | "payment" | "privacy" | "experience" | "other";

export type ComplaintFeedbackItem = {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  contactEmail?: string | null;
  conversationId?: string | null;
  category: ComplaintFeedbackCategory;
  content: string;
  status: ComplaintFeedbackStatus;
  replyContent?: string | null;
  replyBy?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ComplaintFeedbackStore = {
  items: ComplaintFeedbackItem[];
};

const DEFAULT_STORE: ComplaintFeedbackStore = {
  items: []
};

const STORE_PATH = join(process.cwd(), ".local-data", "complaint-feedback.json");

async function ensureStoreDir() {
  await mkdir(dirname(STORE_PATH), { recursive: true });
}

async function readStore(): Promise<ComplaintFeedbackStore> {
  await ensureStoreDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    if (!raw.trim()) {
      return DEFAULT_STORE;
    }
    const parsed = JSON.parse(raw) as ComplaintFeedbackStore;
    if (!Array.isArray(parsed.items)) {
      return DEFAULT_STORE;
    }
    return {
      items: parsed.items
        .filter((item) => item && typeof item.id === "string" && typeof item.content === "string")
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    };
  } catch {
    return DEFAULT_STORE;
  }
}

async function writeStore(store: ComplaintFeedbackStore): Promise<void> {
  await ensureStoreDir();
  await writeFile(
    STORE_PATH,
    JSON.stringify(
      {
        items: [...store.items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      },
      null,
      2
    ),
    "utf8"
  );
}

export async function createComplaintFeedback(input: {
  userId?: string | null;
  userEmail?: string | null;
  contactEmail?: string | null;
  conversationId?: string | null;
  category: ComplaintFeedbackCategory;
  content: string;
}): Promise<ComplaintFeedbackItem> {
  const store = await readStore();
  const now = new Date().toISOString();
  const item: ComplaintFeedbackItem = {
    id: `cmp_${randomUUID()}`,
    userId: input.userId?.trim() || null,
    userEmail: input.userEmail?.trim() || null,
    contactEmail: input.contactEmail?.trim() || input.userEmail?.trim() || null,
    conversationId: input.conversationId?.trim() || null,
    category: input.category,
    content: input.content.trim(),
    status: "OPEN",
    replyContent: null,
    replyBy: null,
    repliedAt: null,
    createdAt: now,
    updatedAt: now
  };
  store.items.unshift(item);
  await writeStore(store);
  return item;
}

export async function countComplaintFeedback(): Promise<number> {
  const store = await readStore();
  return store.items.length;
}

export async function listComplaintFeedback(options: {
  pageNo: number;
  pageSize: number;
}): Promise<{
  pageNo: number;
  pageSize: number;
  total: number;
  items: ComplaintFeedbackItem[];
}> {
  const store = await readStore();
  const pageNo = Math.max(1, Math.floor(options.pageNo));
  const pageSize = Math.max(1, Math.min(50, Math.floor(options.pageSize)));
  const start = (pageNo - 1) * pageSize;
  return {
    pageNo,
    pageSize,
    total: store.items.length,
    items: store.items.slice(start, start + pageSize)
  };
}

export async function replyComplaintFeedback(input: {
  complaintId: string;
  replyContent: string;
  operator: string;
}): Promise<ComplaintFeedbackItem | null> {
  const store = await readStore();
  const target = store.items.find((item) => item.id === input.complaintId);
  if (!target) {
    return null;
  }
  const now = new Date().toISOString();
  target.replyContent = input.replyContent.trim();
  target.replyBy = input.operator.trim();
  target.repliedAt = now;
  target.status = "REPLIED";
  target.updatedAt = now;
  await writeStore(store);
  return target;
}

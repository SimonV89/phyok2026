import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCmsSessionCookieName, readCmsSessionFromToken } from "@/features/cms/cms-auth";

type ApiEnvelope<T> = {
  code: string;
  message: string;
  requestId?: string;
  data?: T;
};

type OverviewData = {
  totalUsers: number;
  paidUsers: number;
  complaintCount: number;
  auditEventCount: number;
};

type BillingOverviewData = {
  plan?: string;
  quotaState?: string;
  scene?: string;
};

type PaymentPreviewData = {
  orderNo: string;
  productCode: string;
  amountFen: number;
  currency: string;
};

type AuditItem = {
  id: string;
  userId: string;
  eventType: string;
  sourceService: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  payloadJson?: string;
};

type AuditPage = {
  pageNo: number;
  pageSize: number;
  total: number;
  items: AuditItem[];
};

type UserItem = {
  userId: string;
  tenantId: string;
  appId: string;
  email: string | null;
  displayName: string | null;
  status: string;
  registerSource: string | null;
  deleted: boolean;
  version: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeSessionCount: number;
  latestSessionExpiresAt: string | null;
};

type UserPage = {
  pageNo: number;
  pageSize: number;
  total: number;
  items: UserItem[];
};

type PaymentOrderItem = {
  orderNo: string;
  userEmail: string | null;
  planId: string;
  subject: string;
  amountFen: number;
  quota: number;
  status: string;
  paymentChannel: string;
  paymentMode: string;
  tradeNo: string | null;
  createdAt: string;
  expiresAt: string | null;
  paidAt: string | null;
};

type PaymentOrderPage = {
  pageNo: number;
  pageSize: number;
  total: number;
  items: PaymentOrderItem[];
};

type ComplaintItem = {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  contactEmail?: string | null;
  conversationId?: string | null;
  category: string;
  content: string;
  status: string;
  replyContent?: string | null;
  replyBy?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ComplaintPage = {
  pageNo: number;
  pageSize: number;
  total: number;
  items: ComplaintItem[];
};

function trimTrailingSlash(raw: string | undefined, fallback: string): string {
  const value = (raw || fallback).trim();
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function readPositiveInt(raw: string | null, fallback: number, max = 100): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function buildHeaders(requestId: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
    "X-Trace-Id": requestId,
    "X-App-Id": "phyok-cms",
    "X-Client-Version": "cms-web-0.1.0",
    "X-Device-Id": "cms-console"
  };
}

async function fetchJsonEnvelope<T>(
  baseUrl: string,
  path: string,
  requestId: string
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const response = await fetch(new URL(path, baseUrl), {
      method: "GET",
      headers: buildHeaders(requestId),
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!payload || payload.code !== "OK" || !payload.data) {
      return {
        ok: false,
        message: payload?.message || `${path} 返回异常`
      };
    }
    return {
      ok: true,
      data: payload.data
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : `${path} 请求失败`
    };
  }
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieValue = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${getCmsSessionCookieName()}=`))
    ?.slice(getCmsSessionCookieName().length + 1);
  const session = readCmsSessionFromToken(cookieValue);
  if (!session) {
    return NextResponse.json(
      {
        code: "CMS_UNAUTHORIZED",
        message: "请先登录 CMS。"
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const auditPageNo = readPositiveInt(url.searchParams.get("auditPageNo"), 1);
  const complaintPageNo = readPositiveInt(url.searchParams.get("complaintPageNo") || url.searchParams.get("privacyPageNo"), 1);
  const userPageNo = readPositiveInt(url.searchParams.get("userPageNo"), 1);
  const orderPageNo = readPositiveInt(url.searchParams.get("orderPageNo"), 1);
  const auditPageSize = readPositiveInt(url.searchParams.get("auditPageSize"), 8, 20);
  const complaintPageSize = readPositiveInt(
    url.searchParams.get("complaintPageSize") || url.searchParams.get("privacyPageSize"),
    8,
    20
  );
  const userPageSize = readPositiveInt(url.searchParams.get("userPageSize"), 8, 20);
  const orderPageSize = readPositiveInt(url.searchParams.get("orderPageSize"), 8, 20);
  const userKeyword = url.searchParams.get("userKeyword")?.trim() || "";
  const orderKeyword = url.searchParams.get("orderKeyword")?.trim() || "";

  const requestId = `cms_${randomUUID()}`;
  const opsAdminBaseUrl = trimTrailingSlash(process.env.JAVA_OPS_ADMIN_BASE_URL, "http://ops-admin-service:18089");
  const authBaseUrl = trimTrailingSlash(process.env.JAVA_AUTH_BASE_URL, "http://127.0.0.1:18081");
  const billingBaseUrl = trimTrailingSlash(process.env.JAVA_BILLING_BASE_URL, "http://127.0.0.1:18085");
  const auditBaseUrl = trimTrailingSlash(process.env.JAVA_AUDIT_BASE_URL, "http://127.0.0.1:18087");
  const paymentBaseUrl = trimTrailingSlash(process.env.JAVA_PAYMENT_BASE_URL, "http://127.0.0.1:18086");
  const complaintUrl = new URL(
    `/cms/api/complaints?pageNo=${complaintPageNo}&pageSize=${complaintPageSize}`,
    request.url
  );

  const [overviewResult, billingResult, paymentPreviewResult, auditResult, complaintResult, userResult, orderResult] =
    await Promise.all([
    fetchJsonEnvelope<OverviewData>(opsAdminBaseUrl, "/v2/admin/overview", `${requestId}_overview`),
    fetchJsonEnvelope<BillingOverviewData>(billingBaseUrl, "/v2/billing/overview", `${requestId}_billing`),
    fetchJsonEnvelope<PaymentPreviewData>(paymentBaseUrl, "/v2/payments/orders/preview", `${requestId}_payment`),
    fetchJsonEnvelope<AuditPage>(
      auditBaseUrl,
      `/v2/audits/events/search?pageNo=${auditPageNo}&pageSize=${auditPageSize}`,
      `${requestId}_audit`
    ),
    fetch(complaintUrl, {
      method: "GET",
      headers: {
        Cookie: cookieHeader
      },
      cache: "no-store"
    }),
    fetchJsonEnvelope<UserPage>(
      authBaseUrl,
      `/internal/auth/admin/users?pageNo=${userPageNo}&pageSize=${userPageSize}&keyword=${encodeURIComponent(userKeyword)}`,
      `${requestId}_users`
    ),
    fetchJsonEnvelope<PaymentOrderPage>(
      paymentBaseUrl,
      `/v2/payments/orders?pageNo=${orderPageNo}&pageSize=${orderPageSize}&keyword=${encodeURIComponent(orderKeyword)}`,
      `${requestId}_orders`
    )
  ]);

  const complaintPayload = (await complaintResult.json().catch(() => null)) as ApiEnvelope<ComplaintPage> | null;
  const complaintQueue =
    complaintResult.ok && complaintPayload?.code === "OK" && complaintPayload.data
      ? complaintPayload.data
      : {
          pageNo: complaintPageNo,
          pageSize: complaintPageSize,
          total: 0,
          items: []
        };
  const complaintCount = complaintQueue.total;

  const errors = [overviewResult, billingResult, paymentPreviewResult, auditResult, userResult, orderResult]
    .filter((item): item is { ok: false; message: string } => !item.ok)
    .map((item) => item.message);
  if (!complaintResult.ok) {
    errors.push("/cms/api/complaints 请求失败");
  } else if (!complaintPayload || complaintPayload.code !== "OK" || !complaintPayload.data) {
    errors.push(complaintPayload?.message || "/cms/api/complaints 返回异常");
  }

  return NextResponse.json({
    code: "OK",
    message: "success",
    data: {
      session: {
        username: session.username,
        expiresAt: session.expiresAt
      },
      generatedAt: new Date().toISOString(),
      overview: overviewResult.ok
        ? {
            ...overviewResult.data,
            complaintCount
          }
        : {
            totalUsers: 0,
            paidUsers: 0,
            complaintCount,
            auditEventCount: 0
          },
      billing: billingResult.ok ? billingResult.data : null,
      paymentPreview: paymentPreviewResult.ok ? paymentPreviewResult.data : null,
      auditPage: auditResult.ok
        ? auditResult.data
        : {
            pageNo: auditPageNo,
            pageSize: auditPageSize,
            total: 0,
            items: []
          },
      userPage: userResult.ok
        ? userResult.data
        : {
            pageNo: userPageNo,
            pageSize: userPageSize,
            total: 0,
            items: []
          },
      paymentOrderPage: orderResult.ok
        ? orderResult.data
        : {
            pageNo: orderPageNo,
            pageSize: orderPageSize,
            total: 0,
            items: []
          },
      complaintQueue,
      errors
    }
  });
}

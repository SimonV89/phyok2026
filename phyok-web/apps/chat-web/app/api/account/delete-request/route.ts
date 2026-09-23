import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

function trimTrailingSlash(raw: string | undefined, fallback: string): string {
  const value = (raw || fallback).trim();
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        userId?: string;
        userEmail?: string;
        appId?: string;
        reason?: string;
      }
    | null;

  const userId = body?.userId?.trim() || "";
  const requestedBy = body?.userEmail?.trim() || "";
  const appId = body?.appId?.trim() || "phyok-chat-web";
  const reason = body?.reason?.trim() || "";

  if (!userId || !requestedBy) {
    return NextResponse.json(
      {
        code: "DELETE_ACCOUNT_UNAUTHORIZED",
        message: "请先登录后再提交注销申请。"
      },
      { status: 401 }
    );
  }

  if (reason.length < 4) {
    return NextResponse.json(
      {
        code: "DELETE_ACCOUNT_REASON_INVALID",
        message: "请简单说明注销原因，方便我们完成处理。"
      },
      { status: 400 }
    );
  }

  const baseUrl = trimTrailingSlash(process.env.JAVA_PRIVACY_BASE_URL, "http://127.0.0.1:18088");
  const requestId = `delete_${randomUUID()}`;

  try {
    const response = await fetch(new URL("/v2/privacy/delete-jobs", baseUrl), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Request-Id": requestId
      },
      body: JSON.stringify({
        tenantId: "tenant-demo",
        appId,
        userId,
        scope: "USER_FULL_ERASURE",
        requestedBy,
        reason
      }),
      cache: "no-store"
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          code?: string;
          message?: string;
          data?: Record<string, unknown>;
        }
      | null;

    if (!response.ok || payload?.code !== "OK") {
      return NextResponse.json(
        {
          code: payload?.code || "DELETE_ACCOUNT_FAILED",
          message: payload?.message || "注销申请提交失败。"
        },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json({
      code: "OK",
      message: "success",
      data: payload?.data || null
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "DELETE_ACCOUNT_FAILED",
        message: error instanceof Error ? error.message : "注销申请提交失败。"
      },
      { status: 500 }
    );
  }
}

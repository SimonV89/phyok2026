import { NextResponse } from "next/server";

import { getCmsSessionCookieName, readCmsSessionFromToken } from "@/features/cms/cms-auth";
import { listComplaintFeedback } from "@/features/cms/complaint-feedback-store";

function readPositiveInt(raw: string | null, fallback: number, max = 100): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
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
  const pageNo = readPositiveInt(url.searchParams.get("pageNo"), 1);
  const pageSize = readPositiveInt(url.searchParams.get("pageSize"), 8, 20);
  const data = await listComplaintFeedback({
    pageNo,
    pageSize
  });

  return NextResponse.json({
    code: "OK",
    message: "success",
    data
  });
}

import { NextResponse } from "next/server";

import { getCmsSessionCookieName, readCmsSessionFromToken } from "@/features/cms/cms-auth";
import { replyComplaintFeedback } from "@/features/cms/complaint-feedback-store";

function readCmsSession(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieValue = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${getCmsSessionCookieName()}=`))
    ?.slice(getCmsSessionCookieName().length + 1);
  return readCmsSessionFromToken(cookieValue);
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ complaintId: string }>;
  }
) {
  const session = readCmsSession(request);
  if (!session) {
    return NextResponse.json(
      {
        code: "CMS_UNAUTHORIZED",
        message: "请先登录 CMS。"
      },
      { status: 401 }
    );
  }

  const { complaintId } = await context.params;
  const body = (await request.json().catch(() => null)) as { replyContent?: string } | null;
  const replyContent = body?.replyContent?.trim() || "";
  if (replyContent.length < 4) {
    return NextResponse.json(
      {
        code: "COMPLAINT_REPLY_INVALID",
        message: "回复内容至少需要 4 个字。"
      },
      { status: 400 }
    );
  }

  const updated = await replyComplaintFeedback({
    complaintId,
    replyContent,
    operator: session.username
  });

  if (!updated) {
    return NextResponse.json(
      {
        code: "COMPLAINT_NOT_FOUND",
        message: "未找到对应投诉工单。"
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    code: "OK",
    message: "success",
    data: updated
  });
}

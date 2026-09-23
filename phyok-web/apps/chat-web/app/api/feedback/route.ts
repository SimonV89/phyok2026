import { NextResponse } from "next/server";

import { createComplaintFeedback, type ComplaintFeedbackCategory } from "@/features/cms/complaint-feedback-store";

const CATEGORY_VALUES = new Set<ComplaintFeedbackCategory>(["product", "payment", "privacy", "experience", "other"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        userId?: string;
        userEmail?: string;
        contactEmail?: string;
        conversationId?: string;
        category?: string;
        content?: string;
      }
    | null;

  const category = (body?.category || "other").trim() as ComplaintFeedbackCategory;
  const content = body?.content?.trim() || "";
  const contactEmail = body?.contactEmail?.trim() || body?.userEmail?.trim() || "";

  if (!CATEGORY_VALUES.has(category)) {
    return NextResponse.json(
      {
        code: "FEEDBACK_CATEGORY_INVALID",
        message: "请选择有效的反馈类型。"
      },
      { status: 400 }
    );
  }

  if (content.length < 8) {
    return NextResponse.json(
      {
        code: "FEEDBACK_CONTENT_TOO_SHORT",
        message: "请至少写下 8 个字，方便我们准确处理。"
      },
      { status: 400 }
    );
  }

  if (!contactEmail) {
    return NextResponse.json(
      {
        code: "FEEDBACK_CONTACT_REQUIRED",
        message: "请留下可联系邮箱，方便我们后续回复。"
      },
      { status: 400 }
    );
  }

  const item = await createComplaintFeedback({
    userId: body?.userId,
    userEmail: body?.userEmail,
    contactEmail,
    conversationId: body?.conversationId,
    category,
    content
  });

  return NextResponse.json({
    code: "OK",
    message: "success",
    data: item
  });
}

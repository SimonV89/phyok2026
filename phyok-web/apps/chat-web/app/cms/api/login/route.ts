import { NextResponse } from "next/server";

import {
  createCmsCookieOptions,
  createCmsSessionToken,
  isCmsAuthConfigured,
  verifyCmsCredentials
} from "@/features/cms/cms-auth";

export async function POST(request: Request) {
  if (!isCmsAuthConfigured()) {
    return NextResponse.json(
      {
        code: "CMS_AUTH_NOT_CONFIGURED",
        message: "CMS 管理员账号尚未配置，请先在环境变量中设置。"
      },
      { status: 503 }
    );
  }

  const payload = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = payload?.username?.trim() || "";
  const password = payload?.password?.trim() || "";
  if (!username || !password) {
    return NextResponse.json(
      {
        code: "CMS_LOGIN_INVALID",
        message: "请输入用户名和密码。"
      },
      { status: 400 }
    );
  }

  if (!verifyCmsCredentials(username, password)) {
    return NextResponse.json(
      {
        code: "CMS_LOGIN_FAILED",
        message: "账号或密码不正确。"
      },
      { status: 401 }
    );
  }

  const session = createCmsSessionToken(username);
  const response = NextResponse.json({
    code: "OK",
    message: "success",
    data: {
      username
    }
  });
  const cookie = createCmsCookieOptions(session.expiresAt);
  response.cookies.set({
    ...cookie,
    value: session.token
  });
  return response;
}

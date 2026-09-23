import { NextResponse } from "next/server";

import { createCmsCookieOptions } from "@/features/cms/cms-auth";

export async function POST() {
  const response = NextResponse.json({
    code: "OK",
    message: "success"
  });
  response.cookies.set({
    ...createCmsCookieOptions(0),
    value: "",
    expires: new Date(0),
    maxAge: 0
  });
  return response;
}

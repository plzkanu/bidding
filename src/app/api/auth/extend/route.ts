import { NextResponse } from "next/server";
import { attachSessionCookie, getSessionUser } from "@/lib/auth";

/** 세션 쿠키 만료 연장 + 클라이언트 미사용 타이머 연장용 */
export async function POST() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    user: session,
  });

  return attachSessionCookie(response, session);
}

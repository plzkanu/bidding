import { NextResponse } from "next/server";
import {
  getApiSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { getIdleTimeoutSettings } from "@/lib/app-settings";

/** 로그인 사용자용: 미사용 타임아웃 설정 조회 */
export async function GET() {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const settings = await getIdleTimeoutSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "설정을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

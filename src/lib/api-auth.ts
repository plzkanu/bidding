import { NextResponse } from "next/server";
import { getSessionUser, requireAdmin } from "./auth";
import type { SessionUser } from "./types";

export async function getApiSession(): Promise<SessionUser | null> {
  return getSessionUser();
}

export function unauthorizedResponse(message = "로그인이 필요합니다.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "권한이 없습니다.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireApiAdmin(): Promise<
  SessionUser | NextResponse
> {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!requireAdmin(session)) {
    return forbiddenResponse("관리자만 접근할 수 있습니다.");
  }
  return session;
}

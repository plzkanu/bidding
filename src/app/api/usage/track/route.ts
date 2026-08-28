import { NextResponse } from "next/server";
import {
  getApiSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import {
  endSession,
  recordHeartbeat,
  recordPageVisit,
  startOrResumeSession,
} from "@/lib/usage-store";

type TrackBody = {
  action?: "pageview" | "heartbeat" | "end";
  pathname?: string;
  sessionId?: string | null;
};

export async function POST(request: Request) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as TrackBody;
    const action = body.action ?? "pageview";

    if (action === "pageview") {
      const pathname = body.pathname?.trim() ?? "";
      if (!pathname) {
        return NextResponse.json(
          { error: "pathname이 필요합니다." },
          { status: 400 },
        );
      }

      const usageSession = await startOrResumeSession(
        session.id,
        body.sessionId,
      );
      const visit = await recordPageVisit(session.id, pathname);

      return NextResponse.json({
        sessionId: usageSession.sessionId,
        screenKey: visit?.screenKey ?? null,
      });
    }

    if (action === "heartbeat") {
      const sessionId = body.sessionId?.trim();
      if (!sessionId) {
        const started = await startOrResumeSession(session.id, null);
        return NextResponse.json({ sessionId: started.sessionId });
      }

      const result = await recordHeartbeat(session.id, sessionId);
      return NextResponse.json(result);
    }

    if (action === "end") {
      const sessionId = body.sessionId?.trim();
      if (sessionId) {
        await endSession(session.id, sessionId);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "알 수 없는 action입니다." }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "사용량 기록 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

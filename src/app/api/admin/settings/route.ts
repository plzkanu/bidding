import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  getIdleTimeoutSettings,
  setIdleTimeoutMinutes,
} from "@/lib/app-settings";

export async function GET() {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
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

export async function PUT(request: Request) {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  try {
    const body = (await request.json()) as {
      idleTimeoutMinutes?: number;
    };

    if (
      body.idleTimeoutMinutes === undefined ||
      typeof body.idleTimeoutMinutes !== "number"
    ) {
      return NextResponse.json(
        { error: "idleTimeoutMinutes(분)를 입력해 주세요." },
        { status: 400 },
      );
    }

    const settings = await setIdleTimeoutMinutes(body.idleTimeoutMinutes);
    return NextResponse.json({ settings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "설정 저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

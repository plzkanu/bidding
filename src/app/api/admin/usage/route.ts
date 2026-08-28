import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { getUserUsageSummaries } from "@/lib/usage-store";

export async function GET() {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  try {
    const users = await getUserUsageSummaries();
    return NextResponse.json({ users });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "사용 현황을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

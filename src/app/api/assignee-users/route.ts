import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { listAssigneeUsers } from "@/lib/assignee-users";

export async function GET(request: Request) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const departmentName = searchParams.get("department") ?? undefined;

  const { users, error } = await listAssigneeUsers({ departmentName });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ users });
}

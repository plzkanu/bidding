import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  getApiSession,
  requireApiAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { validateRegisteredDepartmentName } from "@/lib/departments";
import { toPublicUser } from "@/lib/types";
import { createUser, getAllUsers } from "@/lib/users-store";
import type { UserRole } from "@/lib/types";

export async function GET() {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (session.role !== "admin") {
    return forbiddenResponse();
  }

  const users = await getAllUsers();
  return NextResponse.json({
    users: users.map(toPublicUser),
  });
}

export async function POST(request: Request) {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      password?: string;
      name?: string;
      department?: string;
      role?: UserRole;
      active?: boolean;
    };

    const department = body.department?.trim() ?? "";
    const { valid, error: departmentError } =
      await validateRegisteredDepartmentName(department);
    if (!valid) {
      return NextResponse.json(
        { error: departmentError ?? "등록된 활성 부서만 선택할 수 있습니다." },
        { status: 400 },
      );
    }

    const user = await createUser({
      id: body.id ?? "",
      password: body.password ?? "",
      name: body.name ?? "",
      department,
      role: body.role ?? "user",
      active: body.active,
    });

    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "계정 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

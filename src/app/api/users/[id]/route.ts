import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { validateRegisteredDepartmentName } from "@/lib/departments";
import { toPublicUser } from "@/lib/types";
import type { UserRole } from "@/lib/types";
import { deleteUser, updateUser } from "@/lib/users-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      name?: string;
      department?: string;
      role?: UserRole;
      active?: boolean;
      password?: string;
    };

    if (body.department !== undefined) {
      const { valid, error: departmentError } =
        await validateRegisteredDepartmentName(body.department);
      if (!valid) {
        return NextResponse.json(
          {
            error:
              departmentError ?? "등록된 활성 부서만 선택할 수 있습니다.",
          },
          { status: 400 },
        );
      }
    }

    const user = await updateUser(id, {
      name: body.name,
      department: body.department,
      role: body.role,
      active: body.active,
      password: body.password || undefined,
    });

    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "계정 수정에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { id } = await context.params;

  if (id === sessionOrResponse.id) {
    return NextResponse.json(
      { error: "현재 로그인한 계정은 삭제할 수 없습니다." },
      { status: 400 },
    );
  }

  try {
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "계정 삭제에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

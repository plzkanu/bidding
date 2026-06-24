import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface Department {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export const DEPARTMENTS_TABLE_SETUP_MESSAGE =
  "부서를 저장할 수 없습니다. Supabase에 departments 테이블이 필요합니다. supabase/migrations/013_departments_and_bid_notice_assignments.sql을 적용해 주세요.";

function isMissingDepartmentsTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("departments") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeDepartmentsError(message: string | undefined): string {
  if (isMissingDepartmentsTableError(message)) {
    return DEPARTMENTS_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "부서 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 부서를 사용할 수 없습니다.";
  }
  return null;
}

export async function listDepartments(options?: {
  activeOnly?: boolean;
}): Promise<{ departments: Department[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { departments: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("departments")
      .select("*")
      .order("name", { ascending: true });

    if (options?.activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return {
        departments: [],
        error: normalizeDepartmentsError(error.message),
      };
    }

    return {
      departments: (data ?? []) as Department[],
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "부서 목록 조회에 실패했습니다.";
    return { departments: [], error: normalizeDepartmentsError(message) };
  }
}

export async function findDepartmentById(
  id: string,
): Promise<{ department: Department | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { department: null, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return { department: null, error: normalizeDepartmentsError(error.message) };
    }

    return { department: (data as Department | null) ?? null, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "부서 조회에 실패했습니다.";
    return { department: null, error: normalizeDepartmentsError(message) };
  }
}

export async function findActiveDepartmentByName(
  name: string,
): Promise<{ department: Department | null; error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { department: null, error: null };
  }

  const { departments, error } = await listDepartments({ activeOnly: true });
  if (error) {
    return { department: null, error };
  }

  const department =
    departments.find((row) => row.name.toLowerCase() === trimmed.toLowerCase()) ??
    null;

  return { department, error: null };
}

export async function createDepartment(
  name: string,
): Promise<{ department: Department | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { department: null, error: configError };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { department: null, error: "부서명을 입력해 주세요." };
  }

  try {
    const supabase = createServerClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("departments")
      .insert({
        name: trimmed,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) {
      if (error.message.includes("idx_departments_name_lower")) {
        return { department: null, error: "이미 등록된 부서명입니다." };
      }
      return { department: null, error: normalizeDepartmentsError(error.message) };
    }

    return { department: data as Department, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "부서 등록에 실패했습니다.";
    return { department: null, error: normalizeDepartmentsError(message) };
  }
}

export async function updateDepartment(
  id: string,
  input: { name?: string; is_active?: boolean },
): Promise<{ department: Department | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { department: null, error: configError };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      return { department: null, error: "부서명을 입력해 주세요." };
    }
    patch.name = trimmed;
  }
  if (input.is_active !== undefined) {
    patch.is_active = input.is_active;
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("departments")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.message.includes("idx_departments_name_lower")) {
        return { department: null, error: "이미 등록된 부서명입니다." };
      }
      return { department: null, error: normalizeDepartmentsError(error.message) };
    }

    return { department: data as Department, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "부서 수정에 실패했습니다.";
    return { department: null, error: normalizeDepartmentsError(message) };
  }
}

export async function deleteDepartment(
  id: string,
): Promise<{ error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { error: configError };
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("departments").delete().eq("id", id);

    if (error) {
      if (error.message.includes("bid_notice_assignments")) {
        return {
          error:
            "이 부서가 지정된 공고가 있어 삭제할 수 없습니다. 비활성화를 이용해 주세요.",
        };
      }
      return { error: normalizeDepartmentsError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "부서 삭제에 실패했습니다.";
    return { error: normalizeDepartmentsError(message) };
  }
}

export async function validateRegisteredDepartmentName(
  departmentName: string,
): Promise<{ valid: boolean; error: string | null }> {
  const trimmed = departmentName.trim();
  if (!trimmed) {
    return { valid: true, error: null };
  }

  const { department, error } = await findActiveDepartmentByName(trimmed);
  if (error) {
    return { valid: false, error };
  }
  if (!department) {
    return {
      valid: false,
      error: "등록된 활성 부서만 선택할 수 있습니다.",
    };
  }

  return { valid: true, error: null };
}

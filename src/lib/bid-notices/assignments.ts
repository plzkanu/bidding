import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { findDepartmentById } from "@/lib/departments";
import { findUserById } from "@/lib/users-store";
import { getBidNoticeById, getBidNoticesByIds } from "./notice-repository";
import type { BidNoticeType, KhnpBidNoticeRow } from "./types";

export interface BidNoticeAssignment {
  noticeId: string;
  departmentId: string;
  departmentName: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  updatedAt: string | null;
}

export const ASSIGNMENTS_TABLE_SETUP_MESSAGE =
  "담당 지정을 저장할 수 없습니다. Supabase에 bid_notice_assignments 테이블이 필요합니다. supabase/migrations/013_departments_and_bid_notice_assignments.sql을 적용해 주세요.";

function isMissingAssignmentsTableError(message: string | undefined): boolean {
  if (!message) return false;
  if (
    message.includes("relationship") ||
    message.includes("Could not find a relationship")
  ) {
    return false;
  }
  return (
    message.includes("bid_notice_assignments") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

function noticeMatchesAssignmentFilters(
  notice: KhnpBidNoticeRow,
  filters?: { siteId?: number; noticeType?: BidNoticeType },
): boolean {
  if (notice.is_deleted) return false;
  if (filters?.siteId != null && notice.site_id !== filters.siteId) return false;
  if (filters?.noticeType && notice.notice_type !== filters.noticeType) {
    return false;
  }
  return true;
}

export function normalizeAssignmentsError(message: string | undefined): string {
  if (isMissingAssignmentsTableError(message)) {
    return ASSIGNMENTS_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "담당 지정 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 담당 지정을 사용할 수 없습니다.";
  }
  return null;
}

function mapAssignmentRow(row: Record<string, unknown>): BidNoticeAssignment {
  const department = row.departments as { name?: string } | null;
  return {
    noticeId: row.notice_id as string,
    departmentId: row.department_id as string,
    departmentName: department?.name ?? "",
    assigneeUserId: (row.assignee_user_id as string | null) ?? null,
    assigneeName: null,
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

async function enrichAssigneeNames(
  assignments: BidNoticeAssignment[],
): Promise<BidNoticeAssignment[]> {
  const enriched = await Promise.all(
    assignments.map(async (assignment) => {
      if (!assignment.assigneeUserId) {
        return assignment;
      }
      const user = await findUserById(assignment.assigneeUserId);
      return {
        ...assignment,
        assigneeName: user?.name ?? assignment.assigneeUserId,
      };
    }),
  );
  return enriched;
}

export async function getNoticeAssignment(
  noticeId: string,
): Promise<{ assignment: BidNoticeAssignment | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { assignment: null, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_notice_assignments")
      .select("notice_id, department_id, assignee_user_id, updated_at, departments(name)")
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return { assignment: null, error: normalizeAssignmentsError(error.message) };
    }

    if (!data) {
      return { assignment: null, error: null };
    }

    const [assignment] = await enrichAssigneeNames([mapAssignmentRow(data)]);
    return { assignment, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "담당 지정 조회에 실패했습니다.";
    return { assignment: null, error: normalizeAssignmentsError(message) };
  }
}

export async function getAssignmentMap(
  filters?: { siteId?: number; noticeType?: BidNoticeType },
): Promise<{
  assignments: Record<string, BidNoticeAssignment>;
  error: string | null;
}> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { assignments: {}, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_notice_assignments")
      .select(
        "notice_id, department_id, assignee_user_id, updated_at, departments(name)",
      );

    if (error) {
      return { assignments: {}, error: normalizeAssignmentsError(error.message) };
    }

    const rows = data ?? [];
    const { notices, error: noticeError } = await getBidNoticesByIds(
      rows.map((row) => row.notice_id as string),
    );
    if (noticeError) {
      return { assignments: {}, error: normalizeAssignmentsError(noticeError) };
    }

    const filteredRows = rows.filter((row) => {
      const notice = notices.get(row.notice_id as string);
      return notice != null && noticeMatchesAssignmentFilters(notice, filters);
    });

    const enriched = await enrichAssigneeNames(
      filteredRows.map((row) => mapAssignmentRow(row)),
    );
    const assignments: Record<string, BidNoticeAssignment> = {};
    for (const assignment of enriched) {
      assignments[assignment.noticeId] = assignment;
    }

    return { assignments, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "담당 지정 조회에 실패했습니다.";
    return { assignments: {}, error: normalizeAssignmentsError(message) };
  }
}

export async function saveNoticeAssignment(
  assignedBy: string,
  noticeId: string,
  input: {
    departmentId: string;
    assigneeUserId?: string | null;
  },
): Promise<{ assignment: BidNoticeAssignment | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { assignment: null, error: configError };
  }

  const departmentId = input.departmentId.trim();
  if (!departmentId) {
    return { assignment: null, error: "담당부서를 선택해 주세요." };
  }

  const { department, error: departmentError } =
    await findDepartmentById(departmentId);
  if (departmentError) {
    return { assignment: null, error: departmentError };
  }
  if (!department || !department.is_active) {
    return {
      assignment: null,
      error: "등록된 활성 부서만 선택할 수 있습니다.",
    };
  }

  const assigneeUserId = input.assigneeUserId?.trim() || null;
  if (assigneeUserId) {
    const user = await findUserById(assigneeUserId);
    if (!user || !user.active) {
      return { assignment: null, error: "활성 담당자만 지정할 수 있습니다." };
    }
    if (user.department.trim().toLowerCase() !== department.name.trim().toLowerCase()) {
      return {
        assignment: null,
        error: "선택한 부서에 속한 담당자만 지정할 수 있습니다.",
      };
    }
  }

  try {
    const { notice, error: noticeError } = await getBidNoticeById(noticeId);
    if (noticeError) {
      return { assignment: null, error: normalizeAssignmentsError(noticeError) };
    }
    if (!notice) {
      return { assignment: null, error: "공고를 찾을 수 없습니다." };
    }

    const supabase = createServerClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("bid_notice_assignments")
      .upsert(
        {
          notice_id: noticeId,
          department_id: departmentId,
          assignee_user_id: assigneeUserId,
          assigned_by: assignedBy,
          updated_at: now,
        },
        { onConflict: "notice_id" },
      )
      .select("notice_id, department_id, assignee_user_id, updated_at, departments(name)")
      .single();

    if (error) {
      if (error.code === "23503") {
        return {
          assignment: null,
          error:
            "담당 지정 저장에 실패했습니다. Supabase에서 019_srm_bid_notice.sql(FK 제거) 적용 후 schema cache를 새로고침해 주세요.",
        };
      }
      return { assignment: null, error: normalizeAssignmentsError(error.message) };
    }

    const [assignment] = await enrichAssigneeNames([mapAssignmentRow(data)]);
    return { assignment, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "담당 지정 저장에 실패했습니다.";
    return { assignment: null, error: normalizeAssignmentsError(message) };
  }
}

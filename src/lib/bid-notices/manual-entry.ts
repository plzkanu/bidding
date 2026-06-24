import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getKhnpBidNoticeById } from "./khnp";
import type {
  BidNoticeSource,
  BidNoticeType,
  KhnpBidNoticeRow,
} from "./types";
import type { UserRole } from "@/lib/types";

export const MANUAL_NOTICE_NO_PREFIX = "MAN-";

export const MANUAL_NOTICE_COLUMNS_SETUP_MESSAGE =
  "공고 직접 등록을 사용하려면 Supabase에 source·created_by 컬럼이 필요합니다. SQL Editor에서 supabase/migrations/010_manual_bid_notice.sql을 실행한 뒤, Project Settings → API → Reload schema cache를 눌러 주세요.";

export interface ManualBidOpenInput {
  status?: string | null;
  bidMethod?: string | null;
  domesticFlag?: string | null;
  purchaseType?: string | null;
  bidStartDt?: string | null;
  bidCloseDt?: string | null;
  awardMethod?: string | null;
}

export interface ManualBidNoticeInput {
  siteId: number;
  noticeType: BidNoticeType;
  noticeNo: string;
  title: string;
  originNoticeNo?: string | null;
  noticeDiv?: string | null;
  deptName?: string | null;
  noticeDate?: string | null;
  noticePeriodStart?: string | null;
  noticePeriodEnd?: string | null;
  bidOpen?: ManualBidOpenInput;
  privateContent?: string | null;
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않았습니다.";
  }
  return null;
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** NOT NULL TEXT 컬럼 — 빈 입력은 null 대신 빈 문자열 */
function trimOrEmpty(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function generateManualNoticeNo(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${MANUAL_NOTICE_NO_PREFIX}${stamp}-${suffix}`;
}

function resolveNoticeNo(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || generateManualNoticeNo();
}

function resolveNoticeNoForUpdate(
  value: string | null | undefined,
  existingNoticeNo: string,
): string {
  const trimmed = value?.trim();
  return trimmed || existingNoticeNo;
}

function isMissingManualNoticeColumnsError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    (lower.includes("created_by") || lower.includes("'source'")) &&
    (lower.includes("schema cache") ||
      lower.includes("could not find") ||
      lower.includes("does not exist"))
  );
}

function normalizeManualError(message: string): string {
  if (isMissingManualNoticeColumnsError(message)) {
    return MANUAL_NOTICE_COLUMNS_SETUP_MESSAGE;
  }
  if (message.includes("duplicate key") || message.includes("23505")) {
    return "동일 사이트·공고유형에 이미 같은 공고번호가 있습니다.";
  }
  return message;
}

/** 직접 등록 공고 여부 (source 컬럼 또는 MAN- 공고번호) */
export function isManualBidNotice(
  notice: Pick<KhnpBidNoticeRow, "source" | "notice_no">,
): boolean {
  if (notice.source === "manual") return true;
  return notice.notice_no.trim().startsWith(MANUAL_NOTICE_NO_PREFIX);
}

export function canManageManualNotice(
  notice: Pick<KhnpBidNoticeRow, "source" | "created_by" | "notice_no">,
  userId: string,
  role: UserRole,
): boolean {
  if (role === "admin") return true;
  if (!isManualBidNotice(notice)) return false;
  if (notice.created_by) {
    return notice.created_by === userId;
  }
  return false;
}

function buildNoticeInsertPayload(
  userId: string,
  input: ManualBidNoticeInput,
  now: string,
  includeManualMeta: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    site_id: input.siteId,
    notice_type: input.noticeType,
    notice_no: resolveNoticeNo(input.noticeNo),
    origin_notice_no: trimOrNull(input.originNoticeNo),
    notice_div: trimOrEmpty(input.noticeDiv),
    title: input.title.trim(),
    dept_name: trimOrNull(input.deptName),
    notice_date: trimOrNull(input.noticeDate),
    notice_period_start: trimOrNull(input.noticePeriodStart),
    notice_period_end: trimOrNull(input.noticePeriodEnd),
    updated_at: now,
  };

  if (includeManualMeta) {
    payload.source = "manual" satisfies BidNoticeSource;
    payload.created_by = userId;
  }

  return payload;
}

async function insertManualNoticeRow(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  input: ManualBidNoticeInput,
): Promise<{ id: string | null; error: string | null }> {
  const now = new Date().toISOString();

  for (const includeManualMeta of [true, false]) {
    const { data, error } = await supabase
      .from("khnp_bid_notice")
      .insert(buildNoticeInsertPayload(userId, input, now, includeManualMeta))
      .select("id")
      .single();

    if (!error && data) {
      return { id: data.id as string, error: null };
    }

    if (includeManualMeta && isMissingManualNoticeColumnsError(error?.message)) {
      continue;
    }

    return {
      id: null,
      error: normalizeManualError(error?.message ?? "공고 등록에 실패했습니다."),
    };
  }

  return {
    id: null,
    error: MANUAL_NOTICE_COLUMNS_SETUP_MESSAGE,
  };
}

export function validateManualBidNoticeInput(
  input: ManualBidNoticeInput,
  mode: "create" | "update",
): string | null {
  if (mode === "create") {
    if (!Number.isFinite(input.siteId) || input.siteId <= 0) {
      return "사이트를 선택하세요.";
    }
  }

  if (!trimOrNull(input.title)) {
    return "공고명은 필수입니다.";
  }

  if (input.noticeType === "BID") {
    const close = trimOrNull(input.bidOpen?.bidCloseDt ?? null);
    if (!close) {
      return "입찰공고는 입찰마감일시가 필요합니다.";
    }
  }

  return null;
}

async function insertChildRows(
  supabase: ReturnType<typeof createServerClient>,
  noticeId: string,
  noticeType: BidNoticeType,
  input: ManualBidNoticeInput,
): Promise<{ error: string | null }> {
  if (noticeType === "BID") {
    const open = input.bidOpen ?? {};
    const { error } = await supabase.from("khnp_bid_open").insert({
      notice_id: noticeId,
      status: trimOrNull(open.status),
      bid_method: trimOrNull(open.bidMethod),
      domestic_flag: trimOrNull(open.domesticFlag),
      purchase_type: trimOrNull(open.purchaseType),
      bid_start_dt: trimOrNull(open.bidStartDt),
      bid_close_dt: trimOrNull(open.bidCloseDt),
      award_method: trimOrNull(open.awardMethod),
    });
    if (error) return { error: normalizeManualError(error.message) };
    return { error: null };
  }

  if (noticeType === "PRIVATE") {
    const { error } = await supabase.from("khnp_bid_private").insert({
      notice_id: noticeId,
      main_content: trimOrNull(input.privateContent),
    });
    if (error) return { error: normalizeManualError(error.message) };
    return { error: null };
  }

  const { error } = await supabase.from("khnp_bid_plan_spec").insert({
    notice_id: noticeId,
  });
  if (error) return { error: normalizeManualError(error.message) };
  return { error: null };
}

async function upsertChildRows(
  supabase: ReturnType<typeof createServerClient>,
  notice: KhnpBidNoticeRow,
  input: ManualBidNoticeInput,
): Promise<{ error: string | null }> {
  const noticeId = notice.id;

  if (notice.notice_type === "BID") {
    const open = input.bidOpen ?? {};
    const payload = {
      status: trimOrNull(open.status),
      bid_method: trimOrNull(open.bidMethod),
      domestic_flag: trimOrNull(open.domesticFlag),
      purchase_type: trimOrNull(open.purchaseType),
      bid_start_dt: trimOrNull(open.bidStartDt),
      bid_close_dt: trimOrNull(open.bidCloseDt),
      award_method: trimOrNull(open.awardMethod),
    };

    const existing = Array.isArray(notice.khnp_bid_open)
      ? notice.khnp_bid_open[0]
      : notice.khnp_bid_open;

    if (existing?.id) {
      const { error } = await supabase
        .from("khnp_bid_open")
        .update(payload)
        .eq("id", existing.id);
      if (error) return { error: normalizeManualError(error.message) };
    } else {
      const { error } = await supabase.from("khnp_bid_open").insert({
        notice_id: noticeId,
        ...payload,
      });
      if (error) return { error: normalizeManualError(error.message) };
    }
    return { error: null };
  }

  if (notice.notice_type === "PRIVATE") {
    const payload = { main_content: trimOrNull(input.privateContent) };
    const existing = Array.isArray(notice.khnp_bid_private)
      ? notice.khnp_bid_private[0]
      : notice.khnp_bid_private;

    if (existing?.id) {
      const { error } = await supabase
        .from("khnp_bid_private")
        .update(payload)
        .eq("id", existing.id);
      if (error) return { error: normalizeManualError(error.message) };
    } else {
      const { error } = await supabase.from("khnp_bid_private").insert({
        notice_id: noticeId,
        ...payload,
      });
      if (error) return { error: normalizeManualError(error.message) };
    }
    return { error: null };
  }

  const existing = Array.isArray(notice.khnp_bid_plan_spec)
    ? notice.khnp_bid_plan_spec[0]
    : notice.khnp_bid_plan_spec;

  if (!existing?.id) {
    const { error } = await supabase.from("khnp_bid_plan_spec").insert({
      notice_id: noticeId,
    });
    if (error) return { error: normalizeManualError(error.message) };
  }

  return { error: null };
}

export async function createManualBidNotice(
  userId: string,
  input: ManualBidNoticeInput,
): Promise<{ notice: KhnpBidNoticeRow | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { notice: null, error: configError };
  }

  const validationError = validateManualBidNoticeInput(input, "create");
  if (validationError) {
    return { notice: null, error: validationError };
  }

  try {
    const supabase = createServerClient();

    const { id, error: insertError } = await insertManualNoticeRow(
      supabase,
      userId,
      input,
    );

    if (insertError || !id) {
      return { notice: null, error: insertError ?? "공고 등록에 실패했습니다." };
    }

    const childResult = await insertChildRows(
      supabase,
      id,
      input.noticeType,
      input,
    );
    if (childResult.error) {
      await supabase.from("khnp_bid_notice").delete().eq("id", id);
      return { notice: null, error: childResult.error };
    }

    return getKhnpBidNoticeById(id);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "공고 등록에 실패했습니다.";
    return { notice: null, error: normalizeManualError(message) };
  }
}

export async function updateManualBidNotice(
  userId: string,
  role: UserRole,
  noticeId: string,
  input: ManualBidNoticeInput,
): Promise<{ notice: KhnpBidNoticeRow | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { notice: null, error: configError };
  }

  const validationError = validateManualBidNoticeInput(input, "update");
  if (validationError) {
    return { notice: null, error: validationError };
  }

  const { notice: existing, error: fetchError } =
    await getKhnpBidNoticeById(noticeId);
  if (fetchError) {
    return { notice: null, error: fetchError };
  }
  if (!existing) {
    return { notice: null, error: "공고를 찾을 수 없습니다." };
  }
  if (!isManualBidNotice(existing)) {
    return { notice: null, error: "크롤링으로 수집된 공고는 수정할 수 없습니다." };
  }
  if (!canManageManualNotice(existing, userId, role)) {
    return { notice: null, error: "수정 권한이 없습니다." };
  }
  if (existing.notice_type !== input.noticeType) {
    return { notice: null, error: "공고 유형은 변경할 수 없습니다." };
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("khnp_bid_notice")
      .update({
        notice_no: resolveNoticeNoForUpdate(input.noticeNo, existing.notice_no),
        origin_notice_no: trimOrNull(input.originNoticeNo),
        notice_div: trimOrEmpty(input.noticeDiv),
        title: input.title.trim(),
        dept_name: trimOrNull(input.deptName),
        notice_date: trimOrNull(input.noticeDate),
        notice_period_start: trimOrNull(input.noticePeriodStart),
        notice_period_end: trimOrNull(input.noticePeriodEnd),
        updated_at: new Date().toISOString(),
      })
      .eq("id", noticeId)
      .eq("is_deleted", false);

    if (error) {
      return { notice: null, error: normalizeManualError(error.message) };
    }

    const childResult = await upsertChildRows(supabase, existing, input);
    if (childResult.error) {
      return { notice: null, error: childResult.error };
    }

    return getKhnpBidNoticeById(noticeId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "공고 수정에 실패했습니다.";
    return { notice: null, error: normalizeManualError(message) };
  }
}

export async function deleteManualBidNotice(
  userId: string,
  role: UserRole,
  noticeId: string,
): Promise<{ error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { error: configError };
  }

  const { notice: existing, error: fetchError } =
    await getKhnpBidNoticeById(noticeId);
  if (fetchError) {
    return { error: fetchError };
  }
  if (!existing) {
    return { error: "공고를 찾을 수 없습니다." };
  }
  if (!isManualBidNotice(existing)) {
    return { error: "크롤링으로 수집된 공고는 삭제할 수 없습니다." };
  }
  if (!canManageManualNotice(existing, userId, role)) {
    return { error: "삭제 권한이 없습니다." };
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("khnp_bid_notice")
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noticeId);

    if (error) {
      return { error: normalizeManualError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "공고 삭제에 실패했습니다.";
    return { error: normalizeManualError(message) };
  }
}

export async function getManualNoticePermissions(
  notice: KhnpBidNoticeRow,
  userId: string,
  role: UserRole,
): Promise<{ canEdit: boolean; canDelete: boolean }> {
  const manageable =
    isManualBidNotice(notice) && canManageManualNotice(notice, userId, role);
  return { canEdit: manageable, canDelete: manageable };
}

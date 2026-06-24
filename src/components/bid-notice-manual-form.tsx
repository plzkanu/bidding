"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  BID_NOTICE_TYPE_LABELS,
  type BidNoticeType,
  type KhnpBidNoticeRow,
} from "@/lib/bid-notices/types";
import { getOpenDetail, getPrivateDetail } from "@/lib/bid-notices/utils";
import type { ManualBidNoticeInput } from "@/lib/bid-notices/manual-entry";

interface BidNoticeManualFormModalProps {
  mode: "create" | "edit";
  siteId: number;
  siteName: string;
  noticeType: BidNoticeType;
  initialNotice?: KhnpBidNoticeRow | null;
  onClose: () => void;
  onSaved: (notice: KhnpBidNoticeRow) => void;
}

interface FormState {
  noticeNo: string;
  title: string;
  originNoticeNo: string;
  noticeDiv: string;
  deptName: string;
  noticeDate: string;
  noticePeriodStart: string;
  noticePeriodEnd: string;
  status: string;
  bidMethod: string;
  domesticFlag: string;
  purchaseType: string;
  bidStartDt: string;
  bidCloseDt: string;
  awardMethod: string;
  privateContent: string;
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function toDateTimeLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocalInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function fromDateInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function createDefaultForm(): FormState {
  const now = new Date();
  return {
    noticeNo: "",
    title: "",
    originNoticeNo: "",
    noticeDiv: "",
    deptName: "",
    noticeDate: toDateTimeLocalInput(now.toISOString()),
    noticePeriodStart: "",
    noticePeriodEnd: "",
    status: "",
    bidMethod: "",
    domesticFlag: "",
    purchaseType: "",
    bidStartDt: "",
    bidCloseDt: "",
    awardMethod: "",
    privateContent: "",
  };
}

function noticeToForm(notice: KhnpBidNoticeRow): FormState {
  const open = getOpenDetail(notice);
  const priv = getPrivateDetail(notice);

  return {
    noticeNo: notice.notice_no,
    title: notice.title,
    originNoticeNo: notice.origin_notice_no ?? "",
    noticeDiv: notice.notice_div ?? "",
    deptName: notice.dept_name ?? "",
    noticeDate: toDateTimeLocalInput(notice.notice_date),
    noticePeriodStart: toDateInput(notice.notice_period_start),
    noticePeriodEnd: toDateInput(notice.notice_period_end),
    status: open?.status ?? "",
    bidMethod: open?.bid_method ?? "",
    domesticFlag: open?.domestic_flag ?? "",
    purchaseType: open?.purchase_type ?? "",
    bidStartDt: toDateTimeLocalInput(open?.bid_start_dt),
    bidCloseDt: toDateTimeLocalInput(open?.bid_close_dt),
    awardMethod: open?.award_method ?? "",
    privateContent: priv?.main_content ?? "",
  };
}

function buildPayload(
  siteId: number,
  noticeType: BidNoticeType,
  form: FormState,
): ManualBidNoticeInput {
  return {
    siteId,
    noticeType,
    noticeNo: form.noticeNo,
    title: form.title,
    originNoticeNo: form.originNoticeNo || null,
    noticeDiv: form.noticeDiv || null,
    deptName: form.deptName || null,
    noticeDate: fromDateTimeLocalInput(form.noticeDate),
    noticePeriodStart: fromDateInput(form.noticePeriodStart),
    noticePeriodEnd: fromDateInput(form.noticePeriodEnd),
    bidOpen:
      noticeType === "BID"
        ? {
            status: form.status || null,
            bidMethod: form.bidMethod || null,
            domesticFlag: form.domesticFlag || null,
            purchaseType: form.purchaseType || null,
            bidStartDt: fromDateTimeLocalInput(form.bidStartDt),
            bidCloseDt: fromDateTimeLocalInput(form.bidCloseDt),
            awardMethod: form.awardMethod || null,
          }
        : undefined,
    privateContent:
      noticeType === "PRIVATE" ? form.privateContent || null : undefined,
  };
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";

export function BidNoticeManualFormModal({
  mode,
  siteId,
  siteName,
  noticeType,
  initialNotice,
  onClose,
  onSaved,
}: BidNoticeManualFormModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    mode === "edit" && initialNotice
      ? noticeToForm(initialNotice)
      : createDefaultForm(),
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    const payload = buildPayload(siteId, noticeType, form);

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/bid-notices"
          : `/api/bid-notices/${encodeURIComponent(initialNotice!.id)}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as {
        notice?: KhnpBidNoticeRow;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "저장에 실패했습니다.");
      }
      if (!data.notice) {
        throw new Error("저장 결과를 확인할 수 없습니다.");
      }

      onSaved(data.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-notice-form-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:max-h-[90vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#009ada]">
                {siteName} · {BID_NOTICE_TYPE_LABELS[noticeType]}
              </p>
              <h2
                id="manual-notice-form-title"
                className="mt-1 text-lg font-bold text-[#004b87]"
              >
                {mode === "create" ? "공고 직접 등록" : "공고 수정"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                크롤링으로 수집되지 않은 공고를 직접 입력합니다. 등록자와
                관리자만 수정·삭제할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="noticeNo">
                공고번호
              </label>
              <input
                id="noticeNo"
                value={form.noticeNo}
                onChange={(e) => updateField("noticeNo", e.target.value)}
                placeholder="미입력 시 자동 생성"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="title">
                공고명 <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                required
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="noticeDiv">
                공고구분
              </label>
              <input
                id="noticeDiv"
                value={form.noticeDiv}
                onChange={(e) => updateField("noticeDiv", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="originNoticeNo">
                원사전공고번호
              </label>
              <input
                id="originNoticeNo"
                value={form.originNoticeNo}
                onChange={(e) => updateField("originNoticeNo", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="deptName">
                담당부서
              </label>
              <input
                id="deptName"
                value={form.deptName}
                onChange={(e) => updateField("deptName", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="noticeDate">
                공고일시
              </label>
              <input
                id="noticeDate"
                type="datetime-local"
                value={form.noticeDate}
                onChange={(e) => updateField("noticeDate", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="noticePeriodStart">
                공고기간 시작
              </label>
              <input
                id="noticePeriodStart"
                type="date"
                value={form.noticePeriodStart}
                onChange={(e) =>
                  updateField("noticePeriodStart", e.target.value)
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="noticePeriodEnd">
                공고기간 종료
              </label>
              <input
                id="noticePeriodEnd"
                type="date"
                value={form.noticePeriodEnd}
                onChange={(e) => updateField("noticePeriodEnd", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {noticeType === "BID" ? (
            <section className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-[#004b87]">입찰 정보</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="status">
                    진행상태
                  </label>
                  <input
                    id="status"
                    value={form.status}
                    onChange={(e) => updateField("status", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="bidMethod">
                    입찰방식
                  </label>
                  <input
                    id="bidMethod"
                    value={form.bidMethod}
                    onChange={(e) => updateField("bidMethod", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="domesticFlag">
                    국내/국제
                  </label>
                  <input
                    id="domesticFlag"
                    value={form.domesticFlag}
                    onChange={(e) =>
                      updateField("domesticFlag", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="purchaseType">
                    구매유형
                  </label>
                  <input
                    id="purchaseType"
                    value={form.purchaseType}
                    onChange={(e) =>
                      updateField("purchaseType", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="bidStartDt">
                    입찰개시
                  </label>
                  <input
                    id="bidStartDt"
                    type="datetime-local"
                    value={form.bidStartDt}
                    onChange={(e) => updateField("bidStartDt", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="bidCloseDt">
                    입찰마감 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="bidCloseDt"
                    type="datetime-local"
                    required
                    value={form.bidCloseDt}
                    onChange={(e) => updateField("bidCloseDt", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="awardMethod">
                    낙찰자결정방법
                  </label>
                  <input
                    id="awardMethod"
                    value={form.awardMethod}
                    onChange={(e) => updateField("awardMethod", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </section>
          ) : null}

          {noticeType === "PRIVATE" ? (
            <section className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-[#004b87]">
                주요구매내용
              </h3>
              <textarea
                value={form.privateContent}
                onChange={(e) => updateField("privateContent", e.target.value)}
                rows={5}
                className={`${inputClass} mt-3`}
                placeholder="주요 구매 내용을 입력하세요."
              />
            </section>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003d6e] disabled:opacity-40"
            >
              {isSaving ? "저장 중…" : mode === "create" ? "등록" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

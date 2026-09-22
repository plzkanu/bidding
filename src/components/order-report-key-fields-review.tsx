"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/bid-notices/utils";
import {
  resolveKeyFieldsFormValues,
  type OrderReportKeyFieldsInput,
} from "@/lib/order-report-summary/key-fields";
import { PROJECT_CATEGORY_TERMS } from "@/lib/order-report-summary/project-category";
import type {
  OrderReportKeyFieldsConfirmation,
  OrderReportSummaryData,
  OrderReportSummaryRecord,
  OrderReportSummaryScheduleStep,
} from "@/lib/order-report-summary/types";

interface OrderReportKeyFieldsReviewProps {
  noticeId: string;
  summary: OrderReportSummaryData;
  confirmation: OrderReportKeyFieldsConfirmation | null;
  noticeTitle?: string;
  disabled?: boolean;
  onConfirmed: (record: OrderReportSummaryRecord) => void;
}

const EMPTY_SCHEDULE_ROW: OrderReportSummaryScheduleStep = {
  단계: "",
  날짜: "",
};

function withAtLeastOneSchedule(
  steps: OrderReportSummaryScheduleStep[],
): OrderReportSummaryScheduleStep[] {
  return steps.length > 0 ? steps : [{ ...EMPTY_SCHEDULE_ROW }];
}

export function OrderReportKeyFieldsReview({
  noticeId,
  summary,
  confirmation,
  noticeTitle,
  disabled = false,
  onConfirmed,
}: OrderReportKeyFieldsReviewProps) {
  const confirmed = Boolean(confirmation?.confirmedAt);
  const [isEditing, setIsEditing] = useState(!confirmed);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<OrderReportKeyFieldsInput>(() =>
    resolveKeyFieldsFormValues(summary, confirmation, noticeTitle),
  );

  useEffect(() => {
    const next = resolveKeyFieldsFormValues(summary, confirmation, noticeTitle);
    setForm(next);
    setIsEditing(!confirmation?.confirmedAt);
    setError("");
  }, [summary, confirmation, noticeTitle]);

  const readOnly = confirmed && !isEditing;

  function updateField<K extends "분류" | "추정가격" | "예비가격기초금액">(
    key: K,
    value: string,
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateSchedule(
    index: number,
    key: keyof OrderReportSummaryScheduleStep,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      입찰일정: prev.입찰일정.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [key]: value } : step,
      ),
    }));
  }

  function addScheduleRow() {
    setForm((prev) => ({
      ...prev,
      입찰일정: [...prev.입찰일정, { ...EMPTY_SCHEDULE_ROW }],
    }));
  }

  function removeScheduleRow(index: number) {
    setForm((prev) => {
      const next = prev.입찰일정.filter((_, stepIndex) => stepIndex !== index);
      return { ...prev, 입찰일정: withAtLeastOneSchedule(next) };
    });
  }

  async function handleConfirm() {
    if (disabled || isSaving) return;

    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/order-report-summaries/${encodeURIComponent(noticeId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            분류: form.분류,
            추정가격: form.추정가격,
            예비가격기초금액: form.예비가격기초금액,
            입찰일정: withAtLeastOneSchedule(form.입찰일정).filter(
              (step) => step.단계.trim() || step.날짜.trim(),
            ),
          }),
        },
      );
      const data = (await response.json()) as {
        summary?: OrderReportSummaryRecord;
        error?: string;
      };
      if (!response.ok || !data.summary) {
        throw new Error(data.error ?? "중요 항목 확인에 실패했습니다.");
      }
      onConfirmed(data.summary);
      setIsEditing(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "중요 항목 확인에 실패했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const scheduleRows = withAtLeastOneSchedule(form.입찰일정);
  const inputClassName =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-600";

  return (
    <section
      className={`rounded-xl border p-6 shadow-sm ${
        confirmed && !isEditing
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">중요 항목 확인</h3>
          <p className="mt-1 text-xs text-slate-600">
            요약에서 추출한 분류, 추정가격, 예비가격기초금액, 입찰 일정을 원문과 대조한 뒤
            확인해 주세요. 확인하면 미리보기와 DOCX에 반영됩니다.
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            confirmed && !isEditing
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-100 text-amber-800"
          }`}
        >
          {confirmed && !isEditing ? "확인 완료" : "확인 필요"}
        </span>
      </div>

      {confirmation?.confirmedAt && !isEditing ? (
        <p className="mt-2 text-xs text-emerald-800">
          확인 시각: {formatDateTime(confirmation.confirmedAt)}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">분류</span>
          <input
            type="text"
            list="order-report-project-category"
            value={form.분류}
            onChange={(event) => updateField("분류", event.target.value)}
            disabled={disabled || readOnly || isSaving}
            placeholder="제목에 없으면 직접 입력 (기계설비 / 용역 / 전기)"
            className={inputClassName}
          />
          <datalist id="order-report-project-category">
            {PROJECT_CATEGORY_TERMS.map((term) => (
              <option key={term} value={term} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">추정가격</span>
          <input
            type="text"
            value={form.추정가격}
            onChange={(event) => updateField("추정가격", event.target.value)}
            disabled={disabled || readOnly || isSaving}
            placeholder="문서의 추정가격"
            className={inputClassName}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">
            예비가격기초금액
          </span>
          <input
            type="text"
            value={form.예비가격기초금액}
            onChange={(event) =>
              updateField("예비가격기초금액", event.target.value)
            }
            disabled={disabled || readOnly || isSaving}
            placeholder="문서의 예비가격기초금액"
            className={inputClassName}
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-600">입찰 일정</span>
          {readOnly ? null : (
            <button
              type="button"
              onClick={addScheduleRow}
              disabled={disabled || isSaving}
              className="text-xs font-medium text-[#004b87] hover:underline disabled:opacity-40"
            >
              일정 추가
            </button>
          )}
        </div>
        <div className="space-y-2">
          {scheduleRows.map((step, index) => (
            <div
              key={`schedule-${index}`}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]"
            >
              <input
                type="text"
                value={step.단계}
                onChange={(event) =>
                  updateSchedule(index, "단계", event.target.value)
                }
                disabled={disabled || readOnly || isSaving}
                placeholder="단계 (예: 입찰서 제출)"
                className={inputClassName}
              />
              <input
                type="text"
                value={step.날짜}
                onChange={(event) =>
                  updateSchedule(index, "날짜", event.target.value)
                }
                disabled={disabled || readOnly || isSaving}
                placeholder="날짜·시간"
                className={inputClassName}
              />
              {readOnly ? (
                <span className="hidden sm:block" />
              ) : (
                <button
                  type="button"
                  onClick={() => removeScheduleRow(index)}
                  disabled={disabled || isSaving || scheduleRows.length <= 1}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:bg-white disabled:opacity-40"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {readOnly ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            disabled={disabled}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            수정
          </button>
        ) : (
          <>
            {confirmed ? (
              <button
                type="button"
                onClick={() => {
                  setForm(
                    resolveKeyFieldsFormValues(
                      summary,
                      confirmation,
                      noticeTitle,
                    ),
                  );
                  setIsEditing(false);
                  setError("");
                }}
                disabled={disabled || isSaving}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                취소
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={disabled || isSaving}
              className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-medium text-white hover:bg-[#003a66] disabled:opacity-40"
            >
              {isSaving ? "저장 중…" : "확인 완료"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

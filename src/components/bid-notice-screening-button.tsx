"use client";

import {
  SCREENING_STATUS_LABELS,
  type BidNoticeScreeningStatus,
} from "@/lib/bid-notices/screening";

const STATUS_BUTTON_CLASS: Record<BidNoticeScreeningStatus, string> = {
  WAITING:
    "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
  EXCLUDED:
    "border-slate-400 bg-slate-100 text-slate-500 hover:bg-slate-200",
  TARGET:
    "border-[#004b87]/40 bg-[#004b87]/10 font-semibold text-[#004b87] hover:bg-[#004b87]/15",
};

const MODAL_STATUS_BUTTON_CLASS: Record<BidNoticeScreeningStatus, string> = {
  WAITING:
    "border-white/30 bg-white/10 text-white/90 hover:bg-white/20",
  EXCLUDED:
    "border-white/20 bg-white/5 text-white/60 line-through hover:bg-white/15",
  TARGET:
    "border-[#a4ce39]/50 bg-[#a4ce39]/25 font-semibold text-white hover:bg-[#a4ce39]/35",
};

interface BidNoticeScreeningButtonProps {
  status: BidNoticeScreeningStatus;
  disabled?: boolean;
  onCycle: () => void;
  variant?: "table" | "modal";
}

export function BidNoticeScreeningButton({
  status,
  disabled,
  onCycle,
  variant = "table",
}: BidNoticeScreeningButtonProps) {
  const classMap =
    variant === "modal" ? MODAL_STATUS_BUTTON_CLASS : STATUS_BUTTON_CLASS;
  const sizeClass =
    variant === "modal"
      ? "rounded-lg px-3 py-1.5 text-xs font-medium"
      : "w-full rounded px-0.5 py-0.5 text-[10px] leading-tight";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onCycle();
      }}
      disabled={disabled}
      title="클릭 시 대기 → 미대상 → 대상 순으로 변경"
      className={`border disabled:opacity-40 ${sizeClass} ${classMap[status]}`}
    >
      {SCREENING_STATUS_LABELS[status]}
    </button>
  );
}

export function getScreeningRowTextClass(
  status: BidNoticeScreeningStatus,
): string {
  if (status === "EXCLUDED") {
    return "line-through text-slate-400";
  }
  if (status === "TARGET") {
    return "font-bold text-slate-900";
  }
  return "text-slate-600";
}

export function getScreeningTitleClass(
  status: BidNoticeScreeningStatus,
): string {
  if (status === "EXCLUDED") {
    return "line-through text-slate-400";
  }
  if (status === "TARGET") {
    return "font-bold text-[#004b87]";
  }
  return "font-medium text-[#004b87]";
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { BidNoticeFavoriteButton } from "@/components/bid-notice-favorite-button";
import { BidNoticeScreeningButton } from "@/components/bid-notice-screening-button";
import { BidNoticeAttachmentsPanel } from "@/components/bid-notice-attachments-panel";
import { BidNoticeAssignmentFields } from "@/components/bid-notice-assignment-fields";
import { BidNoticeWorkMenu } from "@/components/bid-notice-work-menu";
import {
  getBidPeriodProgress,
  getDeadlineCountdown,
  type DeadlineUrgency,
} from "@/lib/bid-notices/deadline";
import { MEMO_MAX_LENGTH } from "@/lib/bid-notices/memos";
import type { BidNoticeAssignment } from "@/lib/bid-notices/assignments";
import type { Department } from "@/lib/departments";
import {
  BID_NOTICE_TYPE_LABELS,
  type KhnpBidNoticeRow,
} from "@/lib/bid-notices/types";
import { isManualBidNotice } from "@/lib/bid-notices/manual-entry";
import type { BidNoticeScreeningStatus } from "@/lib/bid-notices/screening";
import type { NoticeActivityEntry } from "@/lib/bid-notices/notice-activity";
import {
  formatDate,
  formatDateTime,
  formatNoticePeriod,
  getOpenDetail,
  getPrivateDetail,
  splitDeptName,
} from "@/lib/bid-notices/utils";

interface BidNoticeDetailModalProps {
  notice: KhnpBidNoticeRow;
  siteName?: string;
  isFavorite: boolean;
  isTogglingFavorite?: boolean;
  isSubmitted?: boolean;
  isSubmittingBid?: boolean;
  isCancellingBid?: boolean;
  isEstimated?: boolean;
  isSubmittingEstimate?: boolean;
  isCancellingEstimate?: boolean;
  isOrderReported?: boolean;
  isSubmittingOrderReport?: boolean;
  isCancellingOrderReport?: boolean;
  onToggleFavorite: () => void;
  onSubmitBid?: () => void;
  onCancelBid?: () => void;
  onSubmitEstimate?: () => void;
  onCancelEstimate?: () => void;
  onOrderReport?: () => void;
  onCancelOrderReport?: () => void;
  onClose: () => void;
  initialMemo?: string;
  initialMemoUpdatedAt?: string | null;
  departments?: Department[];
  initialAssignment?: BidNoticeAssignment | null;
  onAssignmentSaved?: (assignment: BidNoticeAssignment) => void;
  screeningStatus?: BidNoticeScreeningStatus;
  isCyclingScreening?: boolean;
  onCycleScreening?: () => void;
  showFavorite?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  isDeleting?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  activities?: NoticeActivityEntry[];
}

function urgencyBadgeClass(urgency: DeadlineUrgency): string {
  switch (urgency) {
    case "expired":
      return "border-white/20 bg-white/10 text-white/80";
    case "urgent":
      return "border-amber-300/50 bg-amber-400/25 text-amber-50";
    case "warning":
      return "border-[#a4ce39]/50 bg-[#a4ce39]/25 text-white";
    default:
      return "border-white/30 bg-white/15 text-white";
  }
}

function noticeTypeBadgeClass(noticeType: KhnpBidNoticeRow["notice_type"]): string {
  switch (noticeType) {
    case "BID":
      return "bg-white/20 text-white ring-white/25";
    case "PRIVATE":
      return "bg-violet-400/30 text-violet-50 ring-violet-200/30";
    default:
      return "bg-sky-400/30 text-sky-50 ring-sky-200/30";
  }
}

function activityBadgeClass(kind: NoticeActivityEntry["kind"]): string {
  if (kind === "SCREENING") {
    return "bg-[#004b87]/10 text-[#004b87]";
  }
  return "bg-[#a4ce39]/15 text-[#3d5a14]";
}

export function BidNoticeDetailModal({
  notice,
  siteName,
  isFavorite,
  isTogglingFavorite,
  isSubmitted = false,
  isSubmittingBid = false,
  isCancellingBid = false,
  isEstimated = false,
  isSubmittingEstimate = false,
  isCancellingEstimate = false,
  isOrderReported = false,
  isSubmittingOrderReport = false,
  isCancellingOrderReport = false,
  onToggleFavorite,
  onSubmitBid,
  onCancelBid,
  onSubmitEstimate,
  onCancelEstimate,
  onOrderReport,
  onCancelOrderReport,
  onClose,
  initialMemo = "",
  initialMemoUpdatedAt = null,
  departments = [],
  initialAssignment = null,
  onAssignmentSaved,
  screeningStatus = "WAITING",
  isCyclingScreening = false,
  onCycleScreening,
  showFavorite = true,
  canEdit = false,
  canDelete = false,
  isDeleting = false,
  onEdit,
  onDelete,
  activities = [],
}: BidNoticeDetailModalProps) {
  const open = getOpenDetail(notice);
  const priv = getPrivateDetail(notice);
  const showWorkMenu = Boolean(onOrderReport || onSubmitBid || onSubmitEstimate);
  const countdown = getDeadlineCountdown(notice);
  const bidProgress =
    notice.notice_type === "BID" && open
      ? getBidPeriodProgress(open.bid_start_dt, open.bid_close_dt)
      : null;

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

  return (
    <div
      className="detail-modal-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bid-notice-detail-title"
      onClick={onClose}
    >
      <div
        className="detail-modal-panel-in flex max-h-[94vh] w-full max-w-detail-modal flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl ring-1 ring-black/5 sm:max-h-[90vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#004b87] via-[#0068a8] to-[#009ada] px-5 pb-5 pt-4 text-white sm:px-7 sm:pb-6 sm:pt-5">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-8 left-1/3 h-32 w-32 rounded-full bg-[#a4ce39]/20 blur-2xl"
            aria-hidden
          />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${noticeTypeBadgeClass(notice.notice_type)}`}
              >
                {BID_NOTICE_TYPE_LABELS[notice.notice_type]}
              </span>
              {siteName ? (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90 ring-1 ring-inset ring-white/15">
                  {siteName}
                </span>
              ) : null}
              {isManualBidNotice(notice) ? (
                <span className="rounded-full bg-[#a4ce39]/25 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-[#a4ce39]/40">
                  직접등록
                </span>
              ) : null}
              {countdown ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${urgencyBadgeClass(countdown.urgency)}`}
                >
                  <ClockIcon className="h-3 w-3" />
                  {countdown.label}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/90 ring-1 ring-white/20 transition hover:bg-white/20"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <h2
            id="bid-notice-detail-title"
            className="relative mt-3 text-lg font-bold leading-snug tracking-tight sm:text-xl"
          >
            {notice.title}
          </h2>

          <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/75">
            <CopyableNoticeNo noticeNo={notice.notice_no} />
            {notice.notice_date ? (
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
                {formatDate(notice.notice_date)}
              </span>
            ) : null}
            {notice.dept_name ? (
              <span className="inline-flex items-center gap-1">
                <BuildingIcon className="h-3.5 w-3.5 opacity-70" />
                {splitDeptName(notice.dept_name)?.firstLine ?? notice.dept_name}
              </span>
            ) : null}
          </div>

          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            {showFavorite ? (
              <BidNoticeFavoriteButton
                isFavorite={isFavorite}
                disabled={isTogglingFavorite}
                onToggle={onToggleFavorite}
              />
            ) : null}
            {onCycleScreening ? (
              <BidNoticeScreeningButton
                status={screeningStatus}
                disabled={isCyclingScreening}
                onCycle={onCycleScreening}
                variant="modal"
              />
            ) : null}
            {showWorkMenu ? (
              <BidNoticeWorkMenu
                variant="modal"
                isOrderReported={isOrderReported}
                isSubmitted={isSubmitted}
                isEstimated={isEstimated}
                isSubmittingOrderReport={isSubmittingOrderReport}
                isSubmittingBid={isSubmittingBid}
                isSubmittingEstimate={isSubmittingEstimate}
                onOrderReport={onOrderReport ?? (() => {})}
                onSubmitBid={onSubmitBid ?? (() => {})}
                onSubmitEstimate={onSubmitEstimate ?? (() => {})}
              />
            ) : null}
            <WorkStatusBadges
              isOrderReported={isOrderReported}
              isSubmitted={isSubmitted}
              isEstimated={isEstimated}
            />
            <CancelActionButtons
              isOrderReported={isOrderReported}
              isSubmitted={isSubmitted}
              isEstimated={isEstimated}
              isCancellingOrderReport={isCancellingOrderReport}
              isCancellingBid={isCancellingBid}
              isCancellingEstimate={isCancellingEstimate}
              onCancelOrderReport={onCancelOrderReport}
              onCancelBid={onCancelBid}
              onCancelEstimate={onCancelEstimate}
              onOrderReport={onOrderReport}
              onSubmitBid={onSubmitBid}
              onSubmitEstimate={onSubmitEstimate}
            />
            {canEdit && onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
              >
                수정
              </button>
            ) : null}
            {canDelete && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="rounded-lg border border-red-300/40 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-50 hover:bg-red-500/30 disabled:opacity-40"
              >
                {isDeleting ? "삭제 중…" : "삭제"}
              </button>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <section>
            <SectionHeading icon={<DocumentIcon />} title="공고 개요" />
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailCard label="공고번호" value={notice.notice_no} mono />
              <DetailCard label="공고구분" value={notice.notice_div} />
              <DetailCard label="원사전공고번호" value={notice.origin_notice_no} />
              <DeptNameDetailCard deptName={notice.dept_name} />
              <DetailCard label="공고일시" value={formatDate(notice.notice_date)} />
              <DetailCard label="공고기간" value={formatNoticePeriod(notice)} highlight />
            </dl>
          </section>

          {activities.length > 0 ? (
            <section className="mt-6">
              <SectionHeading icon={<UsersIcon />} title="선별·작업 이력" />
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <ul className="divide-y divide-slate-100">
                  {activities.map((entry) => (
                    <li
                      key={`${entry.kind}-${entry.id}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
                    >
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${activityBadgeClass(entry.kind)}`}
                      >
                        {entry.actionLabel}
                      </span>
                      <span className="font-medium text-slate-800">
                        {entry.userName}
                        {entry.userDepartment ? (
                          <span className="font-normal text-slate-500">
                            {" "}
                            · {entry.userDepartment}
                          </span>
                        ) : null}
                      </span>
                      <span className="ml-auto text-xs text-slate-400">
                        {formatDateTime(entry.performedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {notice.notice_type === "BID" && open ? (
            <section className="mt-6">
              <SectionHeading icon={<GavelIcon />} title="입찰 정보" />
              {bidProgress != null ? (
                <BidTimeline
                  progress={bidProgress}
                  startLabel={formatDateTime(open.bid_start_dt)}
                  closeLabel={formatDateTime(open.bid_close_dt)}
                  countdown={countdown}
                />
              ) : null}
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailCard label="진행상태" value={open.status} accent />
                <DetailCard label="입찰방식" value={open.bid_method} />
                <DetailCard label="국내/국제" value={open.domestic_flag} />
                <DetailCard label="구매유형" value={open.purchase_type} />
                <DetailCard
                  label="입찰개시"
                  value={formatDateTime(open.bid_start_dt)}
                />
                <DetailCard
                  label="입찰마감"
                  value={formatDateTime(open.bid_close_dt)}
                  highlight
                />
                <DetailCard
                  label="낙찰자결정방법"
                  value={open.award_method}
                  className="sm:col-span-2 lg:col-span-3"
                />
              </dl>
            </section>
          ) : null}

          {notice.notice_type === "PRIVATE" && priv?.main_content ? (
            <section className="mt-6">
              <SectionHeading icon={<ListIcon />} title="주요구매내용" />
              <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {priv.main_content}
                </p>
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <SectionHeading icon={<PaperclipIcon />} title="첨부파일" />
            <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <BidNoticeAttachmentsPanel noticeId={notice.id} embedded />
            </div>
          </section>

          <section className="mt-6">
            <SectionHeading icon={<BuildingIcon />} title="담당 지정" />
            <p className="mt-2 text-xs text-slate-500">
              담당부서는 필수이며, 담당자는 선택 사항입니다. 부서를 선택하면 해당
              부서 소속 사용자만 담당자로 지정할 수 있습니다.
            </p>
            <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <BidNoticeAssignmentFields
                noticeId={notice.id}
                departments={departments}
                assignment={initialAssignment}
                onSaved={onAssignmentSaved}
              />
            </div>
          </section>

          <BidNoticeMemoEditor
            noticeId={notice.id}
            initialMemo={initialMemo}
            initialUpdatedAt={initialMemoUpdatedAt}
          />
        </div>
      </div>
    </div>
  );
}

function WorkStatusBadges({
  isOrderReported,
  isSubmitted,
  isEstimated,
}: {
  isOrderReported: boolean;
  isSubmitted: boolean;
  isEstimated: boolean;
}) {
  if (!isOrderReported && !isSubmitted && !isEstimated) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isOrderReported ? (
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/20">
          발주 ✓
        </span>
      ) : null}
      {isSubmitted ? (
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/20">
          입찰 ✓
        </span>
      ) : null}
      {isEstimated ? (
        <span className="rounded-full bg-[#a4ce39]/30 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-[#a4ce39]/40">
          견적 ✓
        </span>
      ) : null}
    </div>
  );
}

function CancelActionButtons({
  isOrderReported,
  isSubmitted,
  isEstimated,
  isCancellingOrderReport,
  isCancellingBid,
  isCancellingEstimate,
  onCancelOrderReport,
  onCancelBid,
  onCancelEstimate,
  onOrderReport,
  onSubmitBid,
  onSubmitEstimate,
}: {
  isOrderReported: boolean;
  isSubmitted: boolean;
  isEstimated: boolean;
  isCancellingOrderReport: boolean;
  isCancellingBid: boolean;
  isCancellingEstimate: boolean;
  onCancelOrderReport?: () => void;
  onCancelBid?: () => void;
  onCancelEstimate?: () => void;
  onOrderReport?: () => void;
  onSubmitBid?: () => void;
  onSubmitEstimate?: () => void;
}) {
  return (
    <>
      {isOrderReported && onCancelOrderReport ? (
        <button
          type="button"
          onClick={onCancelOrderReport}
          disabled={isCancellingOrderReport}
          className="rounded-lg border border-red-300/40 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-50 hover:bg-red-500/30 disabled:opacity-40"
        >
          {isCancellingOrderReport ? "취소 중…" : "발주취소"}
        </button>
      ) : null}
      {isOrderReported && !onCancelOrderReport && !onOrderReport ? (
        <span className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/20">
          발주 등록됨
        </span>
      ) : null}
      {isSubmitted && onCancelBid ? (
        <button
          type="button"
          onClick={onCancelBid}
          disabled={isCancellingBid}
          className="rounded-lg border border-red-300/40 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-50 hover:bg-red-500/30 disabled:opacity-40"
        >
          {isCancellingBid ? "취소 중…" : "입찰취소"}
        </button>
      ) : null}
      {isSubmitted && !onCancelBid && !onSubmitBid ? (
        <span className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/20">
          입찰 등록됨
        </span>
      ) : null}
      {isEstimated && onCancelEstimate ? (
        <button
          type="button"
          onClick={onCancelEstimate}
          disabled={isCancellingEstimate}
          className="rounded-lg border border-red-300/40 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-50 hover:bg-red-500/30 disabled:opacity-40"
        >
          {isCancellingEstimate ? "취소 중…" : "견적취소"}
        </button>
      ) : null}
      {isEstimated && !onCancelEstimate && !onSubmitEstimate ? (
        <span className="rounded-lg bg-[#a4ce39]/25 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-[#a4ce39]/40">
          견적 등록됨
        </span>
      ) : null}
    </>
  );
}

function BidTimeline({
  progress,
  startLabel,
  closeLabel,
  countdown,
}: {
  progress: number;
  startLabel: string;
  closeLabel: string;
  countdown: ReturnType<typeof getDeadlineCountdown>;
}) {
  const isExpired = countdown?.urgency === "expired";

  return (
    <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-500">입찰 일정</span>
        <span
          className={`font-bold ${
            isExpired
              ? "text-slate-400"
              : countdown?.urgency === "urgent"
                ? "text-amber-600"
                : countdown?.urgency === "warning"
                  ? "text-[#009ada]"
                  : "text-[#004b87]"
          }`}
        >
          {isExpired ? "마감 완료" : `${progress}% 경과`}
        </span>
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
            isExpired
              ? "bg-slate-300"
              : "bg-gradient-to-r from-[#004b87] via-[#009ada] to-[#a4ce39]"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
        {!isExpired && progress > 0 && progress < 100 ? (
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#009ada] shadow-md"
            style={{ left: `${progress}%` }}
          />
        ) : null}
      </div>
      <div className="mt-2 flex justify-between gap-2 text-[11px] text-slate-500">
        <span>
          <span className="font-medium text-slate-400">개시</span> {startLabel}
        </span>
        <span className="text-right">
          <span className="font-medium text-slate-400">마감</span> {closeLabel}
        </span>
      </div>
    </div>
  );
}

function CopyableNoticeNo({ noticeNo }: { noticeNo: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(noticeNo);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/90 ring-1 ring-white/15 transition hover:bg-white/20"
      title="공고번호 복사"
    >
      {noticeNo}
      <span className="text-[10px] opacity-70">{copied ? "복사됨" : "복사"}</span>
    </button>
  );
}

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#004b87]/10 text-[#004b87]">
        {icon}
      </span>
      <h3 className="text-sm font-bold tracking-tight text-slate-800">{title}</h3>
    </div>
  );
}

function DetailCard({
  label,
  value,
  className = "",
  mono = false,
  highlight = false,
  accent = false,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
  mono?: boolean;
  highlight?: boolean;
  accent?: boolean;
}) {
  const display = value?.trim() || "—";

  return (
    <div
      className={`rounded-xl border bg-white p-3.5 shadow-sm transition hover:shadow-md ${highlight ? "border-[#009ada]/30 ring-1 ring-[#009ada]/10" : "border-slate-200/80"} ${accent ? "border-[#004b87]/20 bg-gradient-to-br from-[#004b87]/5 to-transparent" : ""} ${className}`}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm font-medium leading-snug ${mono ? "font-mono text-[#004b87]" : "text-slate-800"} ${display === "—" ? "text-slate-300" : ""}`}
      >
        {display}
      </dd>
    </div>
  );
}

function DeptNameDetailCard({
  deptName,
  className = "",
}: {
  deptName: string | null | undefined;
  className?: string;
}) {
  const split = splitDeptName(deptName);

  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition hover:shadow-md ${className}`}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        공고부서
      </dt>
      <dd className="mt-1 text-sm font-medium leading-snug text-slate-800">
        {split ? (
          <>
            <div>{split.firstLine}</div>
            {split.secondLine ? (
              <div className="text-slate-500">{split.secondLine}</div>
            ) : null}
          </>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </dd>
    </div>
  );
}

function BidNoticeMemoEditor({
  noticeId,
  initialMemo,
  initialUpdatedAt,
}: {
  noticeId: string;
  initialMemo: string;
  initialUpdatedAt: string | null;
}) {
  const [memo, setMemo] = useState(initialMemo);
  const [savedMemo, setSavedMemo] = useState(initialMemo);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMemo(initialMemo);
    setSavedMemo(initialMemo);
    setUpdatedAt(initialUpdatedAt);
    setError("");
  }, [noticeId, initialMemo, initialUpdatedAt]);

  const isDirty = memo !== savedMemo;

  const saveMemo = useCallback(async () => {
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/bid-notice-memos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeId, memo }),
      });
      const data = (await response.json()) as {
        memo?: string;
        updatedAt?: string | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "메모 저장에 실패했습니다.");
      }
      const nextMemo = data.memo ?? "";
      setMemo(nextMemo);
      setSavedMemo(nextMemo);
      setUpdatedAt(data.updatedAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "메모 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }, [noticeId, memo]);

  const formattedUpdatedAt =
    updatedAt && !Number.isNaN(new Date(updatedAt).getTime())
      ? new Date(updatedAt).toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading icon={<MemoIcon />} title="내 메모" />
        {formattedUpdatedAt ? (
          <span className="text-xs text-slate-400">
            마지막 저장 {formattedUpdatedAt}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        이 공고에 필요한 정보를 자유롭게 기록합니다. 로그인한 본인만 볼 수
        있습니다.
      </p>
      <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={MEMO_MAX_LENGTH}
          rows={5}
          placeholder="담당자 연락처, 검토 사항, 입찰 일정 등 필요한 내용을 입력하세요."
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#009ada] focus:bg-white focus:ring-2 focus:ring-[#009ada]/20"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {memo.length.toLocaleString("ko-KR")} /{" "}
            {MEMO_MAX_LENGTH.toLocaleString("ko-KR")}자
            {isDirty ? (
              <span className="ml-1 font-medium text-amber-600">· 저장되지 않은 변경</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => saveMemo()}
            disabled={isSaving || !isDirty}
            className="rounded-xl bg-gradient-to-r from-[#004b87] to-[#0068a8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-40"
          >
            {isSaving ? "저장 중…" : "메모 저장"}
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        ) : null}
      </div>
    </section>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 21V9l8-4 8 4v12" strokeLinejoin="round" />
      <path d="M9 21v-6h6v6M9 12h.01M15 12h.01" strokeLinecap="round" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" strokeLinejoin="round" />
      <path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" />
    </svg>
  );
}

function GavelIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 4l6 6-3 3-6-6 3-3z" strokeLinejoin="round" />
      <path d="M5 19l4-4M3 21l2-2" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" strokeLinecap="round" />
    </svg>
  );
}

function MemoIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  );
}

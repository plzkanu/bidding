"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { DashboardNoticeCalendar } from "@/lib/bid-notices/dashboard";
import {
  getKstTodayYmd,
  getKstWeekdayFromYmd,
  listKstYmdRange,
} from "@/lib/bid-notices/notice-date";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const CELL_MIN_HEIGHT = "min-h-[3.5rem]";

interface DashboardNoticeCalendarProps {
  calendar: DashboardNoticeCalendar | null;
  siteId: number | null;
  isLoading?: boolean;
}

function parseYmd(ymd: string): { month: number; day: number } {
  const [, month, day] = ymd.split("-").map(Number);
  return { month: month ?? 1, day: day ?? 1 };
}

function buildRollingRangeCells(
  rangeStart: string,
  rangeEnd: string,
): Array<{ ymd: string | null; day: number | null; month: number | null }> {
  const days = listKstYmdRange(rangeStart, rangeEnd);
  const cells: Array<{ ymd: string | null; day: number | null; month: number | null }> =
    [];

  const leading = getKstWeekdayFromYmd(rangeStart);
  for (let i = 0; i < leading; i += 1) {
    cells.push({ ymd: null, day: null, month: null });
  }

  for (const ymd of days) {
    const { month, day } = parseYmd(ymd);
    cells.push({ ymd, day, month });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ ymd: null, day: null, month: null });
  }

  return cells;
}

export function DashboardNoticeCalendar({
  calendar,
  siteId,
  isLoading = false,
}: DashboardNoticeCalendarProps) {
  const router = useRouter();
  const todayYmd = getKstTodayYmd();
  const rangeStart = calendar?.rangeStart ?? todayYmd;
  const rangeEnd = calendar?.rangeEnd ?? todayYmd;

  const cells = useMemo(
    () => buildRollingRangeCells(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  function handleDayClick(ymd: string) {
    const count = calendar?.countsByDate[ymd] ?? 0;
    if (count <= 0 || siteId == null) return;

    const params = new URLSearchParams({
      siteId: String(siteId),
      noticeDate: ymd,
    });
    router.push(`/dashboard/announcements?${params}`);
  }

  if (isLoading) {
    return (
      <div className="px-3 py-10 text-center text-[12px] text-[#6B7280]">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <p className="mb-2 text-[11px] leading-snug text-[#6B7280]">
        공고일시 기준 · 오늘 포함 최근 30일
        <br />
        <span className="text-[#0F2645]">
          {rangeStart} ~ {rangeEnd}
        </span>
      </p>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-[#6B7280]">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell.ymd || cell.day == null) {
            return (
              <div
                key={`empty-${index}`}
                className={`${CELL_MIN_HEIGHT} rounded-md bg-transparent`}
              />
            );
          }

          const count = calendar?.countsByDate[cell.ymd] ?? 0;
          const isToday = cell.ymd === todayYmd;
          const clickable = count > 0 && siteId != null;
          const showMonth = cell.day === 1 || cell.ymd === rangeStart;

          return (
            <button
              key={cell.ymd}
              type="button"
              disabled={!clickable}
              onClick={() => handleDayClick(cell.ymd!)}
              title={
                clickable
                  ? `${cell.ymd} · ${count}건 · 입찰공고 조회`
                  : `${cell.ymd}`
              }
              className={`flex ${CELL_MIN_HEIGHT} flex-col items-center justify-center rounded-md border px-0.5 py-1 transition-colors ${
                isToday
                  ? "border-[#1E5FD4]/40 bg-white"
                  : "border-[#E8EAED] bg-white"
              } ${
                clickable
                  ? "cursor-pointer hover:border-[#1E5FD4]/50 hover:bg-[#E8F0FE]"
                  : "cursor-default"
              }`}
            >
              {showMonth && cell.month ? (
                <span className="text-[9px] leading-none text-[#6B7280]">
                  {cell.month}월
                </span>
              ) : null}
              <span
                className={`text-[12px] font-medium leading-none ${
                  isToday ? "text-[#1E5FD4]" : "text-[#0F2645]"
                }`}
              >
                {cell.day}
              </span>
              {count > 0 ? (
                <span className="mt-1 min-w-[1.25rem] rounded-full bg-[#1E5FD4] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {count}
                </span>
              ) : (
                <span className="mt-1 text-[10px] leading-none text-[#BCC0C8]">
                  -
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[11px] leading-snug text-[#6B7280]">
        숫자를 클릭하면 입찰공고 조회 화면에서
        <br />
        해당 일자 공고를 조회합니다.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface BidNoticeWorkMenuProps {
  isOrderReported: boolean;
  isSubmitted: boolean;
  isEstimated: boolean;
  isSubmittingOrderReport?: boolean;
  isSubmittingBid?: boolean;
  isSubmittingEstimate?: boolean;
  onOrderReport: () => void;
  onSubmitBid: () => void;
  onSubmitEstimate: () => void;
  variant?: "table" | "modal";
}

function workMenuItemClass(active: boolean, accent?: "navy" | "blue" | "green") {
  const base =
    "block w-full px-3 py-1.5 text-left transition disabled:opacity-40";
  if (!active) {
    if (accent === "blue") {
      return `${base} text-[#004b87] hover:bg-[#009ada]/10`;
    }
    if (accent === "green") {
      return `${base} text-[#3d5c00] hover:bg-[#a4ce39]/15`;
    }
    return `${base} text-slate-700 hover:bg-slate-50`;
  }
  if (accent === "green") {
    return `${base} font-medium text-[#3d5c00] hover:bg-[#a4ce39]/15`;
  }
  if (accent === "blue") {
    return `${base} font-medium text-[#004b87] hover:bg-[#009ada]/10`;
  }
  return `${base} font-medium text-[#004b87] hover:bg-[#004b87]/5`;
}

export function BidNoticeWorkMenu({
  isOrderReported,
  isSubmitted,
  isEstimated,
  isSubmittingOrderReport = false,
  isSubmittingBid = false,
  isSubmittingEstimate = false,
  onOrderReport,
  onSubmitBid,
  onSubmitEstimate,
  variant = "table",
}: BidNoticeWorkMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isBusy =
    isSubmittingOrderReport || isSubmittingBid || isSubmittingEstimate;
  const hasActive = isOrderReported || isSubmitted || isEstimated;

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !containerRef.current) {
      setMenuPosition(null);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const menuWidth = 120;
    setMenuPosition({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function stopRowClick(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  function closeAndRun(action: () => void) {
    setOpen(false);
    action();
  }

  let triggerLabel = "작업";
  if (isBusy) {
    triggerLabel = "…";
  } else if (hasActive) {
    const parts: string[] = [];
    if (isOrderReported) parts.push("발주");
    if (isSubmitted) parts.push("입찰");
    if (isEstimated) parts.push("견적");
    triggerLabel = parts.join("·");
  }

  const triggerClass =
    variant === "modal"
      ? `rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
          hasActive
            ? "border-white/30 bg-white/15 text-white hover:bg-white/25"
            : "border-white/25 bg-white/10 text-white hover:bg-white/20"
        }`
      : `rounded border px-1 py-0.5 text-[11px] font-semibold leading-tight disabled:opacity-40 ${
          hasActive
            ? "border-[#004b87]/30 text-[#004b87] hover:bg-[#004b87]/5"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`;

  return (
    <div
      ref={containerRef}
      className="relative inline-block text-left"
      data-no-row-click
      onClick={stopRowClick}
      onMouseDown={stopRowClick}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (!isBusy) {
            setOpen((value) => !value);
          }
        }}
        disabled={isBusy}
        aria-expanded={open}
        aria-haspopup="menu"
        className={triggerClass}
      >
        {triggerLabel}
        <span className="ml-0.5 opacity-60" aria-hidden>
          ▾
        </span>
      </button>

      {open && mounted && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[200] min-w-[7.5rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
              }}
              data-no-row-click
              onClick={stopRowClick}
              onMouseDown={stopRowClick}
            >
              <button
                type="button"
                role="menuitem"
                disabled={isSubmittingOrderReport}
                className={workMenuItemClass(isOrderReported)}
                onClick={(event) => {
                  event.stopPropagation();
                  closeAndRun(onOrderReport);
                }}
              >
                {isSubmittingOrderReport
                  ? "등록 중…"
                  : isOrderReported
                    ? "발주 화면으로"
                    : "발주보고"}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={isSubmittingBid}
                className={workMenuItemClass(isSubmitted, "blue")}
                onClick={(event) => {
                  event.stopPropagation();
                  closeAndRun(onSubmitBid);
                }}
              >
                {isSubmittingBid
                  ? "등록 중…"
                  : isSubmitted
                    ? "입찰 화면으로"
                    : "입찰하기"}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={isSubmittingEstimate}
                className={workMenuItemClass(isEstimated, "green")}
                onClick={(event) => {
                  event.stopPropagation();
                  closeAndRun(onSubmitEstimate);
                }}
              >
                {isSubmittingEstimate
                  ? "등록 중…"
                  : isEstimated
                    ? "견적 화면으로"
                    : "견적내기"}
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

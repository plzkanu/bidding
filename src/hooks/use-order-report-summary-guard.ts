"use client";

import { useEffect } from "react";

const GUARD_ALLOW_SELECTOR = "[data-summary-guard-allow]";

/**
 * 요약 생성 중 브라우저 이탈·뒤로가기·링크 클릭을 차단합니다.
 */
export function useOrderReportSummaryGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const trapHistory = () => {
      window.history.pushState({ summaryGuard: true }, "", window.location.href);
    };

    const onPopState = () => {
      trapHistory();
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(GUARD_ALLOW_SELECTOR)) return;

      const anchor = target.closest("a[href]");
      if (anchor) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    trapHistory();
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [active]);
}

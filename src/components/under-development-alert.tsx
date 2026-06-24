"use client";

interface UnderDevelopmentAlertProps {
  message: string;
  onDismiss?: () => void;
}

export function UnderDevelopmentAlert({
  message,
  onDismiss,
}: UnderDevelopmentAlertProps) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <span className="mt-0.5 shrink-0 font-semibold text-amber-700">개발 중</span>
      <p className="flex-1 leading-relaxed">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
          aria-label="닫기"
        >
          닫기
        </button>
      ) : null}
    </div>
  );
}

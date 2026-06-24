interface ScreeningKeywordChipsProps {
  keywords: string[];
  inactiveKeywords?: string[];
  className?: string;
  onRemove?: (keyword: string) => void;
  onClick?: (keyword: string) => void;
  removable?: boolean;
}

export function ScreeningKeywordChips({
  keywords,
  inactiveKeywords = [],
  className = "",
  onRemove,
  onClick,
  removable = false,
}: ScreeningKeywordChipsProps) {
  const inactiveSet = new Set(inactiveKeywords.map((k) => k.toLowerCase()));

  if (keywords.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {keywords.map((keyword) => {
        const isInactive = inactiveSet.has(keyword.toLowerCase());

        return (
          <span
            key={keyword}
            className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              isInactive
                ? "bg-slate-100 text-slate-400 line-through"
                : "bg-[#E8F0FE] text-[#004b87]"
            } ${onClick ? "cursor-pointer hover:ring-1 hover:ring-[#009ada]/40" : ""}`}
            title={isInactive ? "비활성 키워드" : keyword}
            onClick={onClick ? () => onClick(keyword) : undefined}
            onKeyDown={
              onClick
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onClick(keyword);
                    }
                  }
                : undefined
            }
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
          >
            <span className="truncate">{keyword}</span>
            {removable && onRemove ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(keyword);
                }}
                className="rounded-full p-0.5 text-[#004b87]/70 hover:bg-[#004b87]/10 hover:text-[#004b87]"
                aria-label={`${keyword} 삭제`}
              >
                ×
              </button>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

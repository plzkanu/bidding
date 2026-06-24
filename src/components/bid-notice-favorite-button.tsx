"use client";

interface BidNoticeFavoriteButtonProps {
  isFavorite: boolean;
  disabled?: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}

export function BidNoticeFavoriteButton({
  isFavorite,
  disabled,
  onToggle,
  size = "md",
}: BidNoticeFavoriteButtonProps) {
  const sizeClass = size === "sm" ? "text-sm" : "text-lg";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      aria-label={isFavorite ? "관심공고 해제" : "관심공고 등록"}
      aria-pressed={isFavorite}
      title={isFavorite ? "관심공고 해제" : "관심공고 등록"}
      className={`${sizeClass} leading-none text-amber-500 transition hover:scale-110 disabled:opacity-40`}
    >
      {isFavorite ? "★" : "☆"}
    </button>
  );
}

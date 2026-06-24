/** 붙여 쓴 한글(공백 누락) 복구 — LLM·HWP 추출 후처리 */

const HANGUL = /[가-힣]/;

const PARTICLES_LONG_TO_SHORT = [
  "에서는",
  "으로는",
  "으로",
  "에서",
  "부터",
  "까지",
  "에게",
  "께서",
  "이며",
  "으며",
  "이나",
  "하며",
  "이고",
  "에는",
  "으로서",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "에",
  "와",
  "과",
  "도",
  "만",
  "로",
] as const;

const STUCK_BOUNDARY_WORDS = [
  "또는",
  "및",
  "등",
  "경우",
  "따라",
  "의하여",
  "관한",
  "위한",
  "대한",
  "제출",
  "입찰",
  "계약",
  "참가",
  "등록",
  "신청",
  "낙찰",
  "자격",
  "면허",
  "실적",
  "문서",
  "서류",
  "업체",
  "사업자",
] as const;

/** 문서 제목용 음절 분리 (예: 용 역 입 찰 → 용역입찰) */
const HWP_TITLE_LINE = /^(?:[\uAC00-\uD7A3] ){3,}[\uAC00-\uD7A3]$/u;

export function isLikelyMissingSpaces(text: string): boolean {
  const hangul = text.match(/[가-힣]/gu)?.length ?? 0;
  if (hangul < 10) return false;

  const spaces = text.match(/ /g)?.length ?? 0;
  return spaces < hangul / 10;
}

function collapseHwpTitleLine(line: string): string {
  const trimmed = line.trim();
  if (!HWP_TITLE_LINE.test(trimmed)) return line;
  return trimmed.replace(/ /g, "");
}

function restoreKoreanSpacingLine(line: string): string {
  if (!line.trim() || !isLikelyMissingSpaces(line)) return line;

  let result = line;

  result = result.replace(/([。．.,，;；:：)])(?=[가-힣「『])/gu, "$1 ");
  result = result.replace(/([」』】])(?=[가-힣])/gu, "$1 ");
  result = result.replace(/([가-힣])([「『【(])/gu, "$1 $2");
  result = result.replace(/([가-힣])(\d)/gu, "$1 $2");
  result = result.replace(/(\d)([가-힣])/gu, "$1 $2");

  result = result.replace(
    /(합니다|됩니다|있습니다|없습니다|하여야|해야|이어야|이어야함|아니됨)(?=[가-힣])/gu,
    "$1 ",
  );

  result = result.replace(/(할)(수)(?=[가-힣])/gu, "$1 $2 ");
  result = result.replace(/(수)(없|있)(?=[가-힣])/gu, "$1 $2");

  for (const particle of PARTICLES_LONG_TO_SHORT) {
    const re = new RegExp(`([가-힣]{2,})(${particle})(?=[가-힣])`, "gu");
    result = result.replace(re, `$1${particle} `);
  }

  for (const word of STUCK_BOUNDARY_WORDS) {
    const re = new RegExp(`([가-힣])(${word})(?=[가-힣])`, "gu");
    result = result.replace(re, `$1 $2`);
  }

  result = result.replace(/([가-힣])(할|한|하는|되는|있는|없는)(?=[가-힣]{2,})/gu, "$1$2 ");

  return result.replace(/ {2,}/g, " ");
}

/** 붙어 있는 한글에 띄어쓰기 복구 (제목 음절 분리는 유지) */
export function restoreKoreanSpacing(text: string): string {
  if (!text) return text;

  return text
    .split("\n")
    .map((line) => {
      const collapsedTitle = collapseHwpTitleLine(line);
      if (collapsedTitle !== line) return collapsedTitle;
      return restoreKoreanSpacingLine(line);
    })
    .join("\n");
}

export function normalizeKoreanSummaryText(text: string): string {
  if (!text || !HANGUL.test(text)) return text;
  if (!isLikelyMissingSpaces(text)) return text;
  return restoreKoreanSpacing(text);
}

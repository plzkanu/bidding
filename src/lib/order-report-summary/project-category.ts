/** 공고·공사 제목에서 구분하는 공사 분류 */
export const PROJECT_CATEGORY_TERMS = ["기계설비", "전기", "용역"] as const;

export type ProjectCategoryTerm = (typeof PROJECT_CATEGORY_TERMS)[number];

/** 더 구체적인 분류를 우선한다. 기계설비 > 전기 > 용역 */
const CATEGORY_MATCH_ORDER: ProjectCategoryTerm[] = [
  "기계설비",
  "전기",
  "용역",
];

function compactTitle(value: string): string {
  return value.replace(/\s+/g, "");
}

export function extractProjectCategoryFromTitle(
  ...titles: Array<string | null | undefined>
): string {
  const compact = titles
    .map((title) => (title ? compactTitle(title) : ""))
    .filter(Boolean)
    .join("\n");

  if (!compact) return "";

  for (const term of CATEGORY_MATCH_ORDER) {
    if (compact.includes(term)) return term;
  }

  return "";
}

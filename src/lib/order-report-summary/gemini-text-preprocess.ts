/**
 * Gemini API 전달 직전 텍스트 정리.
 * ￦ 기호·숫자 뒤 하이픈(-)이 금액 오인을 유발하지 않도록 변환합니다.
 */

/** 전각 원화 기호 (U+FFE6) */
const FULLWIDTH_WON = /\uFFE6/g;

/** 일반 원화 기호 (U+20A9) — HWP 문서에서 혼용되는 경우 */
const WON_SIGN = /\u20A9/g;

/** 숫자(쉼표 포함) 바로 뒤 하이픈: 414,328,730- → 414,328,730 */
const TRAILING_HYPHEN_AFTER_NUMBER = /([0-9][0-9,]*)-/g;

export function preprocessTextForGemini(rawText: string): string {
  if (!rawText) return rawText;

  let cleaned = rawText.replace(FULLWIDTH_WON, "원 ");
  cleaned = cleaned.replace(WON_SIGN, "원 ");
  cleaned = cleaned.replace(TRAILING_HYPHEN_AFTER_NUMBER, "$1");

  return cleaned;
}

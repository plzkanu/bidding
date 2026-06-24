export const CLAUDE_DEFAULT_MODEL = "claude-sonnet-4-6";
export const EXAONE_DEFAULT_MODEL = "LGAI-EXAONE/K-EXAONE-236B-A23B";

/** 예산 정책: 1차 구현은 호출 횟수·토큰 상한 없음 */
export const ORDER_REPORT_SUMMARY_BUDGET_POLICY = "unlimited" as const;

export const ORDER_REPORT_SUMMARY_DEFAULT_MODEL = CLAUDE_DEFAULT_MODEL;

/** Claude Messages API 단일 요청 타임아웃(ms) */
export const ORDER_REPORT_SUMMARY_LLM_TIMEOUT_MS = 120_000;

/** LG엑사원 텍스트 분석 시 첨부 본문 합산 상한 (과대 입력·JSON 잘림 방지) */
export const EXAONE_MAX_TOTAL_TEXT_CHARS = 100_000;

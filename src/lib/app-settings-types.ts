/** 팝업 표시 후 연장하지 않으면 로그아웃까지의 유예(초) */
export const IDLE_TIMEOUT_GRACE_SECONDS = 60;

/** 기본 미사용 타임아웃(분). 0이면 비활성 */
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

export interface IdleTimeoutSettings {
  /** 미사용 허용 시간(분). 0이면 타임아웃 비활성 */
  idleTimeoutMinutes: number;
  /** 팝업 후 자동 로그아웃까지 유예(초) */
  graceSeconds: number;
}

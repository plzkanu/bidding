/** FriendliAI Dedicated Endpoint — EXAONE (OpenAI 호환) */

const DEFAULT_BASE_URL = "https://api.friendli.ai/dedicated";
const DEFAULT_ENDPOINT_ID = "deplsg7gyematop";

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

function withV1(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

export function getExaoneApiKey(): string {
  const key = process.env.FRIENDLI_TOKEN;
  if (!key) throw new Error("FRIENDLI_TOKEN 환경 변수가 필요합니다");
  return key;
}

export function getExaoneEndpointId(): string {
  return trimEnv(process.env.FRIENDLI_ENDPOINT_ID) || DEFAULT_ENDPOINT_ID;
}

export function getExaoneBaseUrl(): string {
  const explicit = trimEnv(process.env.FRIENDLI_BASE_URL);
  return withV1(explicit || DEFAULT_BASE_URL);
}

export function getExaoneTeamId(): string {
  return trimEnv(process.env.FRIENDLI_TEAM) || trimEnv(process.env.FRIENDLI_TEAM_ID);
}

/** Dedicated 요청의 model 필드는 Hugging Face 모델명이 아니라 엔드포인트 ID */
export function getExaoneModel(): string {
  return getExaoneEndpointId();
}

export function isExaoneConfigured(): boolean {
  return !!process.env.FRIENDLI_TOKEN;
}

export function isExaoneTlsInsecure(): boolean {
  const key = process.env.FRIENDLI_SSL_VERIFY;
  if (key === undefined) return false;
  return key.trim().toLowerCase() === "0" ||
    key.trim().toLowerCase() === "false" ||
    key.trim().toLowerCase() === "no" ||
    key.trim().toLowerCase() === "off";
}

export function getExaoneConfigError(): string | null {
  if (!isExaoneConfigured()) {
    return "FRIENDLI_TOKEN 환경 변수가 필요합니다. https://suite.friendli.ai/ 에서 API 키를 발급해 .env.local에 설정하세요.";
  }
  if (!getExaoneEndpointId()) {
    return "FRIENDLI_ENDPOINT_ID 환경 변수가 필요합니다. Friendli Dedicated Endpoint ID를 설정하세요.";
  }
  return null;
}

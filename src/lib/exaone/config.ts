/** FriendliAI Serverless API — EXAONE (OpenAI 호환) */

const DEFAULT_MODEL = "LGAI-EXAONE/K-EXAONE-236B-A23B";

export function getExaoneApiKey(): string {
  const key = process.env.FRIENDLI_TOKEN;
  if (!key) throw new Error("FRIENDLI_TOKEN 환경 변수가 필요합니다");
  return key;
}

export function getExaoneModel(): string {
  return process.env.FRIENDLI_MODEL ?? DEFAULT_MODEL;
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
  if (isExaoneConfigured()) {
    return null;
  }
  return "FRIENDLI_TOKEN 환경 변수가 필요합니다. https://suite.friendli.ai/ 에서 API 키를 발급해 .env.local에 설정하세요.";
}

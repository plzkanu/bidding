/** Anthropic Messages API — 서버 전용 */

export function getClaudeApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY 환경 변수가 필요합니다");
  return key;
}

export function getClaudeModel(): string {
  return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
}

export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function isClaudeTlsInsecure(): boolean {
  return process.env.CLAUDE_TLS_INSECURE === "true";
}

export function getClaudeConfigError(): string | null {
  if (isClaudeConfigured()) {
    return null;
  }
  return "ANTHROPIC_API_KEY 환경 변수가 필요합니다. Anthropic Console에서 API 키를 발급해 .env.local에 설정하세요.";
}

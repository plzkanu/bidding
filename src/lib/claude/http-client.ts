import https from "node:https";
import { getClaudeApiKey, isClaudeTlsInsecure } from "@/lib/claude/config";

function formatClaudeNetworkError(err: Error): Error {
  const nested = [err.message, (err.cause as Error | undefined)?.message]
    .filter(Boolean)
    .join(" ");

  if (nested.includes("self-signed certificate")) {
    return new Error(
      "Claude API SSL 인증서 검증에 실패했습니다. 회사 프록시 환경이면 .env.local에 CLAUDE_TLS_INSECURE=true를 추가하거나 NODE_EXTRA_CA_CERTS로 사내 CA 인증서 경로를 지정하세요.",
    );
  }

  return new Error(`Claude API 네트워크 오류: ${err.message}`);
}

function parseClaudeErrorMessage(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; type?: string };
    };
    if (json.error?.message) {
      const message = json.error.message;
      if (message.includes("100 PDF pages")) {
        return "첨부 PDF 페이지가 Claude API 한도(요청당 100페이지)를 초과했습니다. 첨부파일 수를 줄이거나 핵심 문서만 남겨 다시 시도해 주세요.";
      }
      return `${message} (HTTP ${status})`;
    }
  } catch {
    // ignore JSON parse errors
  }
  return `Claude API 오류 (HTTP ${status})`;
}

export async function callClaudeApi(
  body: object,
  timeoutMs: number,
): Promise<string> {
  const apiKey = getClaudeApiKey();
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        rejectUnauthorized: !isClaudeTlsInsecure(),
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new Error(parseClaudeErrorMessage(status, data)));
            return;
          }
          resolve(data);
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Claude API 요청 타임아웃 (${timeoutMs}ms)`));
    });

    req.on("error", (err) => {
      reject(formatClaudeNetworkError(err));
    });
    req.write(payload);
    req.end();
  });
}

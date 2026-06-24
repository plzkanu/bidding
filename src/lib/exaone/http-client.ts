import https from "node:https";
import { getExaoneApiKey, isExaoneTlsInsecure } from "@/lib/exaone/config";

const BASE_URL = "https://api.friendli.ai/serverless/v1";

function formatExaoneNetworkError(err: Error): Error {
  const nested = [err.message, (err.cause as Error | undefined)?.message]
    .filter(Boolean)
    .join(" ");

  if (nested.includes("CERTIFICATE_VERIFY_FAILED") || nested.includes("self-signed certificate")) {
    return new Error(
      "LG엑사원 API SSL 인증서 검증에 실패했습니다. 회사 VPN/방화벽 환경이면 .env.local에 FRIENDLI_SSL_VERIFY=0을 추가하세요.",
    );
  }

  return new Error(`LG엑사원 API 네트워크 오류: ${err.message}`);
}

function parseExaoneErrorMessage(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; code?: string };
    };
    if (json.error?.message) {
      if (status === 404) {
        return `모델을 찾을 수 없습니다. FRIENDLI_MODEL 환경 변수를 확인하세요. (${json.error.message})`;
      }
      return `${json.error.message} (HTTP ${status})`;
    }
  } catch {
    // ignore JSON parse errors
  }
  return `LG엑사원 API 오류 (HTTP ${status})`;
}

export async function callExaoneChatCompletions(
  body: object,
  timeoutMs: number,
): Promise<string> {
  const apiKey = getExaoneApiKey();
  const payload = JSON.stringify(body);
  const url = new URL(`${BASE_URL}/chat/completions`);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        rejectUnauthorized: !isExaoneTlsInsecure(),
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new Error(parseExaoneErrorMessage(status, data)));
            return;
          }
          resolve(data);
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`LG엑사원 API 요청 타임아웃 (${timeoutMs}ms)`));
    });

    req.on("error", (err) => {
      reject(formatExaoneNetworkError(err));
    });
    req.write(payload);
    req.end();
  });
}

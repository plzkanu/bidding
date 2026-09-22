import https from "node:https";
import {
  getExaoneApiKey,
  getExaoneBaseUrl,
  getExaoneEndpointId,
  getExaoneTeamId,
  isExaoneTlsInsecure,
} from "@/lib/exaone/config";

const READY_STATUSES = new Set(["RUNNING", "READY"]);
const WAKING_STATUSES = new Set([
  "SLEEPING",
  "AWAKING",
  "INITIALIZING",
  "UPDATING",
]);
const RESTARTABLE_STATUSES = new Set(["FAILED", "TERMINATED"]);
const STOPPING_STATUSES = new Set(["STOPPING", "TERMINATING"]);

const ENDPOINT_READY_TIMEOUT_MS = 600_000;
const ENDPOINT_POLL_INTERVAL_MS = 4_000;

type DedicatedEndpointStatus = {
  status?: string;
  phase?: string | null;
  errorCode?: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function unavailableEndpointMessage(detail?: string): string {
  const suffix = detail ? ` (${detail})` : "";
  return `LG엑사원 Dedicated Endpoint 기동이 지연되고 있습니다.${suffix}`;
}

function parseExaoneErrorMessage(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; code?: string };
      message?: string;
      detail?: string;
    };
    const message = json.error?.message || json.message || json.detail;
    if (message) {
      if (status === 503 || /unavailable|sleep|awak/i.test(message)) {
        return unavailableEndpointMessage(message);
      }
      if (status === 404 || status === 400) {
        const lower = message.toLowerCase();
        if (
          status === 404 ||
          lower.includes("not found") ||
          lower.includes("does not exist") ||
          lower.includes("unknown model")
        ) {
          return `LG엑사원 Dedicated Endpoint를 찾을 수 없습니다. FRIENDLI_ENDPOINT_ID를 확인하세요. (${message})`;
        }
      }
      return `${message} (HTTP ${status})`;
    }
  } catch {
    // plain-text 503: "Endpoint is unavailable"
  }

  const trimmed = body.trim();
  if (status === 503 || /unavailable/i.test(trimmed)) {
    return unavailableEndpointMessage(trimmed || `HTTP ${status}`);
  }
  if (status === 404) {
    return "LG엑사원 Dedicated Endpoint를 찾을 수 없습니다. FRIENDLI_ENDPOINT_ID와 엔드포인트 상태를 확인하세요.";
  }
  return `LG엑사원 API 오류 (HTTP ${status})`;
}

function friendliRequest(
  method: string,
  path: string,
  payload: string | undefined,
  timeoutMs: number,
): Promise<{ status: number; body: string }> {
  const apiKey = getExaoneApiKey();
  const teamId = getExaoneTeamId();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (payload) {
    headers["content-type"] = "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(payload));
  }
  if (teamId) {
    headers["X-Friendli-Team"] = teamId;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.friendli.ai",
        path,
        method,
        headers,
        rejectUnauthorized: !isExaoneTlsInsecure(),
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body: data });
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`LG엑사원 API 요청 타임아웃 (${timeoutMs}ms)`));
    });

    req.on("error", (err) => {
      reject(formatExaoneNetworkError(err));
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function parseEndpointStatus(body: string): DedicatedEndpointStatus {
  try {
    return JSON.parse(body) as DedicatedEndpointStatus;
  } catch {
    return {};
  }
}

async function getDedicatedEndpointStatus(): Promise<DedicatedEndpointStatus> {
  const endpointId = getExaoneEndpointId();
  const result = await friendliRequest(
    "GET",
    `/dedicated/beta/endpoint/${encodeURIComponent(endpointId)}/status`,
    undefined,
    15_000,
  );
  if (result.status < 200 || result.status >= 300) {
    throw new Error(parseExaoneErrorMessage(result.status, result.body));
  }
  return parseEndpointStatus(result.body);
}

async function wakeDedicatedEndpoint(): Promise<void> {
  const endpointId = getExaoneEndpointId();
  const result = await friendliRequest(
    "PUT",
    `/dedicated/beta/endpoint/${encodeURIComponent(endpointId)}/wake`,
    undefined,
    20_000,
  );
  if (result.status < 200 || result.status >= 300) {
    throw new Error(parseExaoneErrorMessage(result.status, result.body));
  }
}

async function restartDedicatedEndpoint(): Promise<void> {
  const endpointId = getExaoneEndpointId();
  const result = await friendliRequest(
    "PUT",
    `/dedicated/beta/endpoint/${encodeURIComponent(endpointId)}/restart`,
    undefined,
    20_000,
  );
  if (result.status < 200 || result.status >= 300) {
    throw new Error(parseExaoneErrorMessage(result.status, result.body));
  }
}

function readStatus(info: DedicatedEndpointStatus): string {
  return (info.status ?? "").toUpperCase();
}

export async function ensureExaoneEndpointReady(
  timeoutMs = ENDPOINT_READY_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let statusInfo = await getDedicatedEndpointStatus();
  let status = readStatus(statusInfo);
  let restarted = false;

  while (STOPPING_STATUSES.has(status) && Date.now() < deadline) {
    await sleep(ENDPOINT_POLL_INTERVAL_MS);
    statusInfo = await getDedicatedEndpointStatus();
    status = readStatus(statusInfo);
  }

  if (RESTARTABLE_STATUSES.has(status)) {
    await restartDedicatedEndpoint();
    restarted = true;
    statusInfo = await getDedicatedEndpointStatus();
    status = readStatus(statusInfo);
  } else if (status === "SLEEPING") {
    await wakeDedicatedEndpoint();
    statusInfo = await getDedicatedEndpointStatus();
    status = readStatus(statusInfo);
  }

  while (!READY_STATUSES.has(status) && Date.now() < deadline) {
    if (RESTARTABLE_STATUSES.has(status) && !restarted) {
      await restartDedicatedEndpoint();
      restarted = true;
    } else if (status === "SLEEPING") {
      await wakeDedicatedEndpoint();
    } else if (
      !WAKING_STATUSES.has(status) &&
      !STOPPING_STATUSES.has(status) &&
      !RESTARTABLE_STATUSES.has(status)
    ) {
      break;
    }
    await sleep(ENDPOINT_POLL_INTERVAL_MS);
    statusInfo = await getDedicatedEndpointStatus();
    status = readStatus(statusInfo);
  }

  if (!READY_STATUSES.has(status)) {
    throw new Error(unavailableEndpointMessage(status || "UNKNOWN"));
  }
}

export async function callExaoneChatCompletions(
  body: object,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + ENDPOINT_READY_TIMEOUT_MS;

  try {
    await ensureExaoneEndpointReady(Math.max(1_000, deadline - Date.now()));
  } catch (err) {
    if (err instanceof Error && err.message.includes("찾을 수 없습니다")) {
      throw err;
    }
  }

  const payload = JSON.stringify(body);
  const url = new URL(`${getExaoneBaseUrl()}/chat/completions`);
  let lastError: Error | null = null;
  let attempt = 0;

  while (true) {
    const result = await friendliRequest(
      "POST",
      url.pathname,
      payload,
      timeoutMs,
    );

    if (result.status >= 200 && result.status < 300) {
      return result.body;
    }

    lastError = new Error(parseExaoneErrorMessage(result.status, result.body));
    const retryable =
      result.status === 503 || result.status === 429 || result.status === 500;
    const canRetry = retryable && Date.now() < deadline;
    if (!canRetry) {
      throw lastError;
    }

    attempt += 1;
    if (result.status === 503) {
      try {
        await ensureExaoneEndpointReady(Math.max(1_000, deadline - Date.now()));
      } catch {
        // 기동 대기 중 — 작업시간으로 계속 대기
      }
    }

    await sleep(4_000 * Math.min(attempt, 5));
  }
}

import { getExaoneModel } from "@/lib/exaone/config";
import { callExaoneChatCompletions } from "@/lib/exaone/http-client";
import { ORDER_REPORT_SUMMARY_LLM_TIMEOUT_MS } from "@/lib/order-report-summary/config";
import { parseLlmJsonResponse } from "@/lib/order-report-summary/llm-json";

export async function generateExaoneJsonContent(params: {
  systemPrompt: string;
  userContent: string;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<string> {
  const model = getExaoneModel();
  const request: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userContent },
    ],
    temperature: 0.2,
    max_tokens: params.maxTokens ?? 8192,
    response_format: { type: "json_object" },
  };

  if (model.toUpperCase().includes("EXAONE")) {
    request.chat_template_kwargs = { enable_thinking: false };
  }

  const responseBody = await callExaoneChatCompletions(
    request,
    params.timeoutMs ?? ORDER_REPORT_SUMMARY_LLM_TIMEOUT_MS,
  );

  let json: {
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning_content?: string | null;
        reasoning?: string | null;
      };
      finish_reason?: string | null;
    }>;
  };

  try {
    json = JSON.parse(responseBody) as typeof json;
  } catch {
    throw new Error("LG엑사원 응답 JSON 파싱에 실패했습니다.");
  }

  const choice = json.choices?.[0];
  const message = choice?.message;
  const responseText =
    message?.content?.trim() ||
    message?.reasoning_content?.trim() ||
    message?.reasoning?.trim() ||
    "";

  if (!responseText) {
    throw new Error("LG엑사원 응답이 비어 있습니다.");
  }

  if (choice?.finish_reason === "length") {
    throw new Error(
      "LG엑사원 응답이 토큰 한도로 잘렸습니다. 첨부파일을 줄이거나 다시 시도해 주세요.",
    );
  }

  const raw = responseText
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*$/m, "")
    .trim();

  try {
    parseLlmJsonResponse(raw);
  } catch {
    throw new Error("LG엑사원 JSON 응답 파싱에 실패했습니다.");
  }

  return raw;
}

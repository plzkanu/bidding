import { getClaudeModel } from "@/lib/claude/config";
import { callClaudeApi } from "@/lib/claude/http-client";
import { ORDER_REPORT_SUMMARY_LLM_TIMEOUT_MS } from "@/lib/order-report-summary/config";

export type ClaudeContentBlock =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: {
        type: "base64";
        media_type: string;
        data: string;
      };
    };

export async function generateClaudeJsonContent(params: {
  systemPrompt: string;
  contentBlocks: ClaudeContentBlock[];
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<string> {
  const responseBody = await callClaudeApi(
    {
      model: getClaudeModel(),
      max_tokens: params.maxTokens ?? 8192,
      system: params.systemPrompt,
      messages: [
        {
          role: "user",
          content: params.contentBlocks,
        },
      ],
    },
    params.timeoutMs ?? ORDER_REPORT_SUMMARY_LLM_TIMEOUT_MS,
  );

  let json: {
    content?: Array<{ type?: string; text?: string }>;
  };

  try {
    json = JSON.parse(responseBody) as typeof json;
  } catch {
    throw new Error("Claude 응답 JSON 파싱에 실패했습니다.");
  }

  const responseText = (json.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();

  if (!responseText) {
    throw new Error("Claude 응답이 비어 있습니다.");
  }

  const raw = responseText
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*$/m, "")
    .trim();

  return raw;
}

import { env } from "../../config/env";

type ChatRole = "system" | "user" | "assistant";

export type ChatMessage =
  | {
      role: ChatRole;
      content: string;
    }
  | {
      role: ChatRole;
      content: Array<
        | {
            type: "text";
            text: string;
          }
        | {
            type: "image_url";
            image_url: {
              url: string;
            };
          }
      >;
    };

type StreamChatOptions = {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  onDelta?: (delta: string) => void;
  onReasoning?: (delta: string) => void;
};

function createCombinedAbortSignal(timeoutMs: number, upstream?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

  const abortWithUpstream = () => {
    controller.abort(upstream?.reason ?? new Error("aborted"));
  };

  if (upstream) {
    if (upstream.aborted) {
      abortWithUpstream();
    } else {
      upstream.addEventListener("abort", abortWithUpstream, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      upstream?.removeEventListener("abort", abortWithUpstream);
    }
  };
}

function ensureSiliconFlowConfigured() {
  if (!env.siliconFlowApiKey) {
    throw new Error("SILICONFLOW_API_KEY 未配置，无法调用真实大模型。");
  }
  if (!env.siliconFlowBaseUrl) {
    throw new Error("SILICONFLOW_BASE_URL 未配置，无法调用真实大模型。");
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `模型服务请求失败，HTTP ${response.status}`;
  }
  try {
    const json = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return json.error?.message || json.message || text;
  } catch {
    return text;
  }
}

function getTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      const text = (item as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("");
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function bufferToBlobPart(buffer: Buffer): ArrayBuffer {
  const bytes = Uint8Array.from(buffer);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function streamSiliconFlowChat(options: StreamChatOptions): Promise<{ text: string; reasoning: string }> {
  ensureSiliconFlowConfigured();
  const combined = createCombinedAbortSignal(
    options.timeoutMs ?? env.siliconFlowVisionTimeoutMs,
    options.signal
  );

  try {
    const response = await fetch(`${env.siliconFlowBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.siliconFlowApiKey}`
      },
      body: JSON.stringify({
        model: options.model ?? env.siliconFlowChatModel,
        stream: true,
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens,
        messages: options.messages
      }),
      signal: combined.signal
    });

    if (!response.ok || !response.body) {
      throw new Error(await readErrorMessage(response));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let text = "";
    let reasoning = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        for (const line of block.split("\n")) {
          if (!line.startsWith("data:")) {
            continue;
          }
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") {
            continue;
          }

          const parsed = JSON.parse(payload) as {
            choices?: Array<{
              delta?: {
                content?: unknown;
                reasoning_content?: unknown;
              };
            }>;
          };
          const delta = parsed.choices?.[0]?.delta;
          const contentDelta = getTextFromContent(delta?.content);
          const reasoningDelta = getTextFromContent(delta?.reasoning_content);

          if (reasoningDelta) {
            reasoning += reasoningDelta;
            options.onReasoning?.(reasoningDelta);
          }
          if (contentDelta) {
            text += contentDelta;
            options.onDelta?.(contentDelta);
          }
        }

        boundary = buffer.indexOf("\n\n");
      }
    }

    return {
      text,
      reasoning
    };
  } finally {
    combined.cleanup();
  }
}

async function completeSiliconFlowChat(options: Omit<StreamChatOptions, "onDelta" | "onReasoning">): Promise<string> {
  ensureSiliconFlowConfigured();
  const combined = createCombinedAbortSignal(
    options.timeoutMs ?? env.siliconFlowVisionTimeoutMs,
    options.signal
  );

  try {
    const response = await fetch(`${env.siliconFlowBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.siliconFlowApiKey}`
      },
      body: JSON.stringify({
        model: options.model ?? env.siliconFlowChatModel,
        stream: false,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens,
        messages: options.messages
      }),
      signal: combined.signal
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: unknown;
        };
      }>;
    };
    return getTextFromContent(payload.choices?.[0]?.message?.content).trim();
  } finally {
    combined.cleanup();
  }
}

export async function describeImageWithSiliconFlow(options: {
  buffer: Buffer;
  mimeType: string;
  prompt: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<string> {
  const imageUrl = bufferToDataUrl(options.buffer, options.mimeType);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "你是心理探索场景中的视觉理解助手。请准确描述图片内容、情绪线索、关系场景与可进入对话的关键信息，不要编造无法确认的事实。"
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: options.prompt
        },
        {
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        }
      ]
    }
  ];

  const models = [env.siliconFlowVisionFastModel, env.siliconFlowVisionFallbackModel].filter(Boolean);
  let lastError = "";
  for (const model of models) {
    try {
      const result = await completeSiliconFlowChat({
        model,
        messages,
        signal: options.signal,
        timeoutMs: options.timeoutMs ?? env.siliconFlowVisionTimeoutMs
      });
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || "视觉理解模型没有返回有效结果。");
}

export async function transcribeAudioWithSiliconFlow(options: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  signal?: AbortSignal;
}): Promise<string> {
  ensureSiliconFlowConfigured();
  const combined = createCombinedAbortSignal(env.siliconFlowVisionTimeoutMs, options.signal);

  try {
    const formData = new FormData();
    formData.append("model", env.siliconFlowAsrModel);
    formData.append("language", "zh");
    formData.append(
      "file",
      new Blob([bufferToBlobPart(options.buffer)], { type: options.mimeType || "audio/webm" }),
      options.fileName
    );

    const response = await fetch(`${env.siliconFlowBaseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.siliconFlowApiKey}`
      },
      body: formData,
      signal: combined.signal
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const payload = (await response.json()) as { text?: string };
    return (payload.text || "").trim();
  } finally {
    combined.cleanup();
  }
}

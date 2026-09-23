export type SseAction = {
  id: string;
  label: string;
  prompt: string;
};

export type StreamEventName =
  | "message.started"
  | "message.delta"
  | "tool.started"
  | "tool.completed"
  | "citation.appended"
  | "risk.alerted"
  | "warning.raised"
  | "usage.reported"
  | "message.completed"
  | "stream.completed"
  | "stream.failed"
  | "thinking.delta"
  | "interaction.required";

export type SseEventPayloadMap = {
  "message.started": { runId: string; conversationId: string; createdAt: number };
  "message.delta": { runId: string; delta: string };
  "tool.started": { runId: string; tool: string; label: string };
  "tool.completed": { runId: string; tool: string; label: string };
  "citation.appended": {
    runId: string;
    source: "memory_fragments" | "knowledge_base";
    title: string;
    content: string;
    score?: number;
  };
  "risk.alerted": {
    runId: string;
    type: "self_harm" | "harm_others";
    severity: "high" | "medium";
    title: string;
    message: string;
  };
  "warning.raised": { runId: string; message: string; code?: string };
  "usage.reported": { runId: string; inputChars: number; outputChars: number; attachmentCount: number };
  "message.completed": { runId: string; message: string; thinking: string; actions: SseAction[] };
  "stream.completed": { runId: string; status: string };
  "stream.failed": { runId: string; message: string; code?: string };
  "thinking.delta": { runId: string; delta: string };
  "interaction.required": { runId: string; title: string; description: string; actions: SseAction[] };
};

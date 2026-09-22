import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AttachmentDraft = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  kind: "image" | "audio" | "document" | "other";
};

export type InteractionAction = {
  id: string;
  label: string;
  prompt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  thinking?: string;
  actions?: InteractionAction[];
  status?: "streaming" | "completed";
};

type StreamState = {
  runId: string | null;
  status: "idle" | "streaming" | "reconnecting" | "completed" | "failed" | "stopped";
  assistantMessageId: string | null;
  thinking: string;
  lastSeq: number;
  errorMessage: string | null;
};

type ChatState = {
  conversationId: string | null;
  composerText: string;
  attachments: AttachmentDraft[];
  messages: ChatMessage[];
  stream: StreamState;
};

const initialState: ChatState = {
  conversationId: null,
  composerText: "",
  attachments: [],
  messages: [],
  stream: {
    runId: null,
    status: "idle",
    assistantMessageId: null,
    thinking: "",
    lastSeq: 0,
    errorMessage: null
  }
};

function findMessage(state: ChatState, messageId: string | null): ChatMessage | undefined {
  if (!messageId) {
    return undefined;
  }
  return state.messages.find((message) => message.id === messageId);
}

function formatMessageText(text: string, attachments?: AttachmentDraft[]): string {
  if (!attachments || attachments.length === 0) {
    return text;
  }
  return `${text}\n\n附件：${attachments.map((item) => item.name).join("、")}`;
}

export const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setComposerText(state, action: PayloadAction<string>) {
      state.composerText = action.payload;
    },
    addAttachments(state, action: PayloadAction<AttachmentDraft[]>) {
      state.attachments.push(...action.payload);
    },
    removeAttachment(state, action: PayloadAction<string>) {
      state.attachments = state.attachments.filter((item) => item.id !== action.payload);
    },
    clearComposer(state) {
      state.composerText = "";
      state.attachments = [];
    },
    appendUserMessage(
      state,
      action: PayloadAction<{ conversationId: string; text: string; attachments: AttachmentDraft[] }>
    ) {
      state.conversationId = action.payload.conversationId;
      state.messages.push({
        id: `user-${Date.now()}`,
        role: "user",
        text: formatMessageText(action.payload.text, action.payload.attachments),
        createdAt: Date.now(),
        status: "completed"
      });
    },
    replaceConversationMessages(
      state,
      action: PayloadAction<{
        conversationId: string;
        messages: Array<{
          id: string;
          role: "user" | "assistant";
          text: string;
          createdAt: number;
          attachments?: AttachmentDraft[];
          status?: "streaming" | "completed";
        }>;
      }>
    ) {
      state.conversationId = action.payload.conversationId;
      state.messages = action.payload.messages.map((message) => ({
        id: message.id,
        role: message.role,
        text: formatMessageText(message.text, message.attachments),
        createdAt: message.createdAt,
        status: message.status ?? "completed",
        actions: [],
        thinking: message.role === "assistant" ? "" : undefined
      }));
    },
    startAssistantRun(
      state,
      action: PayloadAction<{ runId: string; conversationId: string; assistantMessageId?: string; status?: StreamState["status"] }>
    ) {
      const assistantMessageId = action.payload.assistantMessageId ?? `assistant-${Date.now()}`;
      state.conversationId = action.payload.conversationId;
      state.stream.runId = action.payload.runId;
      state.stream.status = action.payload.status ?? "streaming";
      state.stream.assistantMessageId = assistantMessageId;
      state.stream.thinking = "";
      state.stream.lastSeq = 0;
      state.stream.errorMessage = null;
      if (!findMessage(state, assistantMessageId)) {
        state.messages.push({
          id: assistantMessageId,
          role: "assistant",
          text: "",
          createdAt: Date.now(),
          thinking: "",
          actions: [],
          status: "streaming"
        });
      }
    },
    updateLastSeq(state, action: PayloadAction<number>) {
      state.stream.lastSeq = Math.max(state.stream.lastSeq, action.payload);
    },
    appendThinkingDelta(state, action: PayloadAction<string>) {
      state.stream.thinking += action.payload;
      const message = findMessage(state, state.stream.assistantMessageId);
      if (message) {
        message.thinking = (message.thinking ?? "") + action.payload;
      }
    },
    appendAssistantDelta(state, action: PayloadAction<string>) {
      const message = findMessage(state, state.stream.assistantMessageId);
      if (message) {
        message.text += action.payload;
      }
    },
    setAssistantActions(state, action: PayloadAction<InteractionAction[]>) {
      const message = findMessage(state, state.stream.assistantMessageId);
      if (message) {
        message.actions = action.payload;
      }
    },
    hydrateRunState(
      state,
      action: PayloadAction<{
        runId: string;
        conversationId: string;
        status: StreamState["status"];
        text: string;
        thinking: string;
        actions: InteractionAction[];
        lastSeq: number;
      }>
    ) {
      const assistantMessageId = `assistant-${action.payload.runId}`;
      state.conversationId = action.payload.conversationId;
      state.stream.runId = action.payload.runId;
      state.stream.status = action.payload.status;
      state.stream.assistantMessageId = assistantMessageId;
      state.stream.thinking = action.payload.thinking;
      state.stream.lastSeq = action.payload.lastSeq;
      state.stream.errorMessage = null;

      const message = findMessage(state, assistantMessageId);
      if (message) {
        message.text = action.payload.text;
        message.thinking = action.payload.thinking;
        message.actions = action.payload.actions;
        message.status = action.payload.status === "completed" ? "completed" : "streaming";
      } else {
        state.messages.push({
          id: assistantMessageId,
          role: "assistant",
          text: action.payload.text,
          createdAt: Date.now(),
          thinking: action.payload.thinking,
          actions: action.payload.actions,
          status: action.payload.status === "completed" ? "completed" : "streaming"
        });
      }
    },
    completeRun(state) {
      state.stream.status = "completed";
      const message = findMessage(state, state.stream.assistantMessageId);
      if (message) {
        message.status = "completed";
      }
    },
    stopRunLocally(state) {
      state.stream.status = "stopped";
      const message = findMessage(state, state.stream.assistantMessageId);
      if (message) {
        message.status = "completed";
      }
    },
    failRun(state, action: PayloadAction<string>) {
      state.stream.status = "failed";
      state.stream.errorMessage = action.payload;
      const message = findMessage(state, state.stream.assistantMessageId);
      if (message) {
        message.status = "completed";
      }
    }
  }
});

export const {
  addAttachments,
  appendAssistantDelta,
  appendThinkingDelta,
  appendUserMessage,
  clearComposer,
  completeRun,
  failRun,
  hydrateRunState,
  replaceConversationMessages,
  removeAttachment,
  setAssistantActions,
  setComposerText,
  startAssistantRun,
  stopRunLocally,
  updateLastSeq
} = chatSlice.actions;

export const chatReducer = chatSlice.reducer;

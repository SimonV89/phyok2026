import type { ChatV2Attachment } from "../../../modules/chat-v2/runtime";

export type MemoryFragment = {
  fragmentId: string;
  title: string;
  content: string;
  score: number;
  topicTags: string[];
  emotionTags: string[];
};

export type KnowledgeSnippet = {
  documentId: string;
  title: string;
  content: string;
  score: number;
};

export type SelfExploreAction = {
  id: string;
  label: string;
  prompt: string;
};

export type SelfExploreState = {
  runId: string;
  requestId: string;
  conversationId: string;
  query: string;
  attachments: ChatV2Attachment[];
  primaryIntent: string;
  subIntent: string;
  explorationTrack: string;
  school: string;
  memoryAction: string;
  needsMemoryGate: boolean;
  needsConfirmation: boolean;
  memoryCount: number;
  memoryGatePassed: boolean;
  retrievalPlan: Record<string, unknown>;
  memoryWritePlan: Record<string, unknown>;
  evidencePack: {
    memory: MemoryFragment[];
    knowledge: KnowledgeSnippet[];
    composed: string;
  };
  multimodalDigest: {
    summary: string;
    attachments: Array<{
      id: string;
      name: string;
      kind: string;
      mimeType: string;
      summary?: string;
      extractedText?: string;
      parseStatus?: string;
    }>;
  };
  normalizedInput: {
    plainText: string;
    summary: string;
  };
  output: {
    thinking: string[];
    response: string;
    actions: SelfExploreAction[];
  };
};

export function createInitialSelfExploreState(input: {
  runId: string;
  requestId: string;
  conversationId: string;
  query: string;
  attachments: ChatV2Attachment[];
}): SelfExploreState {
  return {
    runId: input.runId,
    requestId: input.requestId,
    conversationId: input.conversationId,
    query: input.query,
    attachments: input.attachments,
    primaryIntent: "",
    subIntent: "",
    explorationTrack: "",
    school: "",
    memoryAction: "",
    needsMemoryGate: false,
    needsConfirmation: false,
    memoryCount: 0,
    memoryGatePassed: false,
    retrievalPlan: {},
    memoryWritePlan: {},
    evidencePack: {
      memory: [],
      knowledge: [],
      composed: ""
    },
    multimodalDigest: {
      summary: "",
      attachments: []
    },
    normalizedInput: {
      plainText: input.query.trim(),
      summary: ""
    },
    output: {
      thinking: [],
      response: "",
      actions: []
    }
  };
}

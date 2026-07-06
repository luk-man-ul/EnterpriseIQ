export interface ChatCitation {
  documentId: string;
  filename: string;
  page?: number;
}

export type ChatStreamEvent =
  | {
      type: 'message';
      token: string;
    }
  | {
      type: 'citation';
      citation: ChatCitation;
    }
  | {
      type: 'complete';
      chatSessionId: string;
    };

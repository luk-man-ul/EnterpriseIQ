export type ChatMessageRole = "User" | "Assistant";

export interface ChatCitation {
  documentId: string;
  filename: string;
  page?: number;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  citations?: ChatCitation[];
}

export interface ChatSession {
  chatSessionId: string;
  title: string;
  createdAt: string;
}

export type ChatStreamEvent =
  | { type: "message"; token: string }
  | { type: "citation"; citation: ChatCitation }
  | { type: "complete"; chatSessionId: string }
  | { type: "error"; code: string; message: string };

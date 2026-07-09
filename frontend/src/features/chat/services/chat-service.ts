import { requestWithAuth } from "../../../services/authenticated-request";
import { ApiSuccessResponse } from "../../../types/api-contracts";
import { ChatSession, ChatMessage } from "../types/chat-types";

export const chatService = {
  async list(): Promise<ApiSuccessResponse<ChatSession[]>> {
    return requestWithAuth<ApiSuccessResponse<ChatSession[]>>("chat/sessions", {
      method: "GET",
    });
  },

  async getHistory(id: string): Promise<ApiSuccessResponse<ChatMessage[]>> {
    return requestWithAuth<ApiSuccessResponse<ChatMessage[]>>(
      `chat/sessions/${encodeURIComponent(id)}`,
      { method: "GET" }
    );
  },

  async deleteSession(id: string): Promise<ApiSuccessResponse<Record<string, never>>> {
    return requestWithAuth<ApiSuccessResponse<Record<string, never>>>(
      `chat/sessions/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
  },
};

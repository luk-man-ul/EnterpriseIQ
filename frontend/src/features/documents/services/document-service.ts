import { requestWithAuth } from "../../../services/authenticated-request";
import { ApiSuccessResponse } from "../../../types/api-contracts";
import {
  DocumentListData,
  DocumentDetails,
} from "../types/document-types";

export const documentService = {
  async list(params: {
    page: number;
    limit: number;
    departmentId?: string;
  }, signal?: AbortSignal): Promise<ApiSuccessResponse<DocumentListData>> {
    const queryParts = [
      `page=${encodeURIComponent(params.page)}`,
      `limit=${encodeURIComponent(params.limit)}`,
    ];

    if (params.departmentId) {
      queryParts.push(`departmentId=${encodeURIComponent(params.departmentId)}`);
    }

    const queryString = queryParts.join("&");
    return requestWithAuth<ApiSuccessResponse<DocumentListData>>(
      `documents?${queryString}`,
      { method: "GET", signal }
    );
  },

  async getDetails(id: string, signal?: AbortSignal): Promise<ApiSuccessResponse<DocumentDetails>> {
    return requestWithAuth<ApiSuccessResponse<DocumentDetails>>(
      `documents/${encodeURIComponent(id)}`,
      { method: "GET", signal }
    );
  },

  async upload(file: File, signal?: AbortSignal): Promise<ApiSuccessResponse<{
    documentId: string;
    filename: string;
    status: string;
    contentHash: string;
  }>> {
    const formData = new FormData();
    formData.append("file", file);

    return requestWithAuth<ApiSuccessResponse<{
      documentId: string;
      filename: string;
      status: string;
      contentHash: string;
    }>>("documents/upload", {
      method: "POST",
      body: formData,
      signal,
    });
  },

  async delete(id: string): Promise<ApiSuccessResponse<Record<string, never>>> {
    return requestWithAuth<ApiSuccessResponse<Record<string, never>>>(
      `documents/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
  },
};

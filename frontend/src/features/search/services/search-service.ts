import { requestWithAuth } from "../../../services/authenticated-request";
import { ApiSuccessResponse } from "../../../types/api-contracts";
import { SearchRequest, SearchResponse } from "../types/search-types";

export const searchService = {
  async search(
    params: SearchRequest,
    signal?: AbortSignal,
  ): Promise<ApiSuccessResponse<SearchResponse>> {
    return requestWithAuth<ApiSuccessResponse<SearchResponse>>("search", {
      method: "POST",
      body: params as unknown as Record<string, unknown>,
      signal,
    });
  },
};

export interface SearchRequest {
  query: string;
  limit?: number;
  threshold?: number;
}

export interface SearchResultItem {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
}

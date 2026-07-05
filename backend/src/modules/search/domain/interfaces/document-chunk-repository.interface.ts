export const DOCUMENT_CHUNK_REPOSITORY_TOKEN = 'IDocumentChunkRepository';

export interface DocumentChunkSaveInput {
  documentId: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
  tokenCount: number;
  characterCount: number;
  metadata: Record<string, unknown>;
}

export interface SearchChunksInput {
  queryEmbedding: number[];
  limit: number;
  userRoleId: string;
  userDepartmentId: string;
  roleName: string;
  threshold?: number;
}

export interface SearchResultItem {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface IDocumentChunkRepository {
  /**
   * Saves a collection of document chunks and their embeddings to pgvector vector storage.
   * @param chunks List of parsed chunks and calculated vectors.
   */
  saveChunks(chunks: DocumentChunkSaveInput[]): Promise<void>;

  /**
   * Deletes all document chunks belonging to a target document.
   * Required to satisfy ingestion idempotency.
   * @param documentId Target parent document UUID.
   */
  deleteByDocumentId(documentId: string): Promise<void>;

  /**
   * Performs semantic similarity search on document chunks using pgvector with security filters.
   * @param input Parameters including query embedding, user credentials, limit, and optional threshold.
   */
  searchChunks(input: SearchChunksInput): Promise<SearchResultItem[]>;
}

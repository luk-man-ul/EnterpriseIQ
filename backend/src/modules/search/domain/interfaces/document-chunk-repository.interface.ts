export const DOCUMENT_CHUNK_REPOSITORY_TOKEN = 'IDocumentChunkRepository';

export interface DocumentChunkSaveInput {
  documentId: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
  tokenCount: number;
  characterCount: number;
  metadata: Record<string, any>;
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
}

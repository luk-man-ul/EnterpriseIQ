export interface IEmbeddingProvider {
  /**
   * Generates a high-dimensional vector representation for a single block of text.
   * @param text The plain text content block.
   * @returns A promise resolving to an array of floating point numbers (vector embedding).
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Generates embeddings for a batch of text segments.
   * @param texts An array of plain text content blocks.
   * @returns A promise resolving to an array of vector embeddings.
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

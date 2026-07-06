export class AIProviderError extends Error {
  constructor(
    message = 'AI generation failed.',
    public readonly code = 'AI_GENERATION_FAILED',
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export interface IAIProvider {
  /**
   * Generates a text stream chunk-by-chunk.
   * Returns a provider-neutral AsyncIterable containing text fragments.
   */
  generateStream(prompt: string): AsyncIterable<string>;
}

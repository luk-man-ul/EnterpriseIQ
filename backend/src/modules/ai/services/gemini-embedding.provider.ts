import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IEmbeddingProvider } from '../domain/interfaces/embedding-provider.interface';
import { GEMINI_EMBEDDING_MODEL } from '../constants/ai.constants';

@Injectable()
export class GeminiEmbeddingProvider implements IEmbeddingProvider {
  private readonly logger = new Logger(GeminiEmbeddingProvider.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY environment variable is not defined. Embedding operations will fail.',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey || 'dummy-key');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: GEMINI_EMBEDDING_MODEL,
      });
      const result = await this.embedWithRetry(() => model.embedContent(text));
      return result.embedding.values;
    } catch (err) {
      this.logger.error(`Failed to generate embedding for text snippet`, err);
      throw err;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const model = this.genAI.getGenerativeModel({
        model: GEMINI_EMBEDDING_MODEL,
      });
      const result = await this.embedWithRetry(() =>
        model.batchEmbedContents({
          requests: texts.map((t) => ({
            content: { role: 'user', parts: [{ text: t }] },
          })),
        }),
      );
      return result.embeddings.map((e) => e.values);
    } catch (err) {
      this.logger.error(`Failed to generate batch embeddings`, err);
      throw err;
    }
  }

  private async embedWithRetry<T>(
    task: () => Promise<T>,
    retries = 5,
    delay = 1000,
  ): Promise<T> {
    try {
      return await task();
    } catch (err) {
      if (retries <= 0) {
        throw err;
      }
      const errMessage = String(err).toLowerCase();
      let structuredMessage = '';
      if (err instanceof Error) {
        structuredMessage = err.message.toLowerCase();
      } else if (err && typeof err === 'object' && 'message' in err) {
        const errWithMsg = err as Record<string, unknown>;
        structuredMessage = String(errWithMsg.message).toLowerCase();
      }

      const isTransient =
        errMessage.includes('429') ||
        errMessage.includes('quota') ||
        errMessage.includes('503') ||
        errMessage.includes('500') ||
        errMessage.includes('timeout') ||
        errMessage.includes('fetch') ||
        structuredMessage.includes('429') ||
        structuredMessage.includes('quota') ||
        structuredMessage.includes('503') ||
        structuredMessage.includes('500') ||
        structuredMessage.includes('timeout') ||
        structuredMessage.includes('fetch');

      if (!isTransient) {
        throw err;
      }

      const jitter = Math.random() * 200;
      const nextDelay = delay * 2 + jitter;

      this.logger.warn(
        `Gemini API transient failure. Retrying embedding task in ${Math.round(delay)}ms... (${retries} retries left)`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.embedWithRetry(task, retries - 1, nextDelay);
    }
  }
}

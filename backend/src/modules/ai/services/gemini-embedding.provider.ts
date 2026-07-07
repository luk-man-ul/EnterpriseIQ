import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, EmbedContentRequest } from '@google/generative-ai';
import { IEmbeddingProvider } from '../domain/interfaces/embedding-provider.interface';
import {
  GEMINI_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
} from '../constants/ai.constants';

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

  private normalizeEmbedding(vector: number[]): number[] {
    const sumSquares = vector.reduce((sum, val) => sum + val * val, 0);
    const magnitude = Math.sqrt(sumSquares);
    if (magnitude === 0) {
      return [...vector];
    }
    return vector.map((val) => val / magnitude);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: GEMINI_EMBEDDING_MODEL,
      });
      const req: EmbedContentRequest & { outputDimensionality?: number } = {
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSION,
      };
      const result = await this.embedWithRetry(() => model.embedContent(req));
      const values = result.embedding.values;
      if (!values || values.length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Unexpected embedding dimensionality: expected ${EMBEDDING_DIMENSION}, got ${values ? values.length : 0}.`,
        );
      }
      return this.normalizeEmbedding(values);
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
      const requests: Array<
        EmbedContentRequest & { outputDimensionality?: number }
      > = texts.map((t) => ({
        content: { role: 'user', parts: [{ text: t }] },
        outputDimensionality: EMBEDDING_DIMENSION,
      }));
      const result = await this.embedWithRetry(() =>
        model.batchEmbedContents({
          requests,
        }),
      );
      return result.embeddings.map((e) => {
        const values = e.values;
        if (!values || values.length !== EMBEDDING_DIMENSION) {
          throw new Error(
            `Unexpected embedding dimensionality: expected ${EMBEDDING_DIMENSION}, got ${values ? values.length : 0}.`,
          );
        }
        return this.normalizeEmbedding(values);
      });
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

      let isTransient = false;
      let status: number | undefined;

      if (err && typeof err === 'object') {
        const errObj = err as Record<string, unknown>;
        if (typeof errObj.status === 'number') {
          status = errObj.status;
        } else if (
          errObj.cause &&
          typeof errObj.cause === 'object' &&
          typeof (errObj.cause as Record<string, unknown>).status === 'number'
        ) {
          status = (errObj.cause as Record<string, unknown>).status as number;
        }
      }

      if (status !== undefined) {
        // Status-first logic: 408, 429, and 5xx are transient
        isTransient =
          status === 408 || status === 429 || (status >= 500 && status < 600);
      } else {
        // Status-less fallback using structured system codes and cause parameters
        let code = '';
        let errno = '';

        if (err && typeof err === 'object') {
          const errObj = err as Record<string, unknown>;
          if (typeof errObj.code === 'string') code = errObj.code;
          if (typeof errObj.errno === 'string') errno = errObj.errno;

          if (errObj.cause && typeof errObj.cause === 'object') {
            const causeObj = errObj.cause as Record<string, unknown>;
            if (typeof causeObj.code === 'string') code = causeObj.code;
            if (typeof causeObj.errno === 'string') errno = causeObj.errno;
          }
        }

        const transientCodes = new Set([
          'ETIMEDOUT',
          'ECONNRESET',
          'EAI_AGAIN',
          'UND_ERR_CONNECT_TIMEOUT',
          'UND_ERR_HEADERS_TIMEOUT',
          'UND_ERR_SOCKET',
        ]);

        isTransient = transientCodes.has(code) || transientCodes.has(errno);
      }

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

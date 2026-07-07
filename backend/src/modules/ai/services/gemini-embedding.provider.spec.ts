import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiEmbeddingProvider } from './gemini-embedding.provider';
import { GoogleGenerativeAI } from '@google/generative-ai';

jest.mock('@google/generative-ai');

describe('GeminiEmbeddingProvider', () => {
  let provider: GeminiEmbeddingProvider;
  let mockGetGenerativeModel: jest.Mock;
  let mockEmbedContent: jest.Mock;
  let mockBatchEmbedContents: jest.Mock;

  beforeEach(async () => {
    mockEmbedContent = jest.fn();
    mockBatchEmbedContents = jest.fn();
    mockGetGenerativeModel = jest.fn().mockReturnValue({
      embedContent: mockEmbedContent,
      batchEmbedContents: mockBatchEmbedContents,
    });

    jest.mocked(GoogleGenerativeAI).prototype.getGenerativeModel =
      mockGetGenerativeModel;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiEmbeddingProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-api-key'),
          },
        },
      ],
    }).compile();

    provider = module.get<GeminiEmbeddingProvider>(GeminiEmbeddingProvider);
  });

  describe('Configuration & Payload', () => {
    it('1. should use gemini-embedding-001 model', async () => {
      mockEmbedContent.mockResolvedValue({
        embedding: { values: new Array(768).fill(1 / Math.sqrt(768)) },
      });
      await provider.generateEmbedding('test');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-embedding-001',
      });
    });

    it('2. should include outputDimensionality: 768 in single request', async () => {
      mockEmbedContent.mockResolvedValue({
        embedding: { values: new Array(768).fill(1 / Math.sqrt(768)) },
      });
      await provider.generateEmbedding('test');
      expect(mockEmbedContent).toHaveBeenCalledWith(
        expect.objectContaining({
          outputDimensionality: 768,
        }),
      );
    });

    it('3. should include outputDimensionality: 768 in each batch request', async () => {
      mockBatchEmbedContents.mockResolvedValue({
        embeddings: [
          { values: new Array(768).fill(1 / Math.sqrt(768)) },
          { values: new Array(768).fill(1 / Math.sqrt(768)) },
        ],
      });
      await provider.generateEmbeddings(['a', 'b']);
      expect(mockBatchEmbedContents).toHaveBeenCalledWith({
        requests: [
          expect.objectContaining({ outputDimensionality: 768 }),
          expect.objectContaining({ outputDimensionality: 768 }),
        ],
      });
    });
  });

  describe('Normalization', () => {
    it('4. should L2-normalize a single non-zero vector output', async () => {
      const inputVector = [3.0, 4.0, ...new Array<number>(766).fill(0.0)]; // norm = 5.0
      mockEmbedContent.mockResolvedValue({
        embedding: { values: inputVector },
      });
      const result = await provider.generateEmbedding('test');
      expect(result[0]).toBeCloseTo(0.6); // 3.0 / 5.0
      expect(result[1]).toBeCloseTo(0.8); // 4.0 / 5.0
      const norm = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
      expect(norm).toBeCloseTo(1.0);
    });

    it('5. should consistently L2-normalize batch vectors independently', async () => {
      const vector1 = [1.0, 1.0, ...new Array<number>(766).fill(0.0)]; // norm = sqrt(2)
      const vector2 = [0.0, 2.0, ...new Array<number>(766).fill(0.0)]; // norm = 2
      mockBatchEmbedContents.mockResolvedValue({
        embeddings: [{ values: vector1 }, { values: vector2 }],
      });
      const results = await provider.generateEmbeddings(['a', 'b']);
      const norm1 = Math.sqrt(
        results[0].reduce((sum, val) => sum + val * val, 0),
      );
      const norm2 = Math.sqrt(
        results[1].reduce((sum, val) => sum + val * val, 0),
      );
      expect(norm1).toBeCloseTo(1.0);
      expect(norm2).toBeCloseTo(1.0);
    });

    it('6. should handle zero-vectors without throwing or producing NaN/Infinity', async () => {
      const zeroVector = new Array(768).fill(0.0);
      mockEmbedContent.mockResolvedValue({
        embedding: { values: zeroVector },
      });
      const result = await provider.generateEmbedding('test');
      expect(result).toEqual(zeroVector);
      expect(result.some((v) => Number.isNaN(v) || !Number.isFinite(v))).toBe(
        false,
      );
    });
  });

  describe('Dimension Safety', () => {
    it('7. should throw if single embedding dimensionality is not exactly 768', async () => {
      mockEmbedContent.mockResolvedValue({
        embedding: { values: [1.0, 2.0] },
      });
      await expect(provider.generateEmbedding('test')).rejects.toThrow(
        'Unexpected embedding dimensionality: expected 768, got 2.',
      );
    });

    it('8. should throw if any batch embedding dimensionality is not exactly 768', async () => {
      mockBatchEmbedContents.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }, { values: [1.0] }],
      });
      await expect(provider.generateEmbeddings(['a', 'b'])).rejects.toThrow(
        'Unexpected embedding dimensionality: expected 768, got 1.',
      );
    });
  });

  describe('Retry Policies (HTTP Status)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([400, 401, 403, 404])(
      '9-12. should fail immediately for HTTP %p status codes',
      async (status) => {
        const error: Error & { status?: number } = new Error(
          `HTTP Error ${status}`,
        );
        error.status = status;
        mockEmbedContent.mockRejectedValue(error);

        const promise = provider.generateEmbedding('test');
        await expect(promise).rejects.toThrow(`HTTP Error ${status}`);
        expect(mockEmbedContent).toHaveBeenCalledTimes(1);
      },
    );

    it.each([408, 429, 500, 502, 503, 504])(
      '13-15. should retry for HTTP %p status codes',
      async (status) => {
        const error: Error & { status?: number } = new Error(
          `HTTP Error ${status}`,
        );
        error.status = status;
        mockEmbedContent.mockRejectedValue(error);

        const promise = provider.generateEmbedding('test');
        const expectation = expect(promise).rejects.toThrow(
          `HTTP Error ${status}`,
        );
        await jest.runAllTimersAsync();
        await expectation;
        expect(mockEmbedContent).toHaveBeenCalledTimes(6); // 1 initial + 5 retries
      },
    );
  });

  describe('Retry Policies (Status-less Transport)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([
      'ETIMEDOUT',
      'ECONNRESET',
      'EAI_AGAIN',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_SOCKET',
    ])('16-21. should retry for transient transport code: %p', async (code) => {
      const error: Error & { code?: string } = new Error(
        `Transport Error ${code}`,
      );
      error.code = code;
      mockEmbedContent.mockRejectedValue(error);

      const promise = provider.generateEmbedding('test');
      const expectation = expect(promise).rejects.toThrow(
        `Transport Error ${code}`,
      );
      await jest.runAllTimersAsync();
      await expectation;
      expect(mockEmbedContent).toHaveBeenCalledTimes(6);
    });

    it.each(['ECONNREFUSED', 'ENOTFOUND', 'EADDRINUSE'])(
      '22-24. should not retry for non-transient transport code: %p',
      async (code) => {
        const error: Error & { code?: string } = new Error(
          `Transport Error ${code}`,
        );
        error.code = code;
        mockEmbedContent.mockRejectedValue(error);

        const promise = provider.generateEmbedding('test');
        await expect(promise).rejects.toThrow(`Transport Error ${code}`);
        expect(mockEmbedContent).toHaveBeenCalledTimes(1);
      },
    );

    it('25. should not retry on generic message containing "fetch"', async () => {
      const error = new Error('Failed to fetch resource');
      mockEmbedContent.mockRejectedValue(error);

      const promise = provider.generateEmbedding('test');
      await expect(promise).rejects.toThrow('Failed to fetch resource');
      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    });

    it('26. should not retry on generic message containing "quota"', async () => {
      const error = new Error('Quota exceeded for this user');
      mockEmbedContent.mockRejectedValue(error);

      const promise = provider.generateEmbedding('test');
      await expect(promise).rejects.toThrow('Quota exceeded for this user');
      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    });

    it('27. should not retry on generic message containing "rate limit"', async () => {
      const error = new Error('Rate limit surpassed');
      mockEmbedContent.mockRejectedValue(error);

      const promise = provider.generateEmbedding('test');
      await expect(promise).rejects.toThrow('Rate limit surpassed');
      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Status Precedence & Expiry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('28. should prioritize non-retryable status over transient code (404 + ECONNRESET => no retry)', async () => {
      const error: Error & { status?: number; code?: string } = new Error(
        'Precedence Error',
      );
      error.status = 404;
      error.code = 'ECONNRESET';
      mockEmbedContent.mockRejectedValue(error);

      const promise = provider.generateEmbedding('test');
      await expect(promise).rejects.toThrow('Precedence Error');
      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    });

    it('29. should prioritize retryable status over non-transient code (500 + ECONNREFUSED => retry)', async () => {
      const error: Error & { status?: number; code?: string } = new Error(
        'Precedence Error 2',
      );
      error.status = 500;
      error.code = 'ECONNREFUSED';
      mockEmbedContent.mockRejectedValue(error);

      const promise = provider.generateEmbedding('test');
      const expectation = expect(promise).rejects.toThrow('Precedence Error 2');
      await jest.runAllTimersAsync();
      await expectation;
      expect(mockEmbedContent).toHaveBeenCalledTimes(6);
    });

    it('30. should bound retry exhaustion to exactly 6 total calls (1 + 5)', async () => {
      const error: Error & { status?: number } = new Error('Retry Exhaustion');
      error.status = 503;
      mockEmbedContent.mockRejectedValue(error);

      const promise = provider.generateEmbedding('test');
      const expectation = expect(promise).rejects.toThrow('Retry Exhaustion');
      await jest.runAllTimersAsync();
      await expectation;
      expect(mockEmbedContent).toHaveBeenCalledTimes(6);
    });

    it('31. should return normalized vector if retry succeeds before exhaustion', async () => {
      const error: Error & { status?: number } = new Error('Transient 503');
      error.status = 503;
      mockEmbedContent
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue({
          embedding: {
            values: [3.0, 4.0, ...new Array<number>(766).fill(0.0)],
          },
        });

      const promise = provider.generateEmbedding('test');
      promise.catch(() => {});
      await jest.runAllTimersAsync();
      const result = await promise;
      expect(result[0]).toBeCloseTo(0.6);
      expect(result[1]).toBeCloseTo(0.8);
      expect(mockEmbedContent).toHaveBeenCalledTimes(3);
    });
  });
});

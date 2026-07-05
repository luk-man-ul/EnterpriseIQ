/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SearchService } from './search.service';
import {
  EMBEDDING_PROVIDER_TOKEN,
  EMBEDDING_DIMENSION,
} from '../../ai/constants/ai.constants';
import type { IEmbeddingProvider } from '../../ai/domain/interfaces/embedding-provider.interface';
import { DOCUMENT_CHUNK_REPOSITORY_TOKEN } from '../domain/interfaces/document-chunk-repository.interface';
import type { IDocumentChunkRepository } from '../domain/interfaces/document-chunk-repository.interface';

describe('SearchService', () => {
  let service: SearchService;
  let embeddingProviderMock: jest.Mocked<IEmbeddingProvider>;
  let chunkRepositoryMock: jest.Mocked<IDocumentChunkRepository>;

  const dummyEmbedding = new Array(EMBEDDING_DIMENSION).fill(0.1);

  beforeEach(async () => {
    embeddingProviderMock = {
      generateEmbedding: jest.fn().mockResolvedValue(dummyEmbedding),
      generateEmbeddings: jest.fn(),
    };

    chunkRepositoryMock = {
      saveChunks: jest.fn(),
      deleteByDocumentId: jest.fn(),
      searchChunks: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: EMBEDDING_PROVIDER_TOKEN,
          useValue: embeddingProviderMock,
        },
        {
          provide: DOCUMENT_CHUNK_REPOSITORY_TOKEN,
          useValue: chunkRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should generate exactly one embedding with the correct query text', async () => {
    const query = 'test search query';
    await service.search(
      { query, limit: 5 },
      {
        userRoleId: 'role-uuid',
        userDepartmentId: 'dept-uuid',
        roleName: UserRole.Employee,
      },
    );

    expect(embeddingProviderMock.generateEmbedding).toHaveBeenCalledTimes(1);
    expect(embeddingProviderMock.generateEmbedding).toHaveBeenCalledWith(query);
  });

  it('should pass correct query parameters and authorization context to repository', async () => {
    const dto = { query: 'test query', limit: 10, threshold: 0.6 };
    const authContext = {
      userRoleId: 'role-uuid-123',
      userDepartmentId: 'dept-uuid-456',
      roleName: UserRole.Manager,
    };

    await service.search(dto, authContext);

    expect(chunkRepositoryMock.searchChunks).toHaveBeenCalledWith({
      queryEmbedding: dummyEmbedding,
      limit: 10,
      threshold: 0.6,
      userRoleId: 'role-uuid-123',
      userDepartmentId: 'dept-uuid-456',
      roleName: UserRole.Manager,
    });
  });

  it('should use default limit behavior when no limit is provided', async () => {
    await service.search(
      { query: 'test query' },
      {
        userRoleId: 'role-uuid',
        userDepartmentId: 'dept-uuid',
        roleName: UserRole.Employee,
      },
    );

    expect(chunkRepositoryMock.searchChunks).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    );
  });

  it('should correctly map raw repository results into SearchResponseDto shape', async () => {
    const mockDbResult = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        documentName: 'document1.pdf',
        pageNumber: 3,
        chunkIndex: 0,
        similarity: 0.85432,
        content: 'some text content',
        metadata: { tags: ['test'] },
      },
    ];
    chunkRepositoryMock.searchChunks.mockResolvedValue(mockDbResult);

    const response = await service.search(
      { query: 'test query' },
      {
        userRoleId: 'role-uuid',
        userDepartmentId: 'dept-uuid',
        roleName: UserRole.Employee,
      },
    );

    expect(response.query).toBe('test query');
    expect(response.results).toHaveLength(1);
    expect(response.results[0]).toEqual({
      documentId: 'doc-1',
      documentName: 'document1.pdf',
      pageNumber: 3,
      chunkIndex: 0,
      similarity: 0.8543, // rounding verify
      content: 'some text content',
      metadata: { tags: ['test'] },
    });
  });

  it('should throw BadRequestException if generated embedding length is not exactly 768', async () => {
    embeddingProviderMock.generateEmbedding.mockResolvedValue([0.1, 0.2]); // invalid length

    await expect(
      service.search(
        { query: 'test query' },
        {
          userRoleId: 'role-uuid',
          userDepartmentId: 'dept-uuid',
          roleName: UserRole.Employee,
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should propagate embedding provider failures', async () => {
    const error = new Error('Gemini quota limit exceeded');
    embeddingProviderMock.generateEmbedding.mockRejectedValue(error);

    await expect(
      service.search(
        { query: 'test query' },
        {
          userRoleId: 'role-uuid',
          userDepartmentId: 'dept-uuid',
          roleName: UserRole.Employee,
        },
      ),
    ).rejects.toThrow('Gemini quota limit exceeded');
  });

  it('should propagate repository failures', async () => {
    const error = new Error('Database connection reset');
    chunkRepositoryMock.searchChunks.mockRejectedValue(error);

    await expect(
      service.search(
        { query: 'test query' },
        {
          userRoleId: 'role-uuid',
          userDepartmentId: 'dept-uuid',
          roleName: UserRole.Employee,
        },
      ),
    ).rejects.toThrow('Database connection reset');
  });
});

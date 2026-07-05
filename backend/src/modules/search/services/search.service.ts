import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  EMBEDDING_PROVIDER_TOKEN,
  EMBEDDING_DIMENSION,
} from '../../ai/constants/ai.constants';
import type { IEmbeddingProvider } from '../../ai/domain/interfaces/embedding-provider.interface';
import { DOCUMENT_CHUNK_REPOSITORY_TOKEN } from '../domain/interfaces/document-chunk-repository.interface';
import type { IDocumentChunkRepository } from '../domain/interfaces/document-chunk-repository.interface';
import { SearchRequestDto } from '../dto/search-request.dto';
import { SearchResponseDto } from '../dto/search-response.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(DOCUMENT_CHUNK_REPOSITORY_TOKEN)
    private readonly chunkRepository: IDocumentChunkRepository,
  ) {}

  async search(
    dto: SearchRequestDto,
    authContext: {
      userRoleId: string;
      userDepartmentId: string;
      roleName: string;
    },
  ): Promise<SearchResponseDto> {
    const { query, limit = 5, threshold } = dto;
    const { userRoleId, userDepartmentId, roleName } = authContext;

    this.logger.log(
      `Generating query embedding for search request: "${query}"`,
    );
    const embedding = await this.embeddingProvider.generateEmbedding(query);

    if (!embedding || embedding.length !== EMBEDDING_DIMENSION) {
      throw new BadRequestException(
        `Generated query embedding must contain exactly ${EMBEDDING_DIMENSION} dimensions.`,
      );
    }

    this.logger.log(
      `Executing pgvector similarity query (limit: ${limit}, threshold: ${threshold ?? 'none'}) for role: ${roleName}`,
    );
    const rawResults = await this.chunkRepository.searchChunks({
      queryEmbedding: embedding,
      limit,
      userRoleId,
      userDepartmentId,
      roleName,
      threshold,
    });

    const results = rawResults.map((item) => ({
      documentId: item.documentId,
      documentName: item.documentName,
      pageNumber: item.pageNumber,
      chunkIndex: item.chunkIndex,
      similarity: Number(item.similarity.toFixed(4)),
      content: item.content,
      metadata: item.metadata,
    }));

    return {
      query,
      results,
    };
  }
}

export class SearchResultItemDto {
  documentId!: string;
  documentName!: string;
  pageNumber!: number;
  chunkIndex!: number;
  similarity!: number;
  content!: string;
  metadata!: Record<string, unknown>;
}

export class SearchResponseDto {
  query!: string;
  results!: SearchResultItemDto[];
}

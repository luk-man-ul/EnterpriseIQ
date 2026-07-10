/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentStatus, Document } from '@prisma/client';
import { IngestionOrchestrator } from './ingestion.orchestrator';
import { ChunkingService } from './chunking.service';
import { PdfParserService } from './parsers/pdf-parser.service';
import { DocxParserService } from './parsers/docx-parser.service';
import { TxtParserService } from './parsers/txt-parser.service';
import { DOCUMENT_REPOSITORY_TOKEN } from '../domain/interfaces/document-repository.interface';
import { DOCUMENT_CHUNK_REPOSITORY_TOKEN } from '../../search/domain/interfaces/document-chunk-repository.interface';
import { STORAGE_PROVIDER_TOKEN } from '../domain/interfaces/storage-provider.interface';
import { EMBEDDING_PROVIDER_TOKEN } from '../../ai/constants/ai.constants';

describe('IngestionOrchestrator', () => {
  let orchestrator: IngestionOrchestrator;
  let documentRepositoryMock: any;
  let chunkRepositoryMock: any;
  let storageProviderMock: any;
  let embeddingProviderMock: any;
  let pdfParserMock: any;
  let docxParserMock: any;
  let txtParserMock: any;

  beforeEach(async () => {
    documentRepositoryMock = {
      findByIdUnscoped: jest.fn(),
      updateStatus: jest.fn(),
    };

    chunkRepositoryMock = {
      saveChunks: jest.fn(),
      deleteByDocumentId: jest.fn(),
    };

    storageProviderMock = {
      getFileBuffer: jest.fn(),
      exists: jest.fn(),
    };

    embeddingProviderMock = {
      generateEmbeddings: jest.fn(),
    };

    pdfParserMock = { parse: jest.fn() };
    docxParserMock = { parse: jest.fn() };
    txtParserMock = { parse: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionOrchestrator,
        ChunkingService,
        {
          provide: DOCUMENT_REPOSITORY_TOKEN,
          useValue: documentRepositoryMock,
        },
        {
          provide: DOCUMENT_CHUNK_REPOSITORY_TOKEN,
          useValue: chunkRepositoryMock,
        },
        { provide: STORAGE_PROVIDER_TOKEN, useValue: storageProviderMock },
        { provide: EMBEDDING_PROVIDER_TOKEN, useValue: embeddingProviderMock },
        { provide: PdfParserService, useValue: pdfParserMock },
        { provide: DocxParserService, useValue: docxParserMock },
        { provide: TxtParserService, useValue: txtParserMock },
      ],
    }).compile();

    orchestrator = module.get<IngestionOrchestrator>(IngestionOrchestrator);
  });

  it('should run end-to-end ingestion successfully for txt file', async () => {
    const docId = 'doc-uuid';
    const mockDocument = {
      id: docId,
      filename: 'sample.txt',
      filePath: 'storage/uploads/sample.txt',
      tags: ['test'],
    } as Document;

    documentRepositoryMock.findByIdUnscoped.mockResolvedValue(mockDocument);
    storageProviderMock.getFileBuffer.mockResolvedValue(
      Buffer.from('hello plain text'),
    );
    txtParserMock.parse.mockResolvedValue([
      { content: 'hello plain text', pageNumber: 1 },
    ]);
    embeddingProviderMock.generateEmbeddings.mockResolvedValue([
      [0.1, 0.2, 0.3],
    ]);

    await orchestrator.ingest(docId);

    expect(chunkRepositoryMock.deleteByDocumentId).toHaveBeenCalledWith(docId);

    expect(documentRepositoryMock.updateStatus).toHaveBeenCalledWith(
      docId,
      DocumentStatus.Processing,
    );
    expect(documentRepositoryMock.updateStatus).toHaveBeenCalledWith(
      docId,
      DocumentStatus.Completed,
    );

    expect(chunkRepositoryMock.saveChunks).toHaveBeenCalledWith([
      expect.objectContaining({
        documentId: docId,
        content: 'hello plain text',
        embedding: [0.1, 0.2, 0.3],
      }),
    ]);
  });

  it('should mark document status as Failed if parsing throws an error', async () => {
    const docId = 'doc-uuid';
    const mockDocument = {
      id: docId,
      filename: 'bad.pdf',
      filePath: 'storage/uploads/bad.pdf',
    } as Document;

    documentRepositoryMock.findByIdUnscoped.mockResolvedValue(mockDocument);
    storageProviderMock.getFileBuffer.mockResolvedValue(Buffer.from('corrupt'));
    pdfParserMock.parse.mockRejectedValue(new Error('Corrupt PDF metadata'));

    await expect(orchestrator.ingest(docId)).rejects.toThrow(
      'Corrupt PDF metadata',
    );

    expect(documentRepositoryMock.updateStatus).toHaveBeenCalledWith(
      docId,
      DocumentStatus.Failed,
    );
  });
});

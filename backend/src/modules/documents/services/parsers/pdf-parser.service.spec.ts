/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { PdfParserService } from './pdf-parser.service';
import { PDFParse } from 'pdf-parse';

jest.mock('pdf-parse');

describe('PdfParserService', () => {
  let service: PdfParserService;
  let mockDestroy: jest.Mock;
  let mockGetText: jest.Mock;

  beforeEach(async () => {
    mockDestroy = jest.fn().mockResolvedValue(undefined);
    mockGetText = jest.fn();

    jest.mocked(PDFParse).prototype.destroy = mockDestroy;
    jest.mocked(PDFParse).prototype.getText = mockGetText;

    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfParserService],
    }).compile();

    service = module.get<PdfParserService>(PdfParserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Mocked Unit Tests', () => {
    it('A-B. should successfully parse through class-based API and return expected ParsedPage[] contract', async () => {
      mockGetText.mockResolvedValue({
        pages: [
          { num: 1, text: ' Page 1 text ' },
          { num: 2, text: ' Page 2 text ' },
        ],
      });

      const buffer = Buffer.from('dummy-pdf-buffer');
      const result = await service.parse(buffer);

      expect(result).toEqual([
        { content: 'Page 1 text', pageNumber: 1 },
        { content: 'Page 2 text', pageNumber: 2 },
      ]);
      expect(mockGetText).toHaveBeenCalledTimes(1);
    });

    it('C-D. should enforce deterministic page ordering and preserve page numbers', async () => {
      mockGetText.mockResolvedValue({
        pages: [
          { num: 2, text: 'Second page' },
          { num: 1, text: 'First page' },
        ],
      });

      const result = await service.parse(Buffer.from('dummy'));
      expect(result).toEqual([
        { content: 'First page', pageNumber: 1 },
        { content: 'Second page', pageNumber: 2 },
      ]);
    });

    it('E. should filter out pages with empty/whitespace-only content', async () => {
      mockGetText.mockResolvedValue({
        pages: [
          { num: 1, text: '   ' },
          { num: 2, text: 'Real page content' },
        ],
      });

      const result = await service.parse(Buffer.from('dummy'));
      expect(result).toEqual([{ content: 'Real page content', pageNumber: 2 }]);
    });

    it('F. should propagate underlying parser failures', async () => {
      mockGetText.mockRejectedValue(new Error('Low level PDF corrupt error'));

      await expect(service.parse(Buffer.from('dummy'))).rejects.toThrow(
        'Low level PDF corrupt error',
      );
    });

    it('G. should trigger resource cleanup via destroy() on success path', async () => {
      mockGetText.mockResolvedValue({ pages: [] });

      await service.parse(Buffer.from('dummy'));

      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('H. should trigger resource cleanup via destroy() on failure path', async () => {
      mockGetText.mockRejectedValue(new Error('Parse failed'));

      await expect(service.parse(Buffer.from('dummy'))).rejects.toThrow(
        'Parse failed',
      );
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('I. should verify constructor signature matches new class-based structure', async () => {
      mockGetText.mockResolvedValue({ pages: [] });

      await service.parse(Buffer.from('test-data'));

      expect(jest.mocked(PDFParse)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: Buffer.from('test-data'),
        }),
      );
    });
  });

  describe('Real-Module Compatibility (Unmocked)', () => {
    it('should verify constructor instantiation and method existence on actual package exports', () => {
      const actualModule = jest.requireActual('pdf-parse');
      const ActualPDFParse = actualModule.PDFParse;

      expect(ActualPDFParse).toBeDefined();

      const dummyBuffer = Buffer.from('%PDF-1.4\n');
      const parser = new ActualPDFParse({ data: dummyBuffer });

      expect(parser).toBeDefined();
      expect(typeof parser.getText).toBe('function');
      expect(typeof parser.destroy).toBe('function');
    });
  });
});

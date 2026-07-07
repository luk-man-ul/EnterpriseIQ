import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import {
  IDocumentParser,
  ParsedPage,
} from '../../domain/interfaces/document-parser.interface';

@Injectable()
export class PdfParserService implements IDocumentParser {
  private readonly logger = new Logger(PdfParserService.name);

  async parse(buffer: Buffer): Promise<ParsedPage[]> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const parsedPages: ParsedPage[] = result.pages.map((p) => ({
        content: p.text.trim(),
        pageNumber: p.num,
      }));
      parsedPages.sort((a, b) => a.pageNumber - b.pageNumber);
      return parsedPages.filter((p) => p.content.length > 0);
    } catch (err) {
      this.logger.error('Failed to parse PDF document', err);
      throw err;
    } finally {
      await parser.destroy();
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import {
  IDocumentParser,
  ParsedPage,
} from '../../domain/interfaces/document-parser.interface';

@Injectable()
export class DocxParserService implements IDocumentParser {
  private readonly logger = new Logger(DocxParserService.name);

  async parse(buffer: Buffer): Promise<ParsedPage[]> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();

      if (!text) {
        return [];
      }

      return [
        {
          content: text,
          pageNumber: 1,
        },
      ];
    } catch (err) {
      this.logger.error('Failed to parse DOCX document', err);
      throw err;
    }
  }
}

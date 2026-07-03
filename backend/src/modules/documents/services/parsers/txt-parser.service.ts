import { Injectable } from '@nestjs/common';
import {
  IDocumentParser,
  ParsedPage,
} from '../../domain/interfaces/document-parser.interface';

@Injectable()
export class TxtParserService implements IDocumentParser {
  parse(buffer: Buffer): Promise<ParsedPage[]> {
    const text = buffer.toString('utf-8').trim();

    if (!text) {
      return Promise.resolve([]);
    }

    return Promise.resolve([
      {
        content: text,
        pageNumber: 1,
      },
    ]);
  }
}

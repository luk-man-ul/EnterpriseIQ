/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import * as pdf from 'pdf-parse';
import {
  IDocumentParser,
  ParsedPage,
} from '../../domain/interfaces/document-parser.interface';

@Injectable()
export class PdfParserService implements IDocumentParser {
  private readonly logger = new Logger(PdfParserService.name);

  async parse(buffer: Buffer): Promise<ParsedPage[]> {
    const pages: ParsedPage[] = [];

    const renderPage = (pageData: any): Promise<string> => {
      return pageData.getTextContent().then((textContent: any) => {
        let lastY = -1;
        let text = '';
        for (const item of textContent.items) {
          if (lastY === -1 || lastY === item.transform[5]) {
            text += item.str as string;
          } else {
            text += '\n' + (item.str as string);
          }
          lastY = item.transform[5];
        }

        const pageNumber = pageData.pageNumber;
        pages.push({
          content: text.trim(),
          pageNumber,
        });

        return text;
      });
    };

    try {
      const pdfParser = pdf as unknown as (
        dataBuffer: Buffer,
        options?: any,
      ) => Promise<any>;

      await pdfParser(buffer, {
        pagerender: renderPage,
      });

      pages.sort((a, b) => a.pageNumber - b.pageNumber);
      return pages.filter((p) => p.content.length > 0);
    } catch (err) {
      this.logger.error('Failed to parse PDF document', err);
      throw err;
    }
  }
}

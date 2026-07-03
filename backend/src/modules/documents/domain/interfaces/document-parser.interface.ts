export interface ParsedPage {
  content: string;
  pageNumber: number;
}

export interface IDocumentParser {
  /**
   * Parses the file binary buffer and extracts plain text content along with page numbers.
   * @param buffer The file binary buffer.
   * @returns A promise resolving to an array of ParsedPage objects.
   */
  parse(buffer: Buffer): Promise<ParsedPage[]>;
}

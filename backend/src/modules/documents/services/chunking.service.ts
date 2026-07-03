import { Injectable, Logger } from '@nestjs/common';
import { getEncoding } from 'js-tiktoken';

export interface TextChunk {
  content: string;
  tokenCount: number;
  characterCount: number;
  startOffset: number;
  endOffset: number;
}

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);
  // cl100k_base is the standard tokenizer used by text-embedding-004 and modern embeddings
  private readonly encoding = getEncoding('cl100k_base');

  /**
   * Splits a block of text into token-limited overlapping chunks, preserving paragraphs where possible.
   * Also computes character start and end offsets relative to the input text.
   */
  splitText(text: string, chunkSize = 250, chunkOverlap = 50): TextChunk[] {
    if (chunkOverlap >= chunkSize) {
      throw new Error('Chunk overlap must be smaller than chunk size.');
    }

    const chunks: TextChunk[] = [];
    const textLength = text.length;
    let position = 0;

    while (position < textLength) {
      let idealEnd = position + chunkSize * 4;
      if (idealEnd > textLength) {
        idealEnd = textLength;
      }

      let splitPoint = idealEnd;
      if (idealEnd < textLength) {
        const searchLength = Math.min(200, textLength - position);
        const searchText = text.substring(position, position + searchLength);

        // Prioritize paragraph ends
        const dnlIndex = searchText.lastIndexOf('\n\n');
        if (dnlIndex > 0 && dnlIndex > (chunkSize - chunkOverlap) * 3) {
          splitPoint = position + dnlIndex + 2;
        } else {
          // Fall back to line ends
          const snlIndex = searchText.lastIndexOf('\n');
          if (snlIndex > 0 && snlIndex > (chunkSize - chunkOverlap) * 3) {
            splitPoint = position + snlIndex + 1;
          } else {
            // Fall back to sentence boundaries
            const sentenceRegex = /[.!?]\s+/g;
            let match;
            let lastSentenceEnd = -1;

            const clipText = searchText.substring(0, idealEnd - position + 100);
            while ((match = sentenceRegex.exec(clipText)) !== null) {
              lastSentenceEnd = match.index + match[0].length;
            }

            if (
              lastSentenceEnd > 0 &&
              lastSentenceEnd > (chunkSize - chunkOverlap) * 3
            ) {
              splitPoint = position + lastSentenceEnd;
            }
          }
        }
      }

      let chunkText = text.substring(position, splitPoint).trim();
      let tokens = this.encoding.encode(chunkText);

      // Force truncate to max chunk size if tokens exceed limit
      if (tokens.length > chunkSize) {
        const truncatedTokens = tokens.slice(0, chunkSize);
        chunkText = this.encoding.decode(truncatedTokens).trim();
        tokens = truncatedTokens;
        splitPoint = position + chunkText.length;
      }

      if (chunkText.length > 0) {
        chunks.push({
          content: chunkText,
          tokenCount: tokens.length,
          characterCount: chunkText.length,
          startOffset: position,
          endOffset: position + chunkText.length,
        });
      }

      if (splitPoint >= textLength) {
        break;
      }

      let overlapChars = Math.round(chunkOverlap * 4);
      if (overlapChars > chunkText.length) {
        overlapChars = Math.round(chunkText.length / 2);
      }

      const nextPosition = splitPoint - overlapChars;
      if (nextPosition <= position) {
        position = splitPoint;
      } else {
        position = nextPosition;
      }
    }

    this.logger.debug(`Split text into ${chunks.length} chunks`);
    return chunks;
  }
}

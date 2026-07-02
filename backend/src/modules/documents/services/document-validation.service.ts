import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';

@Injectable()
export class DocumentValidationService {
  private readonly maxFileSizeBytes = 50 * 1024 * 1024; // 50MB

  /**
   * Validates file size.
   */
  validateSize(fileSize: number): void {
    if (fileSize > this.maxFileSizeBytes) {
      throw new BadRequestException(
        'File size exceeds the maximum limit of 50MB.',
      );
    }
    if (fileSize <= 0) {
      throw new BadRequestException('Invalid file size.');
    }
  }

  /**
   * Sanitizes the original filename to prevent path traversal and shell injection.
   */
  sanitizeFilename(originalFilename: string): string {
    const parsed = path.parse(originalFilename);

    // Sanitize the base name (remove non-alphanumeric/spaces/underscores/hyphens)
    const sanitizedBase = parsed.name
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .substring(0, 100); // truncate name if extremely long

    if (!sanitizedBase) {
      throw new BadRequestException(
        'Invalid or empty filename after sanitization.',
      );
    }

    // Ensure extension matches allowed list
    const ext = parsed.ext.toLowerCase();
    if (!['.pdf', '.docx', '.txt'].includes(ext)) {
      throw new BadRequestException(`Unsupported file extension: ${ext}`);
    }

    return `${sanitizedBase}${ext}`;
  }

  /**
   * Validates magic bytes to ensure file type integrity.
   */
  validateMagicBytes(buffer: Buffer, filename: string): 'PDF' | 'DOCX' | 'TXT' {
    const ext = path.extname(filename).toLowerCase();

    if (buffer.length < 4) {
      throw new BadRequestException('File buffer is too small to validate.');
    }

    const firstFourBytesHex = buffer.toString('hex', 0, 4);

    if (ext === '.pdf') {
      // PDF: Magic number %PDF -> 25 50 44 46
      if (firstFourBytesHex !== '25504446') {
        throw new BadRequestException(
          'Invalid PDF file signature (magic byte check failed).',
        );
      }
      return 'PDF';
    }

    if (ext === '.docx') {
      // DOCX (ZIP format): Magic number PK.. -> 50 4b 03 04
      if (firstFourBytesHex !== '504b0304') {
        throw new BadRequestException(
          'Invalid DOCX file signature (magic byte check failed).',
        );
      }
      return 'DOCX';
    }

    if (ext === '.txt') {
      // TXT: Text files do not have standard magic numbers, but they must not contain control chars like null bytes.
      // We check the first 512 bytes for null characters (indicative of binary/executable formats).
      const checkLength = Math.min(buffer.length, 512);
      for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0) {
          throw new BadRequestException(
            'Invalid TXT file content (contains binary data).',
          );
        }
      }
      return 'TXT';
    }

    throw new BadRequestException(
      `Unsupported file type validation for extension ${ext}.`,
    );
  }

  /**
   * Generates SHA-256 hash of file buffer.
   */
  calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

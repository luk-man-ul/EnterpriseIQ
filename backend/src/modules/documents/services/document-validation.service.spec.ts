import { BadRequestException } from '@nestjs/common';
import { DocumentValidationService } from './document-validation.service';

describe('DocumentValidationService', () => {
  let service: DocumentValidationService;

  beforeEach(() => {
    service = new DocumentValidationService();
  });

  describe('validateSize', () => {
    it('should pass for valid file size', () => {
      expect(() => service.validateSize(1024)).not.toThrow();
    });

    it('should throw BadRequestException if file exceeds limit', () => {
      const limit = 50 * 1024 * 1024;
      expect(() => service.validateSize(limit + 1)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for zero or negative file size', () => {
      expect(() => service.validateSize(0)).toThrow(BadRequestException);
      expect(() => service.validateSize(-5)).toThrow(BadRequestException);
    });
  });

  describe('sanitizeFilename', () => {
    it('should return sanitized clean filename', () => {
      expect(service.sanitizeFilename('clean_file.pdf')).toBe('clean_file.pdf');
    });

    it('should remove path traversal and preserve only filename', () => {
      expect(service.sanitizeFilename('../../../etc/passwd.txt')).toBe(
        'passwd.txt',
      );
      expect(service.sanitizeFilename('file$<name>#@!.docx')).toBe(
        'filename.docx',
      );
    });

    it('should throw BadRequestException for unsupported file extensions', () => {
      expect(() => service.sanitizeFilename('image.png')).toThrow(
        BadRequestException,
      );
      expect(() => service.sanitizeFilename('archive.zip')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateMagicBytes', () => {
    it('should accept valid PDF magic bytes', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\ncontent');
      expect(service.validateMagicBytes(pdfBuffer, 'file.pdf')).toBe('PDF');
    });

    it('should reject invalid PDF magic bytes', () => {
      const badBuffer = Buffer.from('NOTPDF-1.4');
      expect(() => service.validateMagicBytes(badBuffer, 'file.pdf')).toThrow(
        BadRequestException,
      );
    });

    it('should accept valid DOCX magic bytes', () => {
      const docxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x0a]);
      expect(service.validateMagicBytes(docxBuffer, 'file.docx')).toBe('DOCX');
    });

    it('should reject invalid DOCX magic bytes', () => {
      const badBuffer = Buffer.from([0x00, 0x00, 0x03, 0x04]);
      expect(() => service.validateMagicBytes(badBuffer, 'file.docx')).toThrow(
        BadRequestException,
      );
    });

    it('should accept valid TXT data', () => {
      const txtBuffer = Buffer.from('hello plain text world');
      expect(service.validateMagicBytes(txtBuffer, 'file.txt')).toBe('TXT');
    });

    it('should reject TXT containing null bytes', () => {
      const binaryTxtBuffer = Buffer.from('hello\0world');
      expect(() =>
        service.validateMagicBytes(binaryTxtBuffer, 'file.txt'),
      ).toThrow(BadRequestException);
    });
  });

  describe('calculateHash', () => {
    it('should return valid SHA-256 hash', () => {
      const buffer = Buffer.from('enterprise-iq');
      const hash = service.calculateHash(buffer);
      expect(hash).toBe(
        '9df0d62e0a7f25382a6cd14900c76994580133a33877350ed191add876c3cab9',
      );
    });
  });
});

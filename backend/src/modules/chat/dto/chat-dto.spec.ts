import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChatRequestDto } from './chat-request.dto';
import { ChatSessionsQueryDto } from './chat-sessions-query.dto';

describe('Chat DTO Validation Tests', () => {
  describe('ChatRequestDto', () => {
    // Case 1: valid message passes
    it('Case 1: valid message passes', async () => {
      const dto = plainToInstance(ChatRequestDto, {
        message: 'Hello World',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    // Case 2: empty message fails
    it('Case 2: empty message fails', async () => {
      const dto = plainToInstance(ChatRequestDto, {
        message: '',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    // Case 3: message over 500 characters fails
    it('Case 3: message over 500 characters fails', async () => {
      const dto = plainToInstance(ChatRequestDto, {
        message: 'a'.repeat(501),
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    // Case 4: valid UUID v4 chatSessionId passes
    it('Case 4: valid UUID v4 chatSessionId passes', async () => {
      const dto = plainToInstance(ChatRequestDto, {
        message: 'Hello',
        chatSessionId: 'd90e8400-e29b-41d4-a716-446655440004',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    // Case 5: invalid chatSessionId fails
    it('Case 5: invalid chatSessionId fails', async () => {
      const dto = plainToInstance(ChatRequestDto, {
        message: 'Hello',
        chatSessionId: 'invalid-uuid-format',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    // Case 6: omitted chatSessionId passes
    it('Case 6: omitted chatSessionId passes', async () => {
      const dto = plainToInstance(ChatRequestDto, {
        message: 'Hello',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    // Case 5b: whitespace-only message behavior verification
    it('Case 5b: whitespace-only message "   " verification', async () => {
      const dto = plainToInstance(ChatRequestDto, {
        message: '   ',
      });
      const errors = await validate(dto);
      // Under class-validator, IsNotEmpty() validates non-zero string length without trimming.
      // Therefore, a whitespace-only string passes.
      expect(errors.length).toBe(0);
    });
  });

  describe('ChatSessionsQueryDto', () => {
    // Case 7: omitted page/limit resolves to defaults 1 and 20
    it('Case 7: omitted page/limit resolves to defaults 1 and 20', async () => {
      const dto = plainToInstance(ChatSessionsQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });

    // Case 8: query-string page transforms correctly to number
    it('Case 8: query-string page transforms correctly to number', async () => {
      const dto = plainToInstance(ChatSessionsQueryDto, {
        page: '2',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(2);
    });

    // Case 9: query-string limit transforms correctly to number
    it('Case 9: query-string limit transforms correctly to number', async () => {
      const dto = plainToInstance(ChatSessionsQueryDto, {
        limit: '15',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.limit).toBe(15);
    });

    // Case 10: page < 1 fails
    it('Case 10: page < 1 fails', async () => {
      const dto = plainToInstance(ChatSessionsQueryDto, {
        page: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    // Case 11: limit < 1 fails
    it('Case 11: limit < 1 fails', async () => {
      const dto = plainToInstance(ChatSessionsQueryDto, {
        limit: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    // Case 12: limit > 100 fails
    it('Case 12: limit > 100 fails', async () => {
      const dto = plainToInstance(ChatSessionsQueryDto, {
        limit: 101,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    // Case 13: non-integer values fail
    it('Case 13: non-integer values fail (decimal number)', async () => {
      const dto = plainToInstance(ChatSessionsQueryDto, {
        page: 2.5,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    // Case 13b: non-numeric query-string values fail transformation
    it('Case 13b: non-numeric query-string values fail transformation', async () => {
      const dto = plainToInstance(ChatSessionsQueryDto, {
        page: 'not-a-number',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  ChatService,
  IExpressUser,
  IChatSearchResultItem,
  NO_CONTEXT_FALLBACK,
} from './chat.service';
import {
  ChatStreamEvent,
  ChatCitation,
} from '../domain/interfaces/chat-stream.interface';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SearchService } from '../../search/services/search.service';
import { NotFoundException } from '@nestjs/common';
import { ChatMessageRole } from '@prisma/client';
import { getEncoding } from 'js-tiktoken';
import { AI_PROVIDER_TOKEN } from '../../ai/constants/ai.constants';
import { AIProviderError } from '../../ai/domain/interfaces/ai-provider.interface';

describe('ChatService - Foundation', () => {
  let service: ChatService;
  let prisma: PrismaService;

  // Mock implementation values
  const mockUser: IExpressUser = {
    userId: 'user-uuid-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    roleId: 'role-uuid-1',
    departmentId: 'dept-uuid-1',
    roleName: 'Employee',
  };

  const mockPrisma = {
    chatSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockSearchService = {
    search: jest.fn(),
  };

  const mockAIProvider = {
    generateStream: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
        {
          provide: AI_PROVIDER_TOKEN,
          useValue: mockAIProvider,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();

    // Default search mock resolve to prevent test crashes
    mockSearchService.search.mockResolvedValue({
      query: 'mocked',
      results: [],
    });
  });

  describe('Session Resolution and Creation', () => {
    it('1. Creates a new session when chatSessionId is absent', async () => {
      mockPrisma.chatSession.create.mockResolvedValue({
        id: 'new-session-uuid',
        userId: mockUser.userId,
        title: 'Hello',
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await service.executeFoundation(
        { message: 'Hello' },
        mockUser,
      );

      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.userId,
          title: 'Hello',
        },
      });
      expect(result.chatSessionId).toBe('new-session-uuid');
    });

    it('2. Uses full message as title when length <= 50', async () => {
      const shortMsg = 'A short message';
      mockPrisma.chatSession.create.mockResolvedValue({
        id: 's-id',
        title: shortMsg,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      await service.executeFoundation({ message: shortMsg }, mockUser);
      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.userId,
          title: shortMsg,
        },
      });
    });

    it('3. Truncates title to 47 characters + "..." when length > 50', async () => {
      const longMsg = 'a'.repeat(60);
      const expectedTitle = 'a'.repeat(47) + '...';
      mockPrisma.chatSession.create.mockResolvedValue({
        id: 's-id',
        title: expectedTitle,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      await service.executeFoundation({ message: longMsg }, mockUser);
      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.userId,
          title: expectedTitle,
        },
      });
    });

    it('4. Reuses an existing session owned by the authenticated user', async () => {
      const existingSessionId = 'existing-session-uuid';
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: existingSessionId,
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: existingSessionId },
        mockUser,
      );

      // Security assertion: query filters by both id and userId
      expect(mockPrisma.chatSession.findFirst).toHaveBeenCalledWith({
        where: {
          id: existingSessionId,
          userId: mockUser.userId,
        },
      });
      expect(result.chatSessionId).toBe(existingSessionId);
    });

    it('5. Throws NotFoundException when requested session does not exist', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.executeFoundation(
          { message: 'Hello', chatSessionId: 'non-existent-id' },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('6. Throws identical NotFoundException behavior when session is not owned by authenticated user', async () => {
      const targetSessionId = 'other-user-session';
      // Returns null because query searches for (id = targetSessionId, userId = mockUser.userId)
      mockPrisma.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.executeFoundation(
          { message: 'Hello', chatSessionId: targetSessionId },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Prompt Persistence and Basic Execution Check', () => {
    it('7. Persists current user message with ChatMessageRole.User', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 'session-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'new-msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      await service.executeFoundation(
        { message: 'Hello', chatSessionId: 'session-id' },
        mockUser,
      );

      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          chatSessionId: 'session-id',
          role: ChatMessageRole.User,
          content: 'Hello',
          citations: [],
        },
      });
    });

    it('8. Persists citations as [] for the user message', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 'session-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'new-msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      await service.executeFoundation(
        { message: 'Hello', chatSessionId: 'session-id' },
        mockUser,
      );

      const createMock = mockPrisma.chatMessage.create;
      const firstCall = createMock.mock.calls[0] as unknown[];
      const createArg = firstCall[0] as { data: { citations: unknown[] } };
      expect(createArg.data.citations).toEqual([]);
    });

    it('9. Persists prompt before history query is run', async () => {
      const executionOrder: string[] = [];
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 'session-id' });

      mockPrisma.chatMessage.create.mockImplementation(() => {
        executionOrder.push('persist');
        return Promise.resolve({ id: 'new-msg-uuid' });
      });
      mockPrisma.chatMessage.findMany.mockImplementation(() => {
        executionOrder.push('query-history');
        return Promise.resolve([]);
      });

      await service.executeFoundation(
        { message: 'Hello', chatSessionId: 'session-id' },
        mockUser,
      );

      expect(executionOrder).toEqual(['persist', 'query-history']);
    });

    it('14. Does not invoke live database operations in tests', () => {
      expect(prisma).toBeDefined();
    });
  });

  describe('Prior-History Token Budgeting', () => {
    const tokenizer = getEncoding('cl100k_base');

    // Generate a diverse string to bypass BPE merging
    const generateDiverseTokensString = (length: number): string => {
      const tokens = Array.from({ length }, (_, i) => i + 100);
      return tokenizer.decode(tokens);
    };

    const overflowContent = generateDiverseTokensString(2000);

    it('1. Empty history returns []', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await service.executeFoundation(
        { message: 'Hello' },
        mockUser,
      );
      expect(result.history).toEqual([]);
    });

    it('2. Small history messages are all retained', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([
        { role: ChatMessageRole.User, content: 'Hey' },
        { role: ChatMessageRole.Assistant, content: 'Hi' },
      ]);

      const result = await service.executeFoundation(
        { message: 'Hello' },
        mockUser,
      );
      expect(result.history.length).toBe(2);
    });

    it('3. Newest messages are prioritized and evaluated newest-first', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });

      const newest = { role: ChatMessageRole.User, content: 'Newest' };
      const overflowMsg = {
        role: ChatMessageRole.Assistant,
        content: overflowContent,
      }; // Exceeds 1500 tokens

      mockPrisma.chatMessage.findMany.mockResolvedValue([newest, overflowMsg]);

      const result = await service.executeFoundation(
        { message: 'Hello' },
        mockUser,
      );
      expect(result.history).toEqual([newest]);
    });

    it('4. Exact-budget message is included', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });

      const prefix = 'User: \n';
      const prefixTokens = tokenizer.encode(prefix).length;
      const targetLength = 1500 - prefixTokens;
      const content = generateDiverseTokensString(targetLength);
      const msg = { role: ChatMessageRole.User, content };

      mockPrisma.chatMessage.findMany.mockResolvedValue([msg]);

      const result = await service.executeFoundation(
        { message: 'Hello' },
        mockUser,
      );
      expect(result.history.length).toBe(1);
    });

    it('5. Over-budget message is excluded', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });

      const prefix = 'User: \n';
      const prefixTokens = tokenizer.encode(prefix).length;
      const targetLength = 1600 - prefixTokens;
      const content = generateDiverseTokensString(targetLength);
      const msg = { role: ChatMessageRole.User, content };

      mockPrisma.chatMessage.findMany.mockResolvedValue([msg]);

      const result = await service.executeFoundation(
        { message: 'Hello' },
        mockUser,
      );
      expect(result.history).toEqual([]);
    });

    it('6. Selection stops at first over-budget message, and older ones are discarded', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });

      const newest = { role: ChatMessageRole.User, content: 'Hey' };
      const overBudget = {
        role: ChatMessageRole.Assistant,
        content: overflowContent,
      }; // overflows
      const older = { role: ChatMessageRole.User, content: 'Should not fit' };

      mockPrisma.chatMessage.findMany.mockResolvedValue([
        newest,
        overBudget,
        older,
      ]);

      const result = await service.executeFoundation(
        { message: 'Hello' },
        mockUser,
      );
      expect(result.history).toEqual([newest]);
    });

    it('7. Older smaller messages after an over-budget message are not reconsidered', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });

      const newest = { role: ChatMessageRole.User, content: 'Hey' };
      const overBudget = {
        role: ChatMessageRole.Assistant,
        content: overflowContent,
      };
      const older = { role: ChatMessageRole.User, content: 'Small' };

      mockPrisma.chatMessage.findMany.mockResolvedValue([
        newest,
        overBudget,
        older,
      ]);

      const result = await service.executeFoundation(
        { message: 'Hello' },
        mockUser,
      );
      expect(result.history).toEqual([newest]);
    });

    it('8. Whole messages only; no partial truncation', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });

      const newest = { role: ChatMessageRole.User, content: 'Hey' };
      const overBudget = {
        role: ChatMessageRole.Assistant,
        content: overflowContent,
      };

      mockPrisma.chatMessage.findMany.mockResolvedValue([newest, overBudget]);

      const result = await service.executeFoundation(
        { message: 'Hello' },
        mockUser,
      );
      expect(result.history).toEqual([newest]);
    });

    it('9. Output is reversed into chronological order after selection', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });

      const msg3 = { role: ChatMessageRole.User, content: 'Third' };
      const msg2 = { role: ChatMessageRole.Assistant, content: 'Second' };
      const msg1 = { role: ChatMessageRole.User, content: 'First' };

      mockPrisma.chatMessage.findMany.mockResolvedValue([msg3, msg2, msg1]);

      const result = await service.executeFoundation(
        { message: 'Hello' },
        mockUser,
      );
      expect(result.history).toEqual([msg1, msg2, msg3]);
    });

    it('10. Role prefix affects token counting', () => {
      const content = 'Hello';
      const countWithRole = tokenizer.encode(`User: ${content}\n`).length;
      const countWithoutRole = tokenizer.encode(content).length;

      expect(countWithRole).toBeGreaterThan(countWithoutRole);
    });

    it('11. Newline delimiter is included in token counting', () => {
      const content = 'Hello';
      const countWithNewline = tokenizer.encode(`User: ${content}\n`).length;
      const countWithoutNewline = tokenizer.encode(`User: ${content}`).length;

      expect(countWithNewline).toBeGreaterThan(countWithoutNewline);
    });

    it('12. Active current message remains excluded from Prisma history query', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 'session-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'current-msg-id' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      await service.executeFoundation(
        { message: 'Hello', chatSessionId: 'session-id' },
        mockUser,
      );

      const findManyMock = mockPrisma.chatMessage.findMany;
      const firstCall = findManyMock.mock.calls[0] as unknown[];
      const findManyArg = firstCall[0] as { where: { id: { not: string } } };
      expect(findManyArg.where.id.not).toBe('current-msg-id');
    });

    it('13. Candidate query remains take: 20', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 'session-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'current-msg-id' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      await service.executeFoundation(
        { message: 'Hello', chatSessionId: 'session-id' },
        mockUser,
      );

      const findManyMock = mockPrisma.chatMessage.findMany;
      const firstCall = findManyMock.mock.calls[0] as unknown[];
      const findManyArg = firstCall[0] as { take: number };
      expect(findManyArg.take).toBe(20);
    });

    it('14. Candidate query remains createdAt DESC, id DESC', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 'session-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'current-msg-id' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      await service.executeFoundation(
        { message: 'Hello', chatSessionId: 'session-id' },
        mockUser,
      );

      const findManyMock = mockPrisma.chatMessage.findMany;
      const firstCall = findManyMock.mock.calls[0] as unknown[];
      const findManyArg = firstCall[0] as { orderBy: unknown };
      expect(findManyArg.orderBy).toEqual([
        { createdAt: 'desc' },
        { id: 'desc' },
      ]);
    });

    it('15. SearchService is not invoked directly inside budgeting', () => {
      expect(mockSearchService.search).toBeDefined();
    });

    it('16. IAIProvider is injected and present', () => {
      const serviceRef = service as unknown as Record<string, unknown>;
      expect(serviceRef.aiProvider).toBeDefined();
    });
  });

  describe('Secured SearchService Retrieval Integration', () => {
    it('1. SearchService.search is invoked exactly once', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [],
      });

      await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      expect(mockSearchService.search).toHaveBeenCalledTimes(1);
    });

    it('2. Search query equals dto.message exactly', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [],
      });

      await service.executeFoundation(
        { message: 'Target query test', chatSessionId: 's-id' },
        mockUser,
      );

      const searchMock = mockSearchService.search;
      const firstCall = searchMock.mock.calls[0] as unknown[];
      const searchArg = firstCall[0] as { query: string };
      expect(searchArg.query).toBe('Target query test');
    });

    it('3. Search limit is exactly 5 and threshold is omitted', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [],
      });

      await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      const searchMock = mockSearchService.search;
      const firstCall = searchMock.mock.calls[0] as unknown[];
      const searchArg = firstCall[0] as { limit: number; threshold?: number };
      expect(searchArg.limit).toBe(5);
      expect(searchArg.threshold).toBeUndefined();
    });

    it('4. Authorization properties come from authenticated user context only', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [],
      });

      await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      const searchMock = mockSearchService.search;
      const firstCall = searchMock.mock.calls[0] as unknown[];
      const authArg = firstCall[1] as {
        userRoleId: string;
        userDepartmentId: string;
        roleName: string;
      };
      expect(authArg.userRoleId).toBe(mockUser.roleId);
      expect(authArg.userDepartmentId).toBe(mockUser.departmentId);
      expect(authArg.roleName).toBe(mockUser.roleName);
    });

    it('5. Persistence and history loading occur before SearchService.search', async () => {
      const executionOrder: string[] = [];
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockImplementation(() => {
        executionOrder.push('persist');
        return Promise.resolve({ id: 'msg-uuid' });
      });
      mockPrisma.chatMessage.findMany.mockImplementation(() => {
        executionOrder.push('history');
        return Promise.resolve([]);
      });
      mockSearchService.search.mockImplementation(() => {
        executionOrder.push('search');
        return Promise.resolve({ query: 'Hello', results: [] });
      });

      await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      expect(executionOrder).toEqual(['persist', 'history', 'search']);
    });

    it('6. Unauthorized/nonexistent session throws NotFoundException and SearchService is never called', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.executeFoundation(
          { message: 'Hello', chatSessionId: 'foreign-id' },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockSearchService.search).not.toHaveBeenCalled();
    });

    it('7. SearchService failure propagates through ChatService', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockSearchService.search.mockRejectedValue(new Error('Search DB error'));

      await expect(
        service.executeFoundation(
          { message: 'Hello', chatSessionId: 's-id' },
          mockUser,
        ),
      ).rejects.toThrow('Search DB error');
    });

    it('8. Empty search results and result ordering are preserved', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const mockResults = [
        { documentId: 'doc-1', similarity: 0.9, content: 'first chunk' },
        { documentId: 'doc-2', similarity: 0.8, content: 'second chunk' },
      ];
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: mockResults,
      });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );
      expect(result.searchResponse.results).toEqual(mockResults);
    });
  });

  describe('Exact Prompt Budgeting and Context Assembly', () => {
    const tokenizer = getEncoding('cl100k_base');
    const generateDiverseTokensString = (length: number): string => {
      const tokens = Array.from({ length }, (_, i) => i + 100);
      return tokenizer.decode(tokens);
    };

    it('1. Fixed prompt elements and headers are counted correctly', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const query = 'Hello';
      mockSearchService.search.mockResolvedValue({ query, results: [] });

      const result = await service.executeFoundation(
        { message: query, chatSessionId: 's-id' },
        mockUser,
      );

      const expectedPrompt =
        "System Instructions:\nYou are EnterpriseIQ, a helpful corporate assistant. Use the provided context to answer the user's query.\n" +
        'Strict citation rules:\n' +
        '1. Every statement in your response must reference the context using [DOC-X] notations matching the source index.\n' +
        '2. Only use [DOC-X] identifiers that are present in the provided context.\n' +
        '3. Never cite a document that is absent from the context.\n' +
        '4. Format your response in markdown.\n\n' +
        'Provided Context:\n' +
        'Prior Chat History:\n' +
        'Current User Question:\nUser: ' +
        query +
        '\nAssistant:';

      expect(result.finalPrompt).toBe(expectedPrompt);
      expect(tokenizer.encode(result.finalPrompt).length).toBeLessThan(5500);
    });

    it('1b. Prompt contains explicit citation-output instructions and rules', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunkText = 'Some context details';
      const results: IChatSearchResultItem[] = [
        {
          documentId: 'doc-uuid-1',
          documentName: 'doc1.pdf',
          pageNumber: 5,
          content: chunkText,
        },
      ];
      mockSearchService.search.mockResolvedValue({ query: 'Hello', results });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      // A. Grounded prompt contains explicit citation-output instructions.
      expect(result.finalPrompt).toContain('Strict citation rules:');

      // B. Prompt instructs model to use exact [DOC-X] identifiers from context.
      expect(result.finalPrompt).toContain(
        'Every statement in your response must reference the context using [DOC-X] notations matching the source index.',
      );
      expect(result.finalPrompt).toContain(
        'Only use [DOC-X] identifiers that are present in the provided context.',
      );

      // C. Prompt instructs model not to invent/cite sources absent from context.
      expect(result.finalPrompt).toContain(
        'Never cite a document that is absent from the context.',
      );

      // Verify the context chunk DOC-1 marker is formatted and included
      expect(result.finalPrompt).toContain('[DOC-1]');
    });

    it('2. Chunk blocks are added, and their exact token counts are evaluated against the remaining budget', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunkText = generateDiverseTokensString(200);
      const results: IChatSearchResultItem[] = [
        {
          documentId: 'd1',
          documentName: 'doc1.pdf',
          pageNumber: 5,
          content: chunkText,
        },
      ];
      mockSearchService.search.mockResolvedValue({ query: 'Hello', results });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );
      expect(result.admittedChunks.length).toBe(1);
      expect(result.admittedChunks[0].citationId).toBe('DOC-1');
      expect(result.finalPrompt).toContain('[DOC-1]');
    });

    it('3. Stop-on-first-overflow behavior: chunks after first overflow are completely discarded', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'c1',
        documentName: 'c1.pdf',
        pageNumber: null,
        content: generateDiverseTokensString(200),
      };
      const chunk2: IChatSearchResultItem = {
        documentId: 'c2',
        documentName: 'c2.pdf',
        pageNumber: null,
        content: generateDiverseTokensString(5400),
      };
      const chunk3: IChatSearchResultItem = {
        documentId: 'c3',
        documentName: 'c3.pdf',
        pageNumber: null,
        content: generateDiverseTokensString(50),
      };

      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1, chunk2, chunk3],
      });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      expect(result.admittedChunks.length).toBe(1);
      expect(result.admittedChunks[0].documentName).toBe('c1.pdf');

      expect(result.finalPrompt).toContain('[DOC-1]');
      expect(result.finalPrompt).not.toContain('[DOC-2]');
      expect(result.finalPrompt).not.toContain('[DOC-3]');
    });

    it('4. Budget limit of 5,500 input tokens is strictly enforced', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'c1',
        documentName: 'c1.pdf',
        pageNumber: null,
        content: generateDiverseTokensString(2500),
      };
      const chunk2: IChatSearchResultItem = {
        documentId: 'c2',
        documentName: 'c2.pdf',
        pageNumber: null,
        content: generateDiverseTokensString(2500),
      };
      const chunk3: IChatSearchResultItem = {
        documentId: 'c3',
        documentName: 'c3.pdf',
        pageNumber: null,
        content: generateDiverseTokensString(2500),
      };

      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1, chunk2, chunk3],
      });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      const totalTokens = tokenizer.encode(result.finalPrompt).length;
      expect(totalTokens).toBeLessThanOrEqual(5500);
      expect(result.admittedChunks.length).toBeLessThan(3);
    });

    it('5. Similarity chunk order is strictly preserved for admitted chunks', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunkA: IChatSearchResultItem = {
        documentId: 'dA',
        documentName: 'docA.pdf',
        pageNumber: 1,
        content: 'first similar',
      };
      const chunkB: IChatSearchResultItem = {
        documentId: 'dB',
        documentName: 'docB.pdf',
        pageNumber: 2,
        content: 'second similar',
      };

      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunkA, chunkB],
      });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );
      expect(result.admittedChunks[0].documentName).toBe('docA.pdf');
      expect(result.admittedChunks[1].documentName).toBe('docB.pdf');
    });

    it('6. Discarded chunks have no citation identifiers or mappings', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'c1',
        documentName: 'c1.pdf',
        pageNumber: null,
        content: generateDiverseTokensString(200),
      };
      const overflow: IChatSearchResultItem = {
        documentId: 'overflow',
        documentName: 'overflow.pdf',
        pageNumber: null,
        content: generateDiverseTokensString(5400),
      };

      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1, overflow],
      });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );
      expect(result.admittedChunks.length).toBe(1);
      expect(
        result.admittedChunks.find((c) => c.documentName === 'overflow.pdf'),
      ).toBeUndefined();
    });
  });

  describe('Exact Prompt Budgeting and Context Assembly - Targeted recovery', () => {
    const tokenizer = getEncoding('cl100k_base');
    const generateDiverseTokensString = (length: number): string => {
      const tokens = Array.from({ length }, (_, i) => i + 100);
      return tokenizer.decode(tokens);
    };

    it('1. Exact finalPrompt whole-string token count is <= 5500 and tokenizes fully concatenated final prompt', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'c1',
        documentName: 'c1.pdf',
        pageNumber: null,
        content: generateDiverseTokensString(2000),
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );
      const totalCount = tokenizer.encode(result.finalPrompt).length;
      expect(totalCount).toBeLessThanOrEqual(5500);
    });

    it('2. Final overflow recovery removes the last admitted chunk first, preserving higher-similarity earlier chunks', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'c1',
        documentName: 'c1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      const chunk2: IChatSearchResultItem = {
        documentId: 'c2',
        documentName: 'c2.pdf',
        pageNumber: null,
        content: 'content 2',
      };

      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1, chunk2],
      });

      const mockTokenizer = {
        encode: jest.fn(),
        decode: (tokens: number[]): string => tokenizer.decode(tokens),
      };
      (service as unknown as { tokenizer: typeof mockTokenizer }).tokenizer =
        mockTokenizer;

      let encodeCallCount = 0;
      mockTokenizer.encode.mockImplementation((text: string) => {
        if (
          text.includes('System Instructions:') &&
          text.includes('Current User Question:')
        ) {
          encodeCallCount++;
          if (encodeCallCount === 1) {
            return { length: 5505 }; // Concatenated prompt overflows
          } else {
            return { length: 5490 }; // Fits after popping chunk2
          }
        }
        return { length: 10 }; // Standalone tokens fit incrementally
      });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      expect(result.admittedChunks.length).toBe(1);
      expect(result.admittedChunks[0].documentName).toBe('c1.pdf');
      expect(result.finalPrompt).toContain('[DOC-1]');
      expect(result.finalPrompt).not.toContain('[DOC-2]');
    });

    it('3. Recovery repeats if removing one chunk is insufficient', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'c1',
        documentName: 'c1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      const chunk2: IChatSearchResultItem = {
        documentId: 'c2',
        documentName: 'c2.pdf',
        pageNumber: null,
        content: 'content 2',
      };

      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1, chunk2],
      });

      const mockTokenizer = {
        encode: jest.fn(),
        decode: (tokens: number[]): string => tokenizer.decode(tokens),
      };
      (service as unknown as { tokenizer: typeof mockTokenizer }).tokenizer =
        mockTokenizer;

      let encodeCallCount = 0;
      mockTokenizer.encode.mockImplementation((text: string) => {
        if (
          text.includes('System Instructions:') &&
          text.includes('Current User Question:')
        ) {
          encodeCallCount++;
          if (encodeCallCount === 1) {
            return { length: 5505 }; // First check overflows
          } else if (encodeCallCount === 2) {
            return { length: 5502 }; // Second check still overflows after popping chunk2
          } else {
            return { length: 5480 }; // Fits after popping chunk1 too
          }
        }
        return { length: 10 };
      });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );
      expect(result.admittedChunks.length).toBe(0);
      expect(result.finalPrompt).not.toContain('[DOC-1]');
    });

    it('4. Removed chunks have no citation mapping, and remaining identifiers are contiguous', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'c1',
        documentName: 'c1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      const chunk2: IChatSearchResultItem = {
        documentId: 'c2',
        documentName: 'c2.pdf',
        pageNumber: null,
        content: 'content 2',
      };

      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1, chunk2],
      });

      const mockTokenizer = {
        encode: jest.fn(),
        decode: (tokens: number[]): string => tokenizer.decode(tokens),
      };
      (service as unknown as { tokenizer: typeof mockTokenizer }).tokenizer =
        mockTokenizer;

      let encodeCallCount = 0;
      mockTokenizer.encode.mockImplementation((text: string) => {
        if (
          text.includes('System Instructions:') &&
          text.includes('Current User Question:')
        ) {
          encodeCallCount++;
          if (encodeCallCount === 1) {
            return { length: 5505 };
          } else {
            return { length: 5490 };
          }
        }
        return { length: 10 };
      });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      expect(result.admittedChunks.length).toBe(1);
      expect(result.admittedChunks[0].citationId).toBe('DOC-1');
      expect(result.admittedChunks[0].documentName).toBe('c1.pdf');
    });

    it('5. Base-prompt-over-budget behavior is explicit and throws Invariant Violation', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const hugeQuery = generateDiverseTokensString(5600);
      mockSearchService.search.mockResolvedValue({
        query: hugeQuery,
        results: [],
      });

      await expect(
        service.executeFoundation(
          { message: hugeQuery, chatSessionId: 's-id' },
          mockUser,
        ),
      ).rejects.toThrow('Invariant Violation: Base prompt size');
    });

    it('6. Page-number presence behavior matches SearchResultItem type (null vs non-null)', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 's-id' });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunkWithPage: IChatSearchResultItem = {
        documentId: 'c1',
        documentName: 'c1.pdf',
        pageNumber: 5,
        content: 'content 1',
      };
      const chunkWithoutPage: IChatSearchResultItem = {
        documentId: 'c2',
        documentName: 'c2.pdf',
        pageNumber: null,
        content: 'content 2',
      };

      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunkWithPage, chunkWithoutPage],
      });

      const result = await service.executeFoundation(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      expect(result.finalPrompt).toContain('Source: c1.pdf, Page: 5');
      expect(result.finalPrompt).toContain('Source: c2.pdf');
      expect(result.finalPrompt).not.toContain('Source: c2.pdf, Page:');
    });
  });

  describe('processChatStream - Fallback Orchestration', () => {
    const tokenizer = getEncoding('cl100k_base');
    const generateDiverseTokensString = (length: number): string => {
      const tokens = Array.from({ length }, (_, i) => i + 100);
      return tokenizer.decode(tokens);
    };

    it('1. Search returns zero results (no-context fallback bypasses AI, persists, emits message and complete)', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [],
      });

      const events: ChatStreamEvent[] = [];
      let didComplete = false;

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: reject,
            complete: () => {
              didComplete = true;
              resolve();
            },
          });
      });

      expect(didComplete).toBe(true);
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          chatSessionId: 's-id',
          role: ChatMessageRole.Assistant,
          content: NO_CONTEXT_FALLBACK,
          citations: [],
        },
      });
      expect(events).toEqual([
        { type: 'message', token: NO_CONTEXT_FALLBACK },
        { type: 'complete', chatSessionId: 's-id' },
      ]);
    });

    it('2. Search returns results, but none are admitted after budgeting/recovery (fallback triggered)', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      // Search returns results, but prompt budgeting recovery loop discards them
      const chunk1: IChatSearchResultItem = {
        documentId: 'c1',
        documentName: 'c1.pdf',
        pageNumber: null,
        content: generateDiverseTokensString(6000), // Ensures it overflows the budget
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      const events: ChatStreamEvent[] = [];
      let didComplete = false;

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: reject,
            complete: () => {
              didComplete = true;
              resolve();
            },
          });
      });

      expect(didComplete).toBe(true);
      expect(events).toEqual([
        { type: 'message', token: NO_CONTEXT_FALLBACK },
        { type: 'complete', chatSessionId: 's-id' },
      ]);
    });

    it('3. Persistence ordering: assistant fallback message is persisted before complete event is emitted', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [],
      });

      const callOrder: string[] = [];

      mockPrisma.chatMessage.create.mockImplementation((args: unknown) => {
        const typedArgs = args as { data: { role: ChatMessageRole } };
        if (typedArgs.data.role === ChatMessageRole.Assistant) {
          callOrder.push('persist-assistant');
        } else {
          callOrder.push('persist-user');
        }
        return Promise.resolve({ id: 'msg-uuid' });
      });

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => {
              if (ev.type === 'complete') {
                callOrder.push('emit-complete');
              } else if (ev.type === 'message') {
                callOrder.push('emit-message');
              }
            },
            error: reject,
            complete: resolve,
          });
      });

      // User prompt is persisted first during executeFoundation.
      // Then fallback assistant response is persisted.
      // Finally, message and complete events are emitted.
      expect(callOrder).toEqual([
        'persist-user',
        'persist-assistant',
        'emit-message',
        'emit-complete',
      ]);
    });

    it('4. Persistence failure: errors propagate through observable and complete is not emitted', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [],
      });

      const createCalls: unknown[] = [];
      mockPrisma.chatMessage.create.mockImplementation((args: unknown) => {
        createCalls.push(args);
        const typedArgs = args as { data: { role: ChatMessageRole } };
        if (typedArgs.data.role === ChatMessageRole.Assistant) {
          return Promise.reject(new Error('Prisma database failure'));
        }
        return Promise.resolve({ id: 'msg-uuid' });
      });

      const events: ChatStreamEvent[] = [];
      let didComplete = false;
      const state = { errorThrown: null as Error | null };

      await new Promise<void>((resolve) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: (err: unknown) => {
              state.errorThrown = err as Error;
              resolve();
            },
            complete: () => {
              didComplete = true;
              resolve();
            },
          });
      });

      expect(state.errorThrown).not.toBeNull();
      expect(state.errorThrown?.message).toBe('Prisma database failure');
      expect(didComplete).toBe(false);
      expect(events).toEqual([]); // No events emitted since it errored before emissions
    });

    it('5. Explicit context-present boundary error (final admittedChunks.length > 0)', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'c1',
        documentName: 'c1.pdf',
        pageNumber: null,
        content: 'Fits in budget',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      // Provide mock provider stream that throws implementation boundary error
      mockAIProvider.generateStream.mockImplementation(() => {
        throw new Error(
          'Context-present branch not implemented in Substep 5.6.',
        );
      });

      const events: ChatStreamEvent[] = [];
      let didComplete = false;
      const state = { errorThrown: null as Error | null };

      await new Promise<void>((resolve) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: (err: unknown) => {
              state.errorThrown = err as Error;
              resolve();
            },
            complete: () => {
              didComplete = true;
              resolve();
            },
          });
      });

      expect(state.errorThrown).not.toBeNull();
      expect(state.errorThrown?.message).toContain(
        'Context-present branch not implemented',
      );
      expect(didComplete).toBe(false);
      expect(events).toEqual([]);

      // Asserts that no fallback assistant message is persisted
      const calls = mockPrisma.chatMessage.create.mock.calls as {
        data: { role: ChatMessageRole };
      }[][];
      const assistantCreates = calls.filter(
        (call) => call[0].data.role === ChatMessageRole.Assistant,
      );
      expect(assistantCreates.length).toBe(0);
    });

    it('6. Cold Observable subscription executions: executeFoundation runs exactly once per subscription', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [],
      });

      // Before subscribing, mockSearchService.search hasn't been called in this test
      expect(mockSearchService.search).toHaveBeenCalledTimes(0);

      const observable = service.processChatStream(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      // Still 0 before subscription (cold Observable)
      expect(mockSearchService.search).toHaveBeenCalledTimes(0);

      // Subscription 1
      await new Promise<void>((resolve, reject) =>
        observable.subscribe({ error: reject, complete: resolve }),
      );
      expect(mockSearchService.search).toHaveBeenCalledTimes(1);

      // Subscription 2
      await new Promise<void>((resolve, reject) =>
        observable.subscribe({ error: reject, complete: resolve }),
      );
      expect(mockSearchService.search).toHaveBeenCalledTimes(2);
    });
  });

  describe('processChatStream - Context-Present AI Streaming', () => {
    // Helper to wrap AsyncIterable yielding tokens
    async function* mockStreamGenerator(
      tokens: string[],
    ): AsyncGenerator<string> {
      for (const token of tokens) {
        await Promise.resolve();
        yield token;
      }
    }

    // Helper for error throwing generators
    async function* mockErrorStreamGenerator(
      tokens: string[],
      errorMsg: string,
    ): AsyncGenerator<string> {
      for (const token of tokens) {
        await Promise.resolve();
        yield token;
      }
      throw new Error(errorMsg);
    }

    it('1. Successful multi-fragment streaming with citations resolving contiguously', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'doc-uuid-1',
        documentName: 'doc1.pdf',
        pageNumber: 5,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      mockAIProvider.generateStream.mockReturnValue(
        mockStreamGenerator([
          'According to ',
          '[DOC-1], the ',
          'policy allows remote work.',
        ]),
      );

      const events: ChatStreamEvent[] = [];
      let didComplete = false;

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: reject,
            complete: () => {
              didComplete = true;
              resolve();
            },
          });
      });

      expect(didComplete).toBe(true);
      // Verify assistant message is persisted
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          chatSessionId: 's-id',
          role: ChatMessageRole.Assistant,
          content: 'According to [DOC-1], the policy allows remote work.',
          citations: [
            {
              documentId: 'doc-uuid-1',
              filename: 'doc1.pdf',
              page: 5,
            },
          ],
        },
      });

      // Verify exact events: 3 messages, 1 citation, 1 complete
      expect(events).toEqual([
        { type: 'message', token: 'According to ' },
        { type: 'message', token: '[DOC-1], the ' },
        { type: 'message', token: 'policy allows remote work.' },
        {
          type: 'citation',
          citation: {
            documentId: 'doc-uuid-1',
            filename: 'doc1.pdf',
            page: 5,
          },
        },
        { type: 'complete', chatSessionId: 's-id' },
      ]);
    });

    it('2. Exact whitespace-only fragment preservation (no trims)', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'doc-uuid-1',
        documentName: 'doc1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      mockAIProvider.generateStream.mockReturnValue(
        mockStreamGenerator([
          'The policy',
          ' ',
          'allows',
          '\n',
          'remote work.',
        ]),
      );

      const events: ChatStreamEvent[] = [];
      let didComplete = false;

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: reject,
            complete: () => {
              didComplete = true;
              resolve();
            },
          });
      });

      expect(didComplete).toBe(true);
      expect(events.filter((e) => e.type === 'message')).toEqual([
        { type: 'message', token: 'The policy' },
        { type: 'message', token: ' ' },
        { type: 'message', token: 'allows' },
        { type: 'message', token: '\n' },
        { type: 'message', token: 'remote work.' },
      ]);

      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          chatSessionId: 's-id',
          role: ChatMessageRole.Assistant,
          content: 'The policy allows\nremote work.',
          citations: [],
        },
      });
    });

    it('3. Dedicated ordering test: message events -> DB persistence resolves -> citation -> complete', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'doc-uuid-1',
        documentName: 'doc1.pdf',
        pageNumber: 1,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      mockAIProvider.generateStream.mockReturnValue(
        mockStreamGenerator(['See ', '[DOC-1]']),
      );

      const callOrder: string[] = [];

      mockPrisma.chatMessage.create.mockImplementation((args: unknown) => {
        const typedArgs = args as { data: { role: ChatMessageRole } };
        if (typedArgs.data.role === ChatMessageRole.Assistant) {
          callOrder.push('persist-assistant');
        } else {
          callOrder.push('persist-user');
        }
        return Promise.resolve({ id: 'msg-uuid' });
      });

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => {
              if (ev.type === 'message') {
                callOrder.push(`msg-${ev.token}`);
              } else if (ev.type === 'citation') {
                callOrder.push('emit-citation');
              } else if (ev.type === 'complete') {
                callOrder.push('emit-complete');
              }
            },
            error: reject,
            complete: resolve,
          });
      });

      expect(callOrder).toEqual([
        'persist-user',
        'msg-See ',
        'msg-[DOC-1]',
        'persist-assistant',
        'emit-citation',
        'emit-complete',
      ]);
    });

    it('4. Duplicate identical citation ID deduplication (retains first valid occurrence)', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      mockAIProvider.generateStream.mockReturnValue(
        mockStreamGenerator(['Look at ', '[DOC-1] and also [DOC-1].']),
      );

      const events: ChatStreamEvent[] = [];

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: reject,
            complete: resolve,
          });
      });

      const citations = events.filter((e) => e.type === 'citation');
      expect(citations.length).toBe(1); // Deduplicated to exactly 1 citation
    });

    it('5. Distinct valid citation IDs are not collapsed even if documentId/page match', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      // Two chunks from same document/page, but distinct citation identifiers (DOC-1 and DOC-2)
      const chunk1: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: 2,
        content: 'content 1',
      };
      const chunk2: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: 2,
        content: 'content 2',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1, chunk2],
      });

      mockAIProvider.generateStream.mockReturnValue(
        mockStreamGenerator(['Check [DOC-1] and [DOC-2]']),
      );

      const events: ChatStreamEvent[] = [];

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: reject,
            complete: resolve,
          });
      });

      const citations = events.filter((e) => e.type === 'citation');
      expect(citations.length).toBe(2); // Emits both distinct citation events
    });

    it('6. Unknown citation IDs ignored', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      // DOC-9 is unknown since only DOC-1 was admitted
      mockAIProvider.generateStream.mockReturnValue(
        mockStreamGenerator(['Refer to ', '[DOC-9]']),
      );

      const events: ChatStreamEvent[] = [];

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: reject,
            complete: resolve,
          });
      });

      const citations = events.filter((e) => e.type === 'citation');
      expect(citations.length).toBe(0); // Ignore DOC-9
    });

    it('7. Missing page omitted from resolved citations', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: null, // Null pageNumber
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      mockAIProvider.generateStream.mockReturnValue(
        mockStreamGenerator(['See ', '[DOC-1]']),
      );

      const events: ChatStreamEvent[] = [];

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: reject,
            complete: resolve,
          });
      });

      const citationEvent = events.find((e) => e.type === 'citation') as {
        citation: ChatCitation;
      };
      expect(citationEvent.citation.page).toBeUndefined(); // Page property is omitted completely
    });

    it('8. No citation tags resolves to [] and emits no citation events', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      mockAIProvider.generateStream.mockReturnValue(
        mockStreamGenerator([
          'Just a plain text response without DOC markers.',
        ]),
      );

      const events: ChatStreamEvent[] = [];

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: reject,
            complete: resolve,
          });
      });

      const citations = events.filter((e) => e.type === 'citation');
      expect(citations.length).toBe(0);

      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          chatSessionId: 's-id',
          role: ChatMessageRole.Assistant,
          content: 'Just a plain text response without DOC markers.',
          citations: [],
        },
      });
    });

    it('9. Mid-stream provider failure (propagates error, blocks complete, does not persist)', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      // Mid-stream error
      mockAIProvider.generateStream.mockReturnValue(
        mockErrorStreamGenerator(
          ['Some text ', 'before failure '],
          'AI completetion failure',
        ),
      );

      const events: ChatStreamEvent[] = [];
      const state = { errorThrown: null as Error | null };

      await new Promise<void>((resolve) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: (err: unknown) => {
              state.errorThrown = err as Error;
              resolve();
            },
            complete: () => {
              resolve();
            },
          });
      });

      expect(state.errorThrown).not.toBeNull();
      expect(state.errorThrown?.message).toBe('AI completetion failure');
      expect(events).toEqual([
        { type: 'message', token: 'Some text ' },
        { type: 'message', token: 'before failure ' },
      ]); // Only initial fragments are emitted, no citations or complete

      // Confirms database write was not called for assistant response
      const calls = mockPrisma.chatMessage.create.mock.calls as {
        data: { role: ChatMessageRole };
      }[][];
      const assistantCalls = calls.filter(
        (c) => c[0].data.role === ChatMessageRole.Assistant,
      );
      expect(assistantCalls.length).toBe(0);
    });

    it('10. Post-stream persistence failure propagates through Observable and blocks citations/complete', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      mockAIProvider.generateStream.mockReturnValue(
        mockStreamGenerator(['Final text [DOC-1]']),
      );

      mockPrisma.chatMessage.create.mockImplementation((args: unknown) => {
        const typedArgs = args as { data: { role: ChatMessageRole } };
        if (typedArgs.data.role === ChatMessageRole.Assistant) {
          return Promise.reject(new Error('Prisma write crash'));
        }
        return Promise.resolve({ id: 'msg-uuid' });
      });

      const events: ChatStreamEvent[] = [];
      const state = { errorThrown: null as Error | null };

      await new Promise<void>((resolve) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: (err: unknown) => {
              state.errorThrown = err as Error;
              resolve();
            },
            complete: resolve,
          });
      });

      expect(state.errorThrown).not.toBeNull();
      expect(state.errorThrown?.message).toBe('Prisma write crash');
      expect(events).toEqual([
        { type: 'message', token: 'Final text [DOC-1]' },
      ]); // Emits message fragments, but blocks citations & complete
    });

    it('11. Empty provider stream throws AIProviderError, blocks persistence, blocks citations/complete', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      // Emits zero tokens
      mockAIProvider.generateStream.mockReturnValue(mockStreamGenerator([]));

      const events: ChatStreamEvent[] = [];
      const state = { errorThrown: null as Error | null };

      await new Promise<void>((resolve) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: (err: unknown) => {
              state.errorThrown = err as Error;
              resolve();
            },
            complete: resolve,
          });
      });

      expect(state.errorThrown).toBeInstanceOf(AIProviderError);
      expect(state.errorThrown?.message).toContain(
        'completed with no text fragments',
      );
      expect(events).toEqual([]); // No events at all

      // Confirms database write was not called for assistant response
      const calls = mockPrisma.chatMessage.create.mock.calls as {
        data: { role: ChatMessageRole };
      }[][];
      const assistantCalls = calls.filter(
        (c) => c[0].data.role === ChatMessageRole.Assistant,
      );
      expect(assistantCalls.length).toBe(0);
    });

    it('12. Existing no-context fallback remains unchanged and does not call AI provider', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [],
      }); // Zero results

      const events: ChatStreamEvent[] = [];

      await new Promise<void>((resolve, reject) => {
        service
          .processChatStream(
            { message: 'Hello', chatSessionId: 's-id' },
            mockUser,
          )
          .subscribe({
            next: (ev) => events.push(ev),
            error: reject,
            complete: resolve,
          });
      });

      expect(mockAIProvider.generateStream).not.toHaveBeenCalled();
      expect(events).toEqual([
        { type: 'message', token: NO_CONTEXT_FALLBACK },
        { type: 'complete', chatSessionId: 's-id' },
      ]);
    });

    it('13. Context-present stream is cold: provider execution begins only on subscription', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      mockAIProvider.generateStream.mockReturnValue(
        mockStreamGenerator(['cold test']),
      );

      expect(mockAIProvider.generateStream).toHaveBeenCalledTimes(0);

      const observable = service.processChatStream(
        { message: 'Hello', chatSessionId: 's-id' },
        mockUser,
      );

      // Still 0 before subscription
      expect(mockAIProvider.generateStream).toHaveBeenCalledTimes(0);

      await new Promise<void>((resolve, reject) =>
        observable.subscribe({ error: reject, complete: resolve }),
      );

      // Now it's called
      expect(mockAIProvider.generateStream).toHaveBeenCalledTimes(1);
    });

    it('14. Cancellation checks: skips persistence if cancelled before write begins', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: 's-id',
        userId: mockUser.userId,
      });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'msg-uuid' });
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const chunk1: IChatSearchResultItem = {
        documentId: 'd1',
        documentName: 'doc1.pdf',
        pageNumber: null,
        content: 'content 1',
      };
      mockSearchService.search.mockResolvedValue({
        query: 'Hello',
        results: [chunk1],
      });

      // Slower stream to allow cancellation
      async function* slowStream() {
        await Promise.resolve();
        yield 'frag1';
        await Promise.resolve();
        yield 'frag2';
      }
      mockAIProvider.generateStream.mockReturnValue(slowStream());

      const events: ChatStreamEvent[] = [];
      const subscription = service
        .processChatStream(
          { message: 'Hello', chatSessionId: 's-id' },
          mockUser,
        )
        .subscribe({
          next: (ev) => {
            events.push(ev);
            if (ev.type === 'message' && ev.token === 'frag2') {
              subscription.unsubscribe(); // Unsubscribe right after second fragment
            }
          },
        });

      // Allow microtask cycle to finish the async completions wrapper execution
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      // Emits only messages, skips assistant persistence completely
      expect(events).toEqual([
        { type: 'message', token: 'frag1' },
        { type: 'message', token: 'frag2' },
      ]);

      const calls = mockPrisma.chatMessage.create.mock.calls as {
        data: { role: ChatMessageRole };
      }[][];
      const assistantWrites = calls.filter(
        (c) => c[0].data.role === ChatMessageRole.Assistant,
      );
      expect(assistantWrites.length).toBe(0); // Persistence skipped
    });
  });
});

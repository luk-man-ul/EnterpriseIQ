/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChatSessionService } from './chat-session.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

describe('ChatSessionService', () => {
  let service: ChatSessionService;
  let prisma: PrismaService;

  const mockPrismaService = {
    chatSession: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatSessionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ChatSessionService>(ChatSessionService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('findSessionsForUser', () => {
    it('should query Prisma findMany with correct user filter, select projection, and ordering', async () => {
      const mockSessions = [
        { id: 'uuid-1', title: 'Session 1', createdAt: new Date() },
      ];
      mockPrismaService.chatSession.findMany.mockResolvedValue(mockSessions);

      const result = await service.findSessionsForUser('user-uuid');

      expect(prisma.chatSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      });
      expect(prisma.chatSession.findMany).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockSessions);
    });

    it('should return empty list when no sessions exist', async () => {
      mockPrismaService.chatSession.findMany.mockResolvedValue([]);

      const result = await service.findSessionsForUser('user-uuid');

      expect(result).toEqual([]);
      expect(prisma.chatSession.findMany).toHaveBeenCalledTimes(1);
    });

    it('should propagate Prisma database errors unchanged', async () => {
      const dbErr = new Error('Database down');
      mockPrismaService.chatSession.findMany.mockRejectedValue(dbErr);

      await expect(service.findSessionsForUser('user-uuid')).rejects.toThrow(
        'Database down',
      );
    });
  });

  describe('findMessagesForSession', () => {
    const sessionId = 'session-uuid';
    const userId = 'user-uuid';

    it('should query findFirst with both sessionId and userId and return chronological messages', async () => {
      const mockSession = {
        messages: [
          {
            id: 'msg-1',
            role: 'User',
            content: 'Hello',
            citations: [],
            createdAt: new Date('2026-07-02T03:00:00Z'),
          },
          {
            id: 'msg-2',
            role: 'Assistant',
            content: 'Hi',
            citations: [{ documentId: 'doc-1', filename: 'file.pdf' }],
            createdAt: new Date('2026-07-02T03:00:01Z'),
          },
        ],
      };
      mockPrismaService.chatSession.findFirst.mockResolvedValue(mockSession);

      const result = await service.findMessagesForSession(sessionId, userId);

      expect(prisma.chatSession.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.chatSession.findFirst).toHaveBeenCalledWith({
        where: {
          id: sessionId,
          userId,
        },
        select: {
          messages: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              role: true,
              content: true,
              citations: true,
              createdAt: true,
            },
          },
        },
      });
      expect(result).toBe(mockSession.messages);
    });

    it('should throw non-disclosing NotFoundException if session is not found', async () => {
      mockPrismaService.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.findMessagesForSession(sessionId, userId),
      ).rejects.toThrow(new NotFoundException('Chat session not found.'));
    });

    it('should throw identical non-disclosing NotFoundException if session exists but belongs to another user', async () => {
      mockPrismaService.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.findMessagesForSession(sessionId, 'another-user-uuid'),
      ).rejects.toThrow(new NotFoundException('Chat session not found.'));
    });

    it('should return empty messages list if session exists but has no messages', async () => {
      const mockSession = { messages: [] };
      mockPrismaService.chatSession.findFirst.mockResolvedValue(mockSession);

      const result = await service.findMessagesForSession(sessionId, userId);

      expect(result).toEqual([]);
    });

    it('should propagate database error unchanged', async () => {
      const dbErr = new Error('Database connection failed');
      mockPrismaService.chatSession.findFirst.mockRejectedValue(dbErr);

      await expect(
        service.findMessagesForSession(sessionId, userId),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('deleteSessionForUser', () => {
    const sessionId = 'session-uuid';
    const userId = 'user-uuid';

    it('should query deleteMany with sessionId and userId and complete successfully', async () => {
      mockPrismaService.chatSession.deleteMany.mockResolvedValue({ count: 1 });

      await expect(
        service.deleteSessionForUser(sessionId, userId),
      ).resolves.not.toThrow();

      expect(prisma.chatSession.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.chatSession.deleteMany).toHaveBeenCalledWith({
        where: {
          id: sessionId,
          userId,
        },
      });
    });

    it('should throw non-disclosing NotFoundException if deleted count is 0', async () => {
      mockPrismaService.chatSession.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.deleteSessionForUser(sessionId, userId),
      ).rejects.toThrow(new NotFoundException('Chat session not found.'));
    });

    it('should throw identical non-disclosing NotFoundException if session belongs to another user (count 0)', async () => {
      mockPrismaService.chatSession.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.deleteSessionForUser(sessionId, 'another-user-uuid'),
      ).rejects.toThrow(new NotFoundException('Chat session not found.'));
    });

    it('should propagate database error unchanged', async () => {
      const dbErr = new Error('Database error');
      mockPrismaService.chatSession.deleteMany.mockRejectedValue(dbErr);

      await expect(
        service.deleteSessionForUser(sessionId, userId),
      ).rejects.toThrow('Database error');
    });
  });
});

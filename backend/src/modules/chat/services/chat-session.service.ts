import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class ChatSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async findSessionsForUser(userId: string) {
    return this.prisma.chatSession.findMany({
      where: {
        userId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });
  }

  async findMessagesForSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
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

    if (!session) {
      throw new NotFoundException('Chat session not found.');
    }

    return session.messages;
  }

  async deleteSessionForUser(sessionId: string, userId: string): Promise<void> {
    const result = await this.prisma.chatSession.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Chat session not found.');
    }
  }
}

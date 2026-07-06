import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  Param,
  ParseUUIDPipe,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Subscription } from 'rxjs';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ChatService, IExpressUser } from '../services/chat.service';
import { ChatSessionService } from '../services/chat-session.service';
import { ChatRequestDto } from '../dto/chat-request.dto';
import { AIProviderError } from '../../ai/domain/interfaces/ai-provider.interface';

interface ChatCitation {
  documentId: string;
  filename: string;
  page?: number;
}

function normalizeCitations(raw: unknown): ChatCitation[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: ChatCitation[] = [];

  for (const entry of raw) {
    if (
      entry &&
      typeof entry === 'object' &&
      'documentId' in entry &&
      'filename' in entry &&
      typeof (entry as Record<string, unknown>).documentId === 'string' &&
      typeof (entry as Record<string, unknown>).filename === 'string'
    ) {
      const typedEntry = entry as Record<string, unknown>;
      const page = typedEntry.page;
      const citation: ChatCitation = {
        documentId: typedEntry.documentId as string,
        filename: typedEntry.filename as string,
      };

      if (typeof page === 'number') {
        citation.page = page;
      }

      normalized.push(citation);
    }
  }

  return normalized;
}

function isEventStreamAcceptable(acceptHeader: string): boolean {
  const mediaRanges = acceptHeader.split(',').map((item) => item.trim());

  let bestSpecificity = 0;
  let bestQuality = 0;

  for (const range of mediaRanges) {
    if (!range) continue;

    const parts = range.split(';');
    const mediaType = parts[0].trim().toLowerCase();

    let specificity = 0;
    if (mediaType === 'text/event-stream') {
      specificity = 3;
    } else if (mediaType === 'text/*') {
      specificity = 2;
    } else if (mediaType === '*/*') {
      specificity = 1;
    } else {
      continue;
    }

    let quality = 1.0;
    const qParam = parts
      .slice(1)
      .find((p) => p.trim().toLowerCase().startsWith('q='));
    if (qParam) {
      const qValStr = qParam.split('=')[1]?.trim();
      const qRegex = /^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/;
      if (!qValStr || !qRegex.test(qValStr)) {
        quality = 0.0;
      } else {
        quality = parseFloat(qValStr);
      }
    }

    if (specificity > bestSpecificity) {
      bestSpecificity = specificity;
      bestQuality = quality;
    } else if (specificity === bestSpecificity) {
      if (quality > bestQuality) {
        bestQuality = quality;
      }
    }
  }

  return bestSpecificity > 0 && bestQuality > 0;
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatSessionService: ChatSessionService,
  ) {}

  @Get('sessions')
  async getSessions(@Req() req: Request) {
    const user = req.user as IExpressUser;
    const sessions = await this.chatSessionService.findSessionsForUser(
      user.userId,
    );
    const mappedSessions = sessions.map((session) => ({
      chatSessionId: session.id,
      title: session.title,
      createdAt: session.createdAt,
    }));
    return {
      success: true,
      message: 'Chat sessions retrieved.',
      data: mappedSessions,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sessions/:id')
  async getSessionHistory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request,
  ) {
    const user = req.user as IExpressUser;
    const messages = await this.chatSessionService.findMessagesForSession(
      id,
      user.userId,
    );

    const mappedMessages = messages.map((msg) => {
      const base = {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      };

      if (msg.role === 'Assistant') {
        const citations = normalizeCitations(msg.citations);
        return {
          ...base,
          citations: citations.map((c) => ({
            documentId: c.documentId,
            filename: c.filename,
            ...(c.page !== undefined ? { page: c.page } : {}),
          })),
        };
      }

      return base;
    });

    return {
      success: true,
      message: 'Chat messages history retrieved.',
      data: mappedMessages,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('sessions/:id')
  async deleteSession(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request,
  ) {
    const user = req.user as IExpressUser;
    await this.chatSessionService.deleteSessionForUser(id, user.userId);
    return {
      success: true,
      message: 'Chat session and messages successfully deleted.',
      data: {},
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  chat(
    @Body() dto: ChatRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    const acceptHeader = req.headers.accept;
    if (!acceptHeader) {
      throw new BadRequestException(
        'Accept header with text/event-stream is required.',
      );
    }

    if (!isEventStreamAcceptable(acceptHeader)) {
      throw new BadRequestException(
        'Accept header must allow text/event-stream.',
      );
    }

    const user = req.user as IExpressUser;

    // Immediately establish standard Express SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();

    let subscription: Subscription | null = null;
    let isTerminated = false;

    const handleClose = () => {
      if (isTerminated) return;
      isTerminated = true;
      req.off('close', handleClose);
      if (subscription) {
        subscription.unsubscribe();
      }
    };

    req.on('close', handleClose);

    subscription = this.chatService.processChatStream(dto, user).subscribe({
      next: (event) => {
        if (isTerminated || res.writableEnded) return;
        const sseData = JSON.stringify(
          event.type === 'message'
            ? { token: event.token }
            : event.type === 'citation'
              ? {
                  documentId: event.citation.documentId,
                  filename: event.citation.filename,
                  ...(event.citation.page !== undefined
                    ? { page: event.citation.page }
                    : {}),
                }
              : { chatSessionId: event.chatSessionId },
        );
        res.write(`event: ${event.type}\ndata: ${sseData}\n\n`);
      },
      error: (err) => {
        if (isTerminated) return;

        if (!res.writableEnded && req.socket?.writable) {
          const payload =
            err instanceof AIProviderError
              ? { code: 'AI_PROVIDER_ERROR', message: 'AI generation failed.' }
              : {
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'An unexpected error occurred.',
                };
          res.write(`event: error\ndata: ${JSON.stringify(payload)}\n\n`);
        }

        isTerminated = true;
        req.off('close', handleClose);
        if (!res.writableEnded) {
          res.end();
        }
      },
      complete: () => {
        if (isTerminated) return;
        isTerminated = true;
        req.off('close', handleClose);
        if (!res.writableEnded) {
          res.end();
        }
      },
    });
  }
}

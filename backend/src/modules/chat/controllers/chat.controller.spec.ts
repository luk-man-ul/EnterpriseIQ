/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { of, throwError, Subject } from 'rxjs';
import { ChatController } from './chat.controller';
import { ChatService } from '../services/chat.service';
import { ChatSessionService } from '../services/chat-session.service';
import { ChatRequestDto } from '../dto/chat-request.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AIProviderError } from '../../ai/domain/interfaces/ai-provider.interface';
import { ParseUUIDPipe, BadRequestException } from '@nestjs/common';

describe('ChatController', () => {
  let controller: ChatController;
  let chatSessionService: ChatSessionService;

  const mockChatService = {
    processChatStream: jest.fn(),
  };

  const mockChatSessionService = {
    findSessionsForUser: jest.fn(),
    findMessagesForSession: jest.fn(),
    deleteSessionForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
        {
          provide: ChatSessionService,
          useValue: mockChatSessionService,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatSessionService = module.get<ChatSessionService>(ChatSessionService);
    jest.clearAllMocks();
  });

  describe('Route and Guard Metadata', () => {
    it('should be configured with Controller prefix "chat" and JwtAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', ChatController);
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(JwtAuthGuard);

      const path = Reflect.getMetadata('path', ChatController);
      expect(path).toBe('chat');
    });

    it('should configure handler for POST without subpath', () => {
      const path = Reflect.getMetadata('path', ChatController.prototype.chat);
      const method = Reflect.getMetadata(
        'method',
        ChatController.prototype.chat,
      );
      expect(path).toBe('/');
      expect(method).toBe(1); // 1 = RequestMethod.POST in NestJS RequestMethod enum
    });

    it('should configure handler for GET sessions', () => {
      const path = Reflect.getMetadata(
        'path',
        ChatController.prototype.getSessions,
      );
      const method = Reflect.getMetadata(
        'method',
        ChatController.prototype.getSessions,
      );
      expect(path).toBe('sessions');
      expect(method).toBe(0); // 0 = RequestMethod.GET in NestJS RequestMethod enum
    });

    it('should configure handler for GET sessions/:id with ParseUUIDPipe version 4', () => {
      const path = Reflect.getMetadata(
        'path',
        ChatController.prototype.getSessionHistory,
      );
      const method = Reflect.getMetadata(
        'method',
        ChatController.prototype.getSessionHistory,
      );
      expect(path).toBe('sessions/:id');
      expect(method).toBe(0);

      // Verify Param decorator metadata for UUID Pipe
      const params = Reflect.getMetadata(
        '__routeArguments__',
        ChatController,
        'getSessionHistory',
      );
      expect(params).toBeDefined();
      const paramKey = Object.keys(params).find(
        (key) => params[key].data === 'id',
      );
      expect(paramKey).toBeDefined();
      const pipeInstance = params[paramKey as string].pipes[0];
      expect(pipeInstance).toBeInstanceOf(ParseUUIDPipe);
      expect(pipeInstance.version).toBe('4');
    });

    it('should configure handler for DELETE sessions/:id with ParseUUIDPipe version 4', () => {
      const path = Reflect.getMetadata(
        'path',
        ChatController.prototype.deleteSession,
      );
      const method = Reflect.getMetadata(
        'method',
        ChatController.prototype.deleteSession,
      );
      expect(path).toBe('sessions/:id');
      expect(method).toBe(3); // 3 = RequestMethod.DELETE in NestJS RequestMethod enum

      const params = Reflect.getMetadata(
        '__routeArguments__',
        ChatController,
        'deleteSession',
      );
      expect(params).toBeDefined();
      const paramKey = Object.keys(params).find(
        (key) => params[key].data === 'id',
      );
      expect(paramKey).toBeDefined();
      const pipeInstance = params[paramKey as string].pipes[0];
      expect(pipeInstance).toBeInstanceOf(ParseUUIDPipe);
      expect(pipeInstance.version).toBe('4');
    });
  });

  describe('Request Processing', () => {
    let mockReq: any;
    let mockRes: any;
    let dto: ChatRequestDto;

    beforeEach(() => {
      mockReq = {
        headers: {
          accept: 'text/event-stream',
        },
        user: {
          userId: 'user-uuid',
          email: 'user@enterprise.com',
          firstName: 'First',
          lastName: 'Last',
          roleId: 'role-uuid',
          departmentId: 'dept-uuid',
          roleName: 'Employee',
        },
        on: jest.fn(),
        off: jest.fn(),
        socket: {
          writable: true,
        },
      };

      mockRes = {
        writeHead: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        writableEnded: false,
        socket: {
          writable: true,
        },
      };

      dto = {
        message: 'What is the stipend amount?',
        chatSessionId: 'session-uuid',
      };
    });

    it('should establish standard headers, call flushHeaders, and subscribe', () => {
      mockChatService.processChatStream.mockReturnValue(of());

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      expect(mockRes.flushHeaders).toHaveBeenCalled();
      expect(mockChatService.processChatStream).toHaveBeenCalledWith(
        dto,
        mockReq.user,
      );
      expect(mockChatService.processChatStream).toHaveBeenCalledTimes(1);
    });

    it('should preserve whitespace-only tokens exactly (transport verification)', () => {
      // Mock chat stream emitting whitespace-only tokens
      const stream = of({ type: 'message', token: '   ' } as any);
      mockChatService.processChatStream.mockReturnValue(stream);

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockRes.write).toHaveBeenCalledWith(
        'event: message\ndata: {"token":"   "}\n\n',
      );
    });

    it('should serialize citation events with page number', () => {
      const citationEvent = {
        type: 'citation',
        citation: {
          documentId: 'doc-uuid',
          filename: 'doc.pdf',
          page: 5,
        },
      };
      mockChatService.processChatStream.mockReturnValue(
        of(citationEvent as any),
      );

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockRes.write).toHaveBeenCalledWith(
        `event: citation\ndata: ${JSON.stringify(citationEvent.citation)}\n\n`,
      );
    });

    it('should serialize citation events without page number completely omitting the page key', () => {
      const citationEvent = {
        type: 'citation',
        citation: {
          documentId: 'doc-uuid',
          filename: 'doc.pdf',
        },
      };
      mockChatService.processChatStream.mockReturnValue(
        of(citationEvent as any),
      );

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockRes.write).toHaveBeenCalledWith(
        `event: citation\ndata: ${JSON.stringify({ documentId: 'doc-uuid', filename: 'doc.pdf' })}\n\n`,
      );
    });

    it('should serialize complete events', () => {
      const completeEvent = {
        type: 'complete',
        chatSessionId: 'session-uuid',
      };
      mockChatService.processChatStream.mockReturnValue(
        of(completeEvent as any),
      );

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockRes.write).toHaveBeenCalledWith(
        `event: complete\ndata: ${JSON.stringify({ chatSessionId: 'session-uuid' })}\n\n`,
      );
    });

    it('should call res.end() on complete', () => {
      mockChatService.processChatStream.mockReturnValue(of());

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should write sanitized error payload for AIProviderError and close stream', () => {
      const provErr = new AIProviderError(
        'Upstream connection failed',
        'API_RATE_LIMIT',
      );
      mockChatService.processChatStream.mockReturnValue(
        throwError(() => provErr),
      );

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockRes.write).toHaveBeenCalledWith(
        `event: error\ndata: ${JSON.stringify({ code: 'AI_PROVIDER_ERROR', message: 'AI generation failed.' })}\n\n`,
      );
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should write generic sanitized error payload for unknown errors and close stream without leaking messages', () => {
      const dbErr = new Error(
        'FATAL database query connection failed at pool line 53',
      );
      mockChatService.processChatStream.mockReturnValue(
        throwError(() => dbErr),
      );

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockRes.write).toHaveBeenCalledWith(
        `event: error\ndata: ${JSON.stringify({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' })}\n\n`,
      );
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle client disconnect close event by unsubscribing and cleaning listener', () => {
      const eventSubject = new Subject<any>();
      mockChatService.processChatStream.mockReturnValue(eventSubject);

      let closeHandler: any;
      mockReq.on.mockImplementation((event: string, handler: any) => {
        if (event === 'close') {
          closeHandler = handler;
        }
      });

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(closeHandler).toBeDefined();

      // Trigger close
      closeHandler();

      // Expect close listener removed
      expect(mockReq.off).toHaveBeenCalledWith('close', closeHandler);
    });

    it('should clean up the request close listener on normal complete', () => {
      mockChatService.processChatStream.mockReturnValue(of());

      let closeHandler: any;
      mockReq.on.mockImplementation((event: string, handler: any) => {
        if (event === 'close') {
          closeHandler = handler;
        }
      });

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockReq.off).toHaveBeenCalledWith('close', closeHandler);
    });

    it('should clean up the request close listener on error', () => {
      mockChatService.processChatStream.mockReturnValue(
        throwError(() => new Error()),
      );

      let closeHandler: any;
      mockReq.on.mockImplementation((event: string, handler: any) => {
        if (event === 'close') {
          closeHandler = handler;
        }
      });

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockReq.off).toHaveBeenCalledWith('close', closeHandler);
    });

    it('should prevent writing if connection is terminated or res.writableEnded is true', () => {
      mockRes.writableEnded = true;

      const event = { type: 'message', token: 'token' };
      mockChatService.processChatStream.mockReturnValue(of(event as any));

      controller.chat(dto, mockReq as Request, mockRes as Response);

      expect(mockRes.write).not.toHaveBeenCalled();
    });

    it('should safely execute under synchronous Observable completion', () => {
      mockChatService.processChatStream.mockReturnValue(
        of({ type: 'message', token: 'sync' } as any),
      );

      // Should not throw ReferenceError
      expect(() => {
        controller.chat(dto, mockReq as Request, mockRes as Response);
      }).not.toThrow();
    });

    it('should safely execute under synchronous Observable error', () => {
      mockChatService.processChatStream.mockReturnValue(
        throwError(() => new Error('sync-err')),
      );

      // Should not throw ReferenceError
      expect(() => {
        controller.chat(dto, mockReq as Request, mockRes as Response);
      }).not.toThrow();
    });

    describe('Accept Header Enforcement', () => {
      it('should accept exact Accept: text/event-stream', () => {
        mockReq.headers.accept = 'text/event-stream';
        mockChatService.processChatStream.mockReturnValue(of());
        controller.chat(dto, mockReq as Request, mockRes as Response);
        expect(mockRes.writeHead).toHaveBeenCalled();
        expect(mockChatService.processChatStream).toHaveBeenCalled();
      });

      it('should accept Accept: text/event-stream;q=1', () => {
        mockReq.headers.accept = 'text/event-stream;q=1';
        mockChatService.processChatStream.mockReturnValue(of());
        controller.chat(dto, mockReq as Request, mockRes as Response);
        expect(mockRes.writeHead).toHaveBeenCalled();
      });

      it('should accept Accept: text/event-stream;q=0.5', () => {
        mockReq.headers.accept = 'text/event-stream;q=0.5';
        mockChatService.processChatStream.mockReturnValue(of());
        controller.chat(dto, mockReq as Request, mockRes as Response);
        expect(mockRes.writeHead).toHaveBeenCalled();
      });

      it('should reject Accept: text/event-stream;q=0', () => {
        mockReq.headers.accept = 'text/event-stream;q=0';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
      });

      it('should accept Accept: text/*', () => {
        mockReq.headers.accept = 'text/*';
        mockChatService.processChatStream.mockReturnValue(of());
        controller.chat(dto, mockReq as Request, mockRes as Response);
        expect(mockRes.writeHead).toHaveBeenCalled();
      });

      it('should reject Accept: text/*;q=0', () => {
        mockReq.headers.accept = 'text/*;q=0';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
      });

      it('should accept Accept: */*', () => {
        mockReq.headers.accept = '*/*';
        mockChatService.processChatStream.mockReturnValue(of());
        controller.chat(dto, mockReq as Request, mockRes as Response);
        expect(mockRes.writeHead).toHaveBeenCalled();
      });

      it('should reject Accept: */*;q=0', () => {
        mockReq.headers.accept = '*/*;q=0';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
      });

      it('should accept multi-value list containing acceptable text/event-stream', () => {
        mockReq.headers.accept =
          'application/json, text/event-stream; q=0.9, text/html';
        mockChatService.processChatStream.mockReturnValue(of());
        controller.chat(dto, mockReq as Request, mockRes as Response);
        expect(mockRes.writeHead).toHaveBeenCalled();
      });

      it('should reject application/json', () => {
        mockReq.headers.accept = 'application/json';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
      });

      it('should reject missing Accept', () => {
        delete mockReq.headers.accept;
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header with text/event-stream is required.',
          ),
        );
      });

      it('should enforce that exact q=0 overrides */* q=1 for text/event-stream due to specificity', () => {
        mockReq.headers.accept = 'text/event-stream;q=0, */*;q=1';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
        expect(mockRes.writeHead).not.toHaveBeenCalled();
        expect(mockRes.flushHeaders).not.toHaveBeenCalled();
        expect(mockChatService.processChatStream).not.toHaveBeenCalled();
      });

      it('should enforce that exact q=0 overrides text/* q=1 for text/event-stream due to specificity', () => {
        mockReq.headers.accept = 'text/event-stream;q=0, text/*;q=1';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
      });

      it('should reject malformed q-values (q=invalid)', () => {
        mockReq.headers.accept = 'text/event-stream;q=invalid';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
        expect(mockRes.writeHead).not.toHaveBeenCalled();
        expect(mockRes.flushHeaders).not.toHaveBeenCalled();
        expect(mockChatService.processChatStream).not.toHaveBeenCalled();
      });

      it('should reject malformed q-values out of bounds (q=2)', () => {
        mockReq.headers.accept = 'text/event-stream;q=2';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
        expect(mockRes.writeHead).not.toHaveBeenCalled();
        expect(mockRes.flushHeaders).not.toHaveBeenCalled();
        expect(mockChatService.processChatStream).not.toHaveBeenCalled();
      });

      it('should reject malformed q-values out of bounds (q=-0.5)', () => {
        mockReq.headers.accept = 'text/event-stream;q=-0.5';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
        expect(mockRes.writeHead).not.toHaveBeenCalled();
        expect(mockRes.flushHeaders).not.toHaveBeenCalled();
        expect(mockChatService.processChatStream).not.toHaveBeenCalled();
      });

      it('should accept valid q=0.999', () => {
        mockReq.headers.accept = 'text/event-stream;q=0.999';
        mockChatService.processChatStream.mockReturnValue(of());
        controller.chat(dto, mockReq as Request, mockRes as Response);
        expect(mockRes.writeHead).toHaveBeenCalled();
      });

      it('should accept valid q=1.000', () => {
        mockReq.headers.accept = 'text/event-stream;q=1.000';
        mockChatService.processChatStream.mockReturnValue(of());
        controller.chat(dto, mockReq as Request, mockRes as Response);
        expect(mockRes.writeHead).toHaveBeenCalled();
      });

      it('should reject malformed q=0.5junk', () => {
        mockReq.headers.accept = 'text/event-stream;q=0.5junk';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
        expect(mockRes.writeHead).not.toHaveBeenCalled();
        expect(mockRes.flushHeaders).not.toHaveBeenCalled();
        expect(mockChatService.processChatStream).not.toHaveBeenCalled();
      });

      it('should reject malformed q=1abc', () => {
        mockReq.headers.accept = 'text/event-stream;q=1abc';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
        expect(mockRes.writeHead).not.toHaveBeenCalled();
        expect(mockRes.flushHeaders).not.toHaveBeenCalled();
        expect(mockChatService.processChatStream).not.toHaveBeenCalled();
      });

      it('should reject malformed q=0.8xyz', () => {
        mockReq.headers.accept = 'text/event-stream;q=0.8xyz';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
        expect(mockRes.writeHead).not.toHaveBeenCalled();
        expect(mockRes.flushHeaders).not.toHaveBeenCalled();
        expect(mockChatService.processChatStream).not.toHaveBeenCalled();
      });

      it('should reject malformed q= (empty parameter)', () => {
        mockReq.headers.accept = 'text/event-stream;q=';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
        expect(mockRes.writeHead).not.toHaveBeenCalled();
        expect(mockRes.flushHeaders).not.toHaveBeenCalled();
        expect(mockChatService.processChatStream).not.toHaveBeenCalled();
      });

      it('should reject malformed q-values out of bounds (q=1.1)', () => {
        mockReq.headers.accept = 'text/event-stream;q=1.1';
        expect(() => {
          controller.chat(dto, mockReq as Request, mockRes as Response);
        }).toThrow(
          new BadRequestException(
            'Accept header must allow text/event-stream.',
          ),
        );
        expect(mockRes.writeHead).not.toHaveBeenCalled();
        expect(mockRes.flushHeaders).not.toHaveBeenCalled();
        expect(mockChatService.processChatStream).not.toHaveBeenCalled();
      });
    });
  });

  describe('GET /sessions', () => {
    let mockReq: any;

    beforeEach(() => {
      mockReq = {
        user: {
          userId: 'user-uuid',
          email: 'user@enterprise.com',
          firstName: 'First',
          lastName: 'Last',
          roleId: 'role-uuid',
          departmentId: 'dept-uuid',
          roleName: 'Employee',
        },
      };
    });

    it('should forward user.userId to ChatSessionService and map response properly', async () => {
      const dbDate = new Date();
      const mockSessions = [
        {
          id: 'session-uuid-1',
          title: 'Session 1',
          createdAt: dbDate,
        },
      ];
      mockChatSessionService.findSessionsForUser.mockResolvedValue(
        mockSessions,
      );

      const result = await controller.getSessions(mockReq as Request);

      expect(chatSessionService.findSessionsForUser).toHaveBeenCalledWith(
        'user-uuid',
      );
      expect(chatSessionService.findSessionsForUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: true,
        message: 'Chat sessions retrieved.',
        data: [
          {
            chatSessionId: 'session-uuid-1',
            title: 'Session 1',
            createdAt: dbDate,
          },
        ],
        timestamp: expect.any(String),
      });
    });

    it('should return empty list when no sessions exist', async () => {
      mockChatSessionService.findSessionsForUser.mockResolvedValue([]);

      const result = await controller.getSessions(mockReq as Request);

      expect(result.data).toEqual([]);
    });

    it('should propagate service errors unchanged', async () => {
      const serviceErr = new Error('Service failed');
      mockChatSessionService.findSessionsForUser.mockRejectedValue(serviceErr);

      await expect(controller.getSessions(mockReq as Request)).rejects.toThrow(
        'Service failed',
      );
    });
  });

  describe('GET /sessions/:id', () => {
    let mockReq: any;
    const sessionId = 'd90e8400-e29b-41d4-a716-446655440004';
    const userId = 'user-uuid';

    beforeEach(() => {
      mockReq = {
        user: {
          userId,
          email: 'user@enterprise.com',
          firstName: 'First',
          lastName: 'Last',
          roleId: 'role-uuid',
          departmentId: 'dept-uuid',
          roleName: 'Employee',
        },
      };
    });

    it('should forward session id and user.userId and map response envelope', async () => {
      const dbDate = new Date();
      const mockMessages = [
        {
          id: 'msg-uuid-1',
          role: 'User',
          content: 'What is the stipend?',
          citations: [{ documentId: 'doc-1', filename: 'file.pdf', page: 3 }],
          createdAt: dbDate,
        },
        {
          id: 'msg-uuid-2',
          role: 'Assistant',
          content: 'It is $50.',
          citations: [{ documentId: 'doc-1', filename: 'file.pdf', page: 3 }],
          createdAt: dbDate,
        },
      ];
      mockChatSessionService.findMessagesForSession.mockResolvedValue(
        mockMessages,
      );

      const result = await controller.getSessionHistory(
        sessionId,
        mockReq as Request,
      );

      expect(chatSessionService.findMessagesForSession).toHaveBeenCalledWith(
        sessionId,
        userId,
      );
      expect(chatSessionService.findMessagesForSession).toHaveBeenCalledTimes(
        1,
      );

      expect(result).toEqual({
        success: true,
        message: 'Chat messages history retrieved.',
        data: [
          {
            id: 'msg-uuid-1',
            role: 'User',
            content: 'What is the stipend?',
            createdAt: dbDate,
            // User message must omit citations completely
          },
          {
            id: 'msg-uuid-2',
            role: 'Assistant',
            content: 'It is $50.',
            citations: [{ documentId: 'doc-1', filename: 'file.pdf', page: 3 }],
            createdAt: dbDate,
          },
        ],
        timestamp: expect.any(String),
      });

      // Assert User message has no citations key
      expect(result.data[0]).not.toHaveProperty('citations');
      // Assert Assistant message has citations key
      expect(result.data[1]).toHaveProperty('citations');
    });

    it('should omit page property in citations if invalid or undefined', async () => {
      const dbDate = new Date();
      const mockMessages = [
        {
          id: 'msg-uuid-2',
          role: 'Assistant',
          content: 'It is $50.',
          citations: [
            {
              documentId: 'doc-1',
              filename: 'file.pdf',
              page: 'invalid-page-string',
            },
            { documentId: 'doc-2', filename: 'file2.pdf' },
          ],
          createdAt: dbDate,
        },
      ];
      mockChatSessionService.findMessagesForSession.mockResolvedValue(
        mockMessages,
      );

      const result = await controller.getSessionHistory(
        sessionId,
        mockReq as Request,
      );

      const firstMsg = result.data[0];
      if (firstMsg && 'citations' in firstMsg) {
        expect(firstMsg.citations).toEqual([
          { documentId: 'doc-1', filename: 'file.pdf' },
          { documentId: 'doc-2', filename: 'file2.pdf' },
        ]);
      } else {
        throw new Error('Expected first message to have citations');
      }
    });

    it('should return empty list when no messages exist', async () => {
      mockChatSessionService.findMessagesForSession.mockResolvedValue([]);

      const result = await controller.getSessionHistory(
        sessionId,
        mockReq as Request,
      );

      expect(result.data).toEqual([]);
    });

    it('should propagate service NotFoundException unchanged', async () => {
      const notFoundErr = new Error('Chat session not found.');
      mockChatSessionService.findMessagesForSession.mockRejectedValue(
        notFoundErr,
      );

      await expect(
        controller.getSessionHistory(sessionId, mockReq as Request),
      ).rejects.toThrow('Chat session not found.');
    });
  });

  describe('DELETE /sessions/:id', () => {
    let mockReq: any;
    const sessionId = 'd90e8400-e29b-41d4-a716-446655440004';
    const userId = 'user-uuid';

    beforeEach(() => {
      mockReq = {
        user: {
          userId,
          email: 'user@enterprise.com',
          firstName: 'First',
          lastName: 'Last',
          roleId: 'role-uuid',
          departmentId: 'dept-uuid',
          roleName: 'Employee',
        },
      };
    });

    it('should forward session id and user.userId, call service deleteSessionForUser exactly once, and map success envelope', async () => {
      mockChatSessionService.deleteSessionForUser.mockResolvedValue(undefined);

      const result = await controller.deleteSession(
        sessionId,
        mockReq as Request,
      );

      expect(chatSessionService.deleteSessionForUser).toHaveBeenCalledWith(
        sessionId,
        userId,
      );
      expect(chatSessionService.deleteSessionForUser).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        success: true,
        message: 'Chat session and messages successfully deleted.',
        data: {},
        timestamp: expect.any(String),
      });
    });

    it('should propagate service NotFoundException unchanged', async () => {
      const notFoundErr = new Error('Chat session not found.');
      mockChatSessionService.deleteSessionForUser.mockRejectedValue(
        notFoundErr,
      );

      await expect(
        controller.deleteSession(sessionId, mockReq as Request),
      ).rejects.toThrow('Chat session not found.');
    });

    it('should propagate generic service/database errors unchanged', async () => {
      const dbErr = new Error('Database connection failed');
      mockChatSessionService.deleteSessionForUser.mockRejectedValue(dbErr);

      await expect(
        controller.deleteSession(sessionId, mockReq as Request),
      ).rejects.toThrow('Database connection failed');
    });
  });
});

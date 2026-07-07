import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ChatRequestDto } from '../dto/chat-request.dto';
import {
  ChatStreamEvent,
  ChatCitation,
} from '../domain/interfaces/chat-stream.interface';
import { Observable, defer, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { ChatMessage, ChatMessageRole, Prisma } from '@prisma/client';
import { getEncoding } from 'js-tiktoken';
import { SearchService } from '../../search/services/search.service';
import { SearchResponseDto } from '../../search/dto/search-response.dto';
import { AI_PROVIDER_TOKEN } from '../../ai/constants/ai.constants';
import { AIProviderError } from '../../ai/domain/interfaces/ai-provider.interface';
import type { IAIProvider } from '../../ai/domain/interfaces/ai-provider.interface';

export interface IExpressUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
  roleName: string;
}

export interface IChatSearchResultItem {
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  content: string;
  citationId?: string;
}

export const HISTORY_TOKEN_BUDGET = 1500;
export const B_MAX = 8000;
export const B_OUT = 2000;
export const B_SAFE = 500;
export const B_LIMIT = 5500;
export const NO_CONTEXT_FALLBACK =
  "I couldn't find enough authorized context to answer that question.";

@Injectable()
export class ChatService {
  private readonly tokenizer = getEncoding('cl100k_base');

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    @Inject(AI_PROVIDER_TOKEN)
    private readonly aiProvider: IAIProvider,
  ) {}

  /**
   * Main entry point for RAG chat processing (Observable stream).
   * Orchestrates prompt budgeting, search, fallback logic, and events.
   */
  processChatStream(
    dto: ChatRequestDto,
    user: IExpressUser,
  ): Observable<ChatStreamEvent> {
    return defer(() =>
      from(this.executeFoundation(dto, user)).pipe(
        mergeMap((foundation) => {
          if (foundation.admittedChunks.length === 0) {
            return from(
              this.prisma.chatMessage.create({
                data: {
                  chatSessionId: foundation.chatSessionId,
                  role: ChatMessageRole.Assistant,
                  content: NO_CONTEXT_FALLBACK,
                  citations: [],
                },
              }),
            ).pipe(
              mergeMap(() =>
                from([
                  { type: 'message', token: NO_CONTEXT_FALLBACK },
                  { type: 'complete', chatSessionId: foundation.chatSessionId },
                ] as ChatStreamEvent[]),
              ),
            );
          } else {
            return new Observable<ChatStreamEvent>((subscriber) => {
              let isClosed = false;

              const runCompletions = async () => {
                try {
                  const stream = this.aiProvider.generateStream(
                    foundation.finalPrompt,
                  );
                  let fullContent = '';
                  let hasTokens = false;

                  for await (const fragment of stream) {
                    if (subscriber.closed) {
                      isClosed = true;
                      break;
                    }

                    if (fragment !== '') {
                      hasTokens = true;
                      fullContent += fragment;
                      if (!subscriber.closed) {
                        subscriber.next({ type: 'message', token: fragment });
                      }
                    }
                  }

                  if (isClosed || subscriber.closed) {
                    return;
                  }

                  if (!hasTokens || !fullContent) {
                    throw new AIProviderError(
                      'AI completions stream completed with no text fragments.',
                      'AI_EMPTY_RESPONSE',
                    );
                  }

                  // Resolve citations
                  const resolvedCitations = this.resolveCitations(
                    fullContent,
                    foundation.admittedChunks,
                  );

                  const citationsInput: Prisma.InputJsonValue =
                    resolvedCitations.map((c) => {
                      const item: Prisma.InputJsonObject = {
                        documentId: c.documentId,
                        filename: c.filename,
                        ...(c.page !== undefined ? { page: c.page } : {}),
                      };
                      return item;
                    });

                  if (subscriber.closed) {
                    return;
                  }

                  // Persist assistant response
                  await this.prisma.chatMessage.create({
                    data: {
                      chatSessionId: foundation.chatSessionId,
                      role: ChatMessageRole.Assistant,
                      content: fullContent,
                      citations: citationsInput,
                    },
                  });

                  if (subscriber.closed) {
                    return;
                  }

                  // Emit citations events
                  for (const citation of resolvedCitations) {
                    if (subscriber.closed) {
                      return;
                    }
                    subscriber.next({ type: 'citation', citation });
                  }

                  if (subscriber.closed) {
                    return;
                  }

                  // Emit complete event
                  subscriber.next({
                    type: 'complete',
                    chatSessionId: foundation.chatSessionId,
                  });
                  subscriber.complete();
                } catch (err) {
                  if (!subscriber.closed) {
                    subscriber.error(err);
                  }
                }
              };

              void runCompletions();
            });
          }
        }),
      ),
    );
  }

  private resolveCitations(
    fullContent: string,
    admittedChunks: IChatSearchResultItem[],
  ): ChatCitation[] {
    const CITATION_REGEX = /\[DOC-(\d+)\]/g;
    const matches = [...fullContent.matchAll(CITATION_REGEX)];
    const uniqueIds = new Set<string>();
    const resolved: ChatCitation[] = [];

    for (const match of matches) {
      const citationId = `DOC-${match[1]}`;
      if (uniqueIds.has(citationId)) {
        continue;
      }

      // Find in admittedChunks
      const chunk = admittedChunks.find((c) => c.citationId === citationId);
      if (!chunk) {
        continue; // Ignore unknown IDs
      }

      uniqueIds.add(citationId);

      const citation: ChatCitation = {
        documentId: chunk.documentId,
        filename: chunk.documentName,
      };

      if (chunk.pageNumber != null) {
        citation.page = chunk.pageNumber;
      }

      resolved.push(citation);
    }

    return resolved;
  }

  async executeFoundation(
    dto: ChatRequestDto,
    user: IExpressUser,
  ): Promise<{
    chatSessionId: string;
    currentMessageId: string;
    history: ChatMessage[];
    searchResponse: SearchResponseDto;
    admittedChunks: IChatSearchResultItem[];
    finalPrompt: string;
  }> {
    // 1. Resolve or create session
    const session = await this.resolveOrCreateSession(dto, user);

    // 2. Persist active user prompt message
    const userMessage = await this.persistUserMessage(session.id, dto.message);

    // 3. Load prior history candidates (excluding current message)
    const rawCandidates = await this.loadPriorHistoryCandidates(
      session.id,
      userMessage.id,
    );

    // 4. Filter history within the 1,500-token budget
    const history = this.selectHistoryWithinBudget(rawCandidates);

    // 5. Invoke SearchService.search exactly once using authorization context
    const searchResponse = await this.searchService.search(
      {
        query: dto.message,
        limit: 5,
      },
      {
        userRoleId: user.roleId,
        userDepartmentId: user.departmentId,
        roleName: user.roleName,
      },
    );

    // 6. Perform prompt budgeting and assembly
    const { admittedChunks, finalPrompt } = this.budgetPromptAndConstruct(
      dto.message,
      history,
      searchResponse.results,
    );

    return {
      chatSessionId: session.id,
      currentMessageId: userMessage.id,
      history,
      searchResponse,
      admittedChunks,
      finalPrompt,
    };
  }

  private budgetPromptAndConstruct(
    message: string,
    history: ChatMessage[],
    results: IChatSearchResultItem[],
  ): { admittedChunks: IChatSearchResultItem[]; finalPrompt: string } {
    const SYSTEM_INSTRUCTIONS =
      "System Instructions:\nYou are EnterpriseIQ, a helpful corporate assistant. Use the provided context to answer the user's query.\n" +
      'Strict citation rules:\n' +
      '1. Every statement in your response must reference the context using [DOC-X] notations matching the source index.\n' +
      '2. Only use [DOC-X] identifiers that are present in the provided context.\n' +
      '3. Never cite a document that is absent from the context.\n' +
      '4. Format your response in markdown.\n\n';
    const CONTEXT_HEADER = 'Provided Context:\n';
    const HISTORY_HEADER = 'Prior Chat History:\n';
    const QUESTION_HEADER = 'Current User Question:\nUser: ';
    const ASSISTANT_PREFIX = '\nAssistant:';

    // Construct history block
    let historyBlock = '';
    for (const msg of history) {
      historyBlock += `${msg.role}: ${msg.content}\n`;
    }

    const sysTokens = this.tokenizer.encode(SYSTEM_INSTRUCTIONS).length;
    const historyHeaderTokens = this.tokenizer.encode(HISTORY_HEADER).length;
    const contextHeaderTokens = this.tokenizer.encode(CONTEXT_HEADER).length;
    const questionHeaderTokens = this.tokenizer.encode(QUESTION_HEADER).length;
    const assistantPrefixTokens =
      this.tokenizer.encode(ASSISTANT_PREFIX).length;

    const historyTokens = this.tokenizer.encode(historyBlock).length;
    const userPromptTokens = this.tokenizer.encode(message).length;

    const T_fixed =
      sysTokens +
      historyHeaderTokens +
      historyTokens +
      contextHeaderTokens +
      questionHeaderTokens +
      userPromptTokens +
      assistantPrefixTokens;

    let B_avail = B_LIMIT - T_fixed;

    const admittedChunks: IChatSearchResultItem[] = [];
    let contextBlock = '';
    let admittedIndex = 1;

    for (const chunk of results) {
      const chunkBlock = `[DOC-${admittedIndex}] Source: ${chunk.documentName}${chunk.pageNumber != null ? `, Page: ${chunk.pageNumber}` : ''}\nContent: ${chunk.content}\n\n`;
      const chunkTokens = this.tokenizer.encode(chunkBlock).length;

      if (chunkTokens <= B_avail) {
        contextBlock += chunkBlock;
        B_avail -= chunkTokens;
        admittedChunks.push({
          ...chunk,
          citationId: `DOC-${admittedIndex}`,
        });
        admittedIndex++;
      } else {
        break; // Stop context ingestion upon first overflow
      }
    }

    let finalPrompt =
      SYSTEM_INSTRUCTIONS +
      CONTEXT_HEADER +
      contextBlock +
      HISTORY_HEADER +
      historyBlock +
      QUESTION_HEADER +
      message +
      ASSISTANT_PREFIX;

    let finalPromptTokenCount = this.tokenizer.encode(finalPrompt).length;

    // Overflow recovery loop (whole prompt BPE checking)
    while (finalPromptTokenCount > B_LIMIT && admittedChunks.length > 0) {
      admittedChunks.pop(); // Remove the last admitted chunk

      // Rebuild contextBlock with remaining chunks
      contextBlock = '';
      let index = 1;
      for (const chunk of admittedChunks) {
        chunk.citationId = `DOC-${index}`;
        const chunkBlock = `[DOC-${index}] Source: ${chunk.documentName}${chunk.pageNumber != null ? `, Page: ${chunk.pageNumber}` : ''}\nContent: ${chunk.content}\n\n`;
        contextBlock += chunkBlock;
        index++;
      }

      finalPrompt =
        SYSTEM_INSTRUCTIONS +
        CONTEXT_HEADER +
        contextBlock +
        HISTORY_HEADER +
        historyBlock +
        QUESTION_HEADER +
        message +
        ASSISTANT_PREFIX;

      finalPromptTokenCount = this.tokenizer.encode(finalPrompt).length;
    }

    if (finalPromptTokenCount > B_LIMIT) {
      throw new Error(
        `Invariant Violation: Base prompt size (${finalPromptTokenCount}) exceeds budget limit (${B_LIMIT}).`,
      );
    }

    return {
      admittedChunks,
      finalPrompt,
    };
  }

  private async resolveOrCreateSession(
    dto: ChatRequestDto,
    user: IExpressUser,
  ) {
    if (dto.chatSessionId) {
      // Find session owned by active user only
      const session = await this.prisma.chatSession.findFirst({
        where: {
          id: dto.chatSessionId,
          userId: user.userId,
        },
      });

      if (!session) {
        // Safe, non-disclosing NotFoundException
        throw new NotFoundException('Chat session not found.');
      }

      return session;
    }

    // Create a new session
    const title = this.createSessionTitle(dto.message);
    return this.prisma.chatSession.create({
      data: {
        userId: user.userId,
        title,
      },
    });
  }

  private createSessionTitle(message: string): string {
    if (message.length <= 50) {
      return message;
    }
    return message.substring(0, 47) + '...';
  }

  private async persistUserMessage(chatSessionId: string, content: string) {
    return this.prisma.chatMessage.create({
      data: {
        chatSessionId,
        role: ChatMessageRole.User,
        content,
        citations: [], // Defaults to empty JSON array
      },
    });
  }

  private async loadPriorHistoryCandidates(
    chatSessionId: string,
    currentMessageId: string,
  ): Promise<ChatMessage[]> {
    return this.prisma.chatMessage.findMany({
      where: {
        chatSessionId,
        id: {
          not: currentMessageId, // Exclude current message
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
  }

  private selectHistoryWithinBudget(messages: ChatMessage[]): ChatMessage[] {
    let accumulatedTokens = 0;
    const selectedMessages: ChatMessage[] = [];

    // messages array is ordered newest-first (createdAt DESC, id DESC)
    for (const message of messages) {
      const serialized = `${message.role}: ${message.content}\n`;
      const tokenCount = this.tokenizer.encode(serialized).length;

      if (accumulatedTokens + tokenCount <= HISTORY_TOKEN_BUDGET) {
        selectedMessages.push(message);
        accumulatedTokens += tokenCount;
      } else {
        break; // Terminate loop immediately, discard this and all older
      }
    }

    // Reverse only the selected messages to restore chronological oldest-to-newest order
    return selectedMessages.reverse();
  }
}

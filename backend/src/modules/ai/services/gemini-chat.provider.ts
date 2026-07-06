import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  IAIProvider,
  AIProviderError,
} from '../domain/interfaces/ai-provider.interface';

@Injectable()
export class GeminiChatProvider implements IAIProvider {
  private readonly logger = new Logger(GeminiChatProvider.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const modelName = this.configService.get<string>('GEMINI_MODEL');

    if (!apiKey) {
      throw new Error(
        'Configuration Invariant Violation: GEMINI_API_KEY is not defined.',
      );
    }
    if (!modelName) {
      throw new Error(
        'Configuration Invariant Violation: GEMINI_MODEL is not defined.',
      );
    }

    this.modelName = modelName;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async *generateStream(prompt: string): AsyncGenerator<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text && text.length > 0) {
          yield text;
        }
      }
    } catch (err: unknown) {
      // Safe, bounded diagnostics logging
      let diagnosticMessage = 'Unknown error';
      if (err instanceof Error) {
        // Normalize line breaks and bound the error message length to 150 characters
        const rawMsg = err.message || '';
        diagnosticMessage = rawMsg.replace(/\r?\n/g, ' ').slice(0, 150);
      }
      this.logger.error(
        `Gemini completions stream failed: ${diagnosticMessage}`,
      );

      // Propagate clean, provider-neutral error without leaking internal SDK context
      throw new AIProviderError();
    }
  }
}

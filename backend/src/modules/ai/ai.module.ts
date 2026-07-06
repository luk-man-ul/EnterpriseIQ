import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  EMBEDDING_PROVIDER_TOKEN,
  AI_PROVIDER_TOKEN,
} from './constants/ai.constants';
import { GeminiEmbeddingProvider } from './services/gemini-embedding.provider';
import { GeminiChatProvider } from './services/gemini-chat.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      useClass: GeminiEmbeddingProvider,
    },
    {
      provide: AI_PROVIDER_TOKEN,
      useClass: GeminiChatProvider,
    },
  ],
  exports: [EMBEDDING_PROVIDER_TOKEN, AI_PROVIDER_TOKEN],
})
export class AiModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EMBEDDING_PROVIDER_TOKEN } from './constants/ai.constants';
import { GeminiEmbeddingProvider } from './services/gemini-embedding.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      useClass: GeminiEmbeddingProvider,
    },
  ],
  exports: [EMBEDDING_PROVIDER_TOKEN],
})
export class AiModule {}

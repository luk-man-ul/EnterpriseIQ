import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { SearchModule } from '../search/search.module';
import { AiModule } from '../ai/ai.module';
import { ChatService } from './services/chat.service';
import { ChatController } from './controllers/chat.controller';
import { ChatSessionService } from './services/chat-session.service';

@Module({
  imports: [PrismaModule, SearchModule, AiModule],
  controllers: [ChatController],
  providers: [ChatService, ChatSessionService],
})
export class ChatModule {}

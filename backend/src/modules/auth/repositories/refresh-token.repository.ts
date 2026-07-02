import { Injectable } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IRefreshTokenRepository } from '../domain/interfaces/refresh-token-repository.interface';

@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { id } });
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { token } });
  }

  async create(
    data: Omit<RefreshToken, 'id' | 'createdAt'>,
  ): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  async revoke(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}

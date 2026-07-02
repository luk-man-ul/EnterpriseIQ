import { RefreshToken } from '@prisma/client';

export const REFRESH_TOKEN_REPOSITORY_TOKEN = 'IRefreshTokenRepository';

export interface IRefreshTokenRepository {
  findById(id: string): Promise<RefreshToken | null>;
  findByToken(token: string): Promise<RefreshToken | null>;
  create(data: Omit<RefreshToken, 'id' | 'createdAt'>): Promise<RefreshToken>;
  revoke(id: string): Promise<RefreshToken>;
  deleteByUserId(userId: string): Promise<void>;
}

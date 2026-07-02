import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ITokenService } from '../domain/interfaces/token-service.interface';
import {
  IJwtPayload,
  IRefreshPayload,
} from '../domain/interfaces/jwt-payload.interface';

@Injectable()
export class TokenService implements ITokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateAccessToken(payload: IJwtPayload): Promise<string> {
    // Automatically uses default secret & expiry configured in JwtModule.registerAsync()
    return this.jwtService.signAsync(payload);
  }

  async generateRefreshToken(payload: IRefreshPayload): Promise<string> {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const expiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: expiresIn as unknown as number,
    });
  }

  async verifyAccessToken(token: string): Promise<IJwtPayload> {
    // Automatically uses default secret configured in JwtModule.registerAsync()
    return this.jwtService.verifyAsync<IJwtPayload>(token);
  }

  async verifyRefreshToken(token: string): Promise<IRefreshPayload> {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    return this.jwtService.verifyAsync<IRefreshPayload>(token, {
      secret,
    });
  }
}

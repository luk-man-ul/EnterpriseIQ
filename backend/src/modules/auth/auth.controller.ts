import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import * as UserRepo from '../users/domain/interfaces/user-repository.interface';
import * as RoleRepo from '../users/domain/interfaces/role-repository.interface';
import * as RefreshTokenRepo from './domain/interfaces/refresh-token-repository.interface';
import * as PasswordServiceContract from './domain/interfaces/password-service.interface';
import * as TokenServiceContract from './domain/interfaces/token-service.interface';
import { USER_REPOSITORY_TOKEN } from '../users/domain/interfaces/user-repository.interface';
import { ROLE_REPOSITORY_TOKEN } from '../users/domain/interfaces/role-repository.interface';
import { REFRESH_TOKEN_REPOSITORY_TOKEN } from './domain/interfaces/refresh-token-repository.interface';
import { PASSWORD_SERVICE_TOKEN } from './domain/interfaces/password-service.interface';
import { TOKEN_SERVICE_TOKEN } from './domain/interfaces/token-service.interface';
import { parseDuration } from '../../shared/utils/duration';

interface IExpressUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
  roleName: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: UserRepo.IUserRepository,
    @Inject(ROLE_REPOSITORY_TOKEN)
    private readonly roleRepository: RoleRepo.IRoleRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY_TOKEN)
    private readonly refreshTokenRepository: RefreshTokenRepo.IRefreshTokenRepository,
    @Inject(PASSWORD_SERVICE_TOKEN)
    private readonly passwordService: PasswordServiceContract.IPasswordService,
    @Inject(TOKEN_SERVICE_TOKEN)
    private readonly tokenService: TokenServiceContract.ITokenService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await this.passwordService.verify(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const role = await this.roleRepository.findById(user.roleId);
    if (!role) {
      throw new UnauthorizedException('User role configuration invalid.');
    }

    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: role.name,
    });

    const refreshTokenString = await this.tokenService.generateRefreshToken({
      sub: user.id,
    });

    const refreshExpiryConfig =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const refreshExpiryMs = parseDuration(refreshExpiryConfig);
    const expiresAt = new Date(Date.now() + refreshExpiryMs);

    // Save refresh token to db
    await this.refreshTokenRepository.create({
      token: refreshTokenString,
      userId: user.id,
      expiresAt,
      isRevoked: false,
    });

    // Set cookie
    res.cookie('refreshToken', refreshTokenString, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: refreshExpiryMs,
    });

    return {
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        user: {
          userId: user.id,
          email: user.email,
          roleId: user.roleId,
          departmentId: user.departmentId,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshTokenString = req.cookies?.refreshToken as string | undefined;
    if (!refreshTokenString) {
      throw new UnauthorizedException('Refresh token missing.');
    }

    try {
      // Cryptographically verify JWT format and signature
      const payload =
        await this.tokenService.verifyRefreshToken(refreshTokenString);

      // Verify db state
      const tokenRecord =
        await this.refreshTokenRepository.findByToken(refreshTokenString);
      if (
        !tokenRecord ||
        tokenRecord.isRevoked ||
        tokenRecord.expiresAt < new Date()
      ) {
        throw new UnauthorizedException('Invalid or expired refresh token.');
      }

      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found.');
      }

      const role = await this.roleRepository.findById(user.roleId);
      if (!role) {
        throw new UnauthorizedException('User role configuration invalid.');
      }

      // Rotate tokens
      // 1. Revoke the old refresh token record specifically
      await this.refreshTokenRepository.revoke(tokenRecord.id);

      // 2. Generate new pairs
      const newAccessToken = await this.tokenService.generateAccessToken({
        sub: user.id,
        email: user.email,
        role: role.name,
      });

      const newRefreshTokenString =
        await this.tokenService.generateRefreshToken({
          sub: user.id,
        });

      const refreshExpiryConfig =
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
      const refreshExpiryMs = parseDuration(refreshExpiryConfig);
      const expiresAt = new Date(Date.now() + refreshExpiryMs);

      // 3. Save new refresh token record
      await this.refreshTokenRepository.create({
        token: newRefreshTokenString,
        userId: user.id,
        expiresAt,
        isRevoked: false,
      });

      // 4. Update cookie
      res.cookie('refreshToken', newRefreshTokenString, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth',
        maxAge: refreshExpiryMs,
      });

      return {
        success: true,
        message: 'Token refreshed.',
        data: {
          accessToken: newAccessToken,
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshTokenString = req.cookies?.refreshToken as string | undefined;
    if (refreshTokenString) {
      try {
        const tokenRecord =
          await this.refreshTokenRepository.findByToken(refreshTokenString);
        if (tokenRecord) {
          await this.refreshTokenRepository.revoke(tokenRecord.id);
        }
      } catch {
        // Suppress parsing errors during logout invalidation
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    });

    return {
      success: true,
      message: 'Logout successful.',
      data: {},
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    const userContext = req.user as IExpressUser;
    return {
      success: true,
      message: 'Profile retrieved.',
      data: {
        userId: userContext.userId,
        email: userContext.email,
        firstName: userContext.firstName,
        lastName: userContext.lastName,
        roleId: userContext.roleId,
        departmentId: userContext.departmentId,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

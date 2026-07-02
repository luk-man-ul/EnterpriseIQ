import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { REFRESH_TOKEN_REPOSITORY_TOKEN } from './domain/interfaces/refresh-token-repository.interface';
import { PASSWORD_SERVICE_TOKEN } from './domain/interfaces/password-service.interface';
import { TOKEN_SERVICE_TOKEN } from './domain/interfaces/token-service.interface';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ??
            '15m') as unknown as number,
        },
      }),
    }),
    forwardRef(() => UsersModule),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: REFRESH_TOKEN_REPOSITORY_TOKEN,
      useClass: RefreshTokenRepository,
    },
    {
      provide: PASSWORD_SERVICE_TOKEN,
      useClass: PasswordService,
    },
    {
      provide: TOKEN_SERVICE_TOKEN,
      useClass: TokenService,
    },
    JwtStrategy,
  ],
  exports: [PASSWORD_SERVICE_TOKEN, TOKEN_SERVICE_TOKEN],
})
export class AuthModule {}
export {
  REFRESH_TOKEN_REPOSITORY_TOKEN,
  PASSWORD_SERVICE_TOKEN,
  TOKEN_SERVICE_TOKEN,
};

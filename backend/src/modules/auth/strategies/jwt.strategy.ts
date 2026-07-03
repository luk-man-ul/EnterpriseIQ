import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { IJwtPayload } from '../domain/interfaces/jwt-payload.interface';
import * as UserRepo from '../../users/domain/interfaces/user-repository.interface';
import { USER_REPOSITORY_TOKEN } from '../../users/domain/interfaces/user-repository.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: UserRepo.IUserRepository,
  ) {
    // TEMP DEBUG
    console.log('JWT_SECRET =', configService.get<string>('JWT_SECRET'));
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: IJwtPayload) {
    // TEMP DEBUG
    console.log('JWT PAYLOAD RECEIVED:', payload);
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      departmentId: user.departmentId,
      roleName: payload.role,
    };
  }
}

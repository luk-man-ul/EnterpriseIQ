import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { UserRepository } from './repositories/user.repository';
import { RoleRepository } from './repositories/role.repository';
import { DepartmentRepository } from './repositories/department.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesController } from './roles.controller';
import { USER_REPOSITORY_TOKEN } from './domain/interfaces/user-repository.interface';
import { ROLE_REPOSITORY_TOKEN } from './domain/interfaces/role-repository.interface';
import { DEPARTMENT_REPOSITORY_TOKEN } from './domain/interfaces/department-repository.interface';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [UsersController, RolesController],
  providers: [
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: UserRepository,
    },
    {
      provide: ROLE_REPOSITORY_TOKEN,
      useClass: RoleRepository,
    },
    {
      provide: DEPARTMENT_REPOSITORY_TOKEN,
      useClass: DepartmentRepository,
    },
    UsersService,
  ],
  exports: [
    USER_REPOSITORY_TOKEN,
    ROLE_REPOSITORY_TOKEN,
    DEPARTMENT_REPOSITORY_TOKEN,
    UsersService,
  ],
})
export class UsersModule {}
export {
  USER_REPOSITORY_TOKEN,
  ROLE_REPOSITORY_TOKEN,
  DEPARTMENT_REPOSITORY_TOKEN,
};

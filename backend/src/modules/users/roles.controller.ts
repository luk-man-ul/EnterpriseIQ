import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import * as RoleRepo from './domain/interfaces/role-repository.interface';
import { ROLE_REPOSITORY_TOKEN } from './domain/interfaces/role-repository.interface';

@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN)
    private readonly roleRepository: RoleRepo.IRoleRepository,
  ) {}

  @Get()
  async findAll() {
    const roles = await this.roleRepository.findAll();
    const mappedRoles = roles.map((role) => ({
      roleId: role.id,
      name: role.name,
      description: role.description,
    }));

    return {
      success: true,
      message: 'Roles list retrieved.',
      data: mappedRoles,
      timestamp: new Date().toISOString(),
    };
  }
}
